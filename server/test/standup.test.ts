// The crew standup against the SDK's MemWalMock (no LLM, so the deterministic fallback talks): who is in it,
// every turn cites stored blobs, nothing reaches Walrus, the office hears about it, and the morning tick holds it.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.ts";
import type { MemoriesResponse, Room, Standup } from "../src/contract.ts";
import { closeDb, q } from "../src/db.ts";
import { processQueue } from "../src/memory/keeper.ts";
import { tick } from "../src/scheduler.ts";
import { withoutCodes } from "../src/llm.ts";
import { checkTurns, standupSpeakers } from "../src/standup.ts";
import { localParts } from "../src/util.ts";

const call = async <T = any>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }> => {
  const r = await app.request(path, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: (await r.json()) as T };
};

const drain = async () => {
  for (let i = 0; i < 5; i++) await processQueue({ sleep: async () => {} });
};

const jobCount = async () => Number((await q(`select count(*) as n from memory_jobs`))[0].n);

const newRoom = async (slug: string, lines: string[], extra: Record<string, unknown> = {}) => {
  const r = await call<Room>("POST", "/api/rooms", { slug, name: slug, ...extra });
  expect(r.status).toBe(201);
  for (const text of lines) expect((await call("POST", `/api/rooms/${r.json.id}/capture`, { text })).status).toBe(202);
  await drain();
  return r.json;
};

let room: Room;
let blobs: Set<string>;

beforeAll(async () => {
  room = await newRoom("crew", [
    "n: Record the demo video before the code freeze",
    "done: The crew server runs on Railway",
    "f: The morning brief missed the CEO because the bot was not paired",
    "s: The demo opens on the office, then the receipt popover",
  ]);
  blobs = new Set((await call<MemoriesResponse>("GET", `/api/rooms/${room.id}/memories`)).json.memories.map((m) => m.blobId));
  expect(blobs.size).toBe(4);
});

afterAll(closeDb);

describe("the crew standup", () => {
  it("has no standup before it is held", async () => {
    expect((await call("GET", `/api/rooms/${room.id}/standup/latest`)).status).toBe(404);
  });

  it("lets every member with memories of its own types speak, each turn citing stored blobs, and stores nothing", async () => {
    const before = await jobCount();
    const r = await call<Standup>("POST", `/api/rooms/${room.id}/standup`);
    expect(r.status).toBe(201);
    expect(r.json.source).toBe("fallback");
    expect(r.json.recalled).toBe(4);
    expect(r.json.turns.map((t) => t.agent)).toEqual(["one", "builder", "lofi"]);
    expect(r.json.turns[0].text).toBe("Record the demo video before the code freeze");
    for (const t of r.json.turns) {
      expect(t.cites.length).toBeGreaterThan(0);
      for (const b of t.cites) expect(blobs.has(b)).toBe(true);
    }
    expect(await jobCount()).toBe(before); // a conversation, not a memory

    const latest = await call<Standup>("GET", `/api/rooms/${room.id}/standup/latest`);
    expect(latest.json.id).toBe(r.json.id);
    const ev = await q(`select payload from events where type = 'standup.created' order by id desc limit 1`);
    expect(ev[0].payload).toEqual({ type: "standup.created", roomId: room.id, standupId: r.json.id });
    const used = await q(`select payload from events where type = 'recall.used' order by id desc limit 1`);
    expect(used[0].payload.purpose).toBe("standup");
  });

  it("needs memories from at least two members", async () => {
    const empty = await newRoom("empty", []);
    expect((await call("POST", `/api/rooms/${empty.id}/standup`)).status).toBe(409);
    const alone = await newRoom("alone", ["d: Keep the brief to five lines"]);
    expect((await call("POST", `/api/rooms/${alone.id}/standup`)).status).toBe(409);
    expect((await call("GET", `/api/rooms/${alone.id}/standup/latest`)).status).toBe(404);
  });

  it("is held after the morning brief", async () => {
    const local = localParts(new Date(), "Asia/Ho_Chi_Minh");
    const hhmm = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const morning = await newRoom("morning", ["n: Pair the bot", "done: Webhook registered on boot"], {
      briefAt: hhmm(local.hour, local.minute),
      debriefAt: hhmm((local.hour + 12) % 24, local.minute), // not due now
    });
    const out = await tick();
    expect(out.briefs).toContain("morning");
    expect(out.errors).toEqual([]);
    const s = await call<Standup>("GET", `/api/rooms/${morning.id}/standup/latest`);
    expect(s.status).toBe(200);
    expect(s.json.turns.map((t) => t.agent)).toEqual(["one", "builder"]);
  });
});

describe("checking the turns", () => {
  const memories = [
    { code: "m1", blobId: "blob-next", text: "[next][r][2026-11-06][by:one] Record the demo" },
    { code: "m2", blobId: "blob-done", text: "[done][r][2026-11-06][by:builder] Deploy is live" },
    { code: "m3", blobId: "blob-story", text: "[story][r][2026-11-06][by:lofi] Open on the office" },
    { code: "m4", blobId: "blob-failure", text: "[failure][r][2026-11-05][by:builder] The 5 Nov brief never ran" },
  ];

  it("takes one, plus each member whose types are in the recall", () => {
    expect(standupSpeakers(memories)).toEqual(["one", "builder", "lofi"]);
    expect(standupSpeakers(memories.slice(1, 2))).toEqual(["one", "builder"]);
    expect(standupSpeakers([])).toEqual(["one"]);
  });

  it("keeps only cited, in-domain turns from members who are here", () => {
    const turns = checkTurns(
      [
        { agent: "one", to: null, text: "Demo first.", cites: ["m1"] },
        { agent: "builder", to: "one", text: "  Deploy   is live (see m2).  ", cites: ["m2", "m2", "m9"] },
        { agent: "hippo", to: null, text: "Not here.", cites: ["m1"] },
        { agent: "lofi", to: "lofi", text: "Open on the office.", cites: ["m3"] },
        { agent: "lofi", to: "hippo", text: "Out of my lane.", cites: ["m2"] },
        { agent: "builder", to: "researcher", text: "Made up.", cites: ["m42"] },
        { agent: "one", to: null, text: "   ", cites: ["m1"] },
        { agent: "one", to: null, text: "Run the missed 5 Nov brief.", cites: ["m4"] },
        { agent: "one", to: "builder", text: "The deploy step is closed.", cites: ["m2"] },
      ],
      memories,
      ["one", "builder", "lofi"],
    );
    expect(turns).toEqual([
      { agent: "one", to: null, text: "Demo first.", cites: ["blob-next"] },
      { agent: "builder", to: "one", text: "Deploy is live.", cites: ["blob-done"] },
      { agent: "lofi", to: null, text: "Open on the office.", cites: ["blob-story"] }, // answering oneself is not an answer
      // one may say a next step is closed, but may not turn a failure alone into a task
      { agent: "one", to: "builder", text: "The deploy step is closed.", cites: ["blob-done"] },
    ]);
  });

  it("drops memory codes the model wrote into the text", () => {
    expect(withoutCodes("No open next steps; the cut-over is done (m1). What next?")).toBe("No open next steps; the cut-over is done. What next?");
    expect(withoutCodes("Shipped (see m2, m3) and fixed (m4 and c1)")).toBe("Shipped and fixed");
    expect(withoutCodes("Merged #15 (draft and chat)")).toBe("Merged #15 (draft and chat)");
  });

  it("caps a standup at eight turns", () => {
    const many = Array.from({ length: 12 }, () => ({ agent: "one" as const, to: null, text: "Again.", cites: ["m1"] }));
    expect(checkTurns(many, memories, ["one"])).toHaveLength(8);
  });
});
