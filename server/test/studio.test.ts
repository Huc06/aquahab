// Creator studio against the SDK's MemWalMock (no LLM, so the deterministic fallbacks answer):
// room lens and goal, draft with receipts, ask the crew with receipts, and nothing stored by either.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.ts";
import { CONTEXT_PRESETS, type ChatResponse, type DraftResponse, type MemoriesResponse, type Room } from "../src/contract.ts";
import { closeDb, q } from "../src/db.ts";
import { inDomain, roomContext } from "../src/llm.ts";
import { processQueue } from "../src/memory/keeper.ts";
import { cleanContextTags } from "../src/rooms.ts";
import { parseSeedFile } from "../scripts/seed-lib.ts";

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

let room: Room;
let blobs: Set<string>;

beforeAll(async () => {
  const r = await call<Room>("POST", "/api/rooms", {
    slug: "studio",
    name: "Creator Studio",
    goal: "Build an audience around agent memory",
    contextTags: { ...CONTEXT_PRESETS.creator, nobody: "ignored", hippo: "   " },
  });
  expect(r.status).toBe(201);
  room = r.json;
  for (const text of [
    "s: Voice rule: open with a contrarian line, then one personal story",
    "f: A listicle post got far fewer replies than the essays",
    "d: The content pillar is agent memory, not RAG",
    "l: Readers ask most about where memory is stored",
  ]) {
    expect((await call("POST", `/api/rooms/${room.id}/capture`, { text })).status).toBe(202);
  }
  await drain();
  const wall = await call<MemoriesResponse>("GET", `/api/rooms/${room.id}/memories`);
  blobs = new Set(wall.json.memories.map((m) => m.blobId));
  expect(blobs.size).toBe(4);
});

afterAll(closeDb);

describe("room lens and goal", () => {
  it("keeps known roles only, trims labels and drops empty ones", () => {
    expect(room.goal).toBe("Build an audience around agent memory");
    expect(room.contextTags).toEqual({ one: "Content Strategy", researcher: "Trends & Signals", builder: "Tech & Distribution", lofi: "Brand Voice" });
    expect(cleanContextTags({ lofi: "x".repeat(80) })?.lofi).toHaveLength(40);
    expect(cleanContextTags({})).toBeNull();
    expect(cleanContextTags("lofi")).toBeNull();
  });

  it("updates and clears the goal and the tags", async () => {
    const a = await call<Room>("PATCH", `/api/rooms/${room.id}`, { contextTags: { lofi: "Voice" }, goal: "" });
    expect(a.json.contextTags).toEqual({ lofi: "Voice" });
    expect(a.json.goal).toBeNull();
    const b = await call<Room>("PATCH", `/api/rooms/${room.id}`, { contextTags: CONTEXT_PRESETS.creator, goal: "Build an audience around agent memory" });
    expect(b.json.contextTags?.one).toBe("Content Strategy");
    const c = await call<Room>("PATCH", `/api/rooms/${room.id}`, { name: "Creator Studio" });
    expect(c.json.contextTags?.one).toBe("Content Strategy"); // absent means keep
  });

  it("goes to the model as data, not as instructions", () => {
    expect(roomContext("Grow", { lofi: "Brand Voice", one: "Content Strategy" })).toEqual(["Room goal: Grow", "Room lens: lofi = Brand Voice, one = Content Strategy"]);
    expect(roomContext(null, null)).toEqual([]);
  });
});

describe("draft", () => {
  it("returns a draft with receipts for what it followed and avoided, and stores nothing", async () => {
    const before = await jobCount();
    const r = await call<DraftResponse>("POST", `/api/rooms/${room.id}/draft`, { idea: "Why memory is the moat" });
    expect(r.status).toBe(200);
    expect(r.json.agent).toBe("lofi");
    expect(r.json.source).toBe("fallback");
    expect(r.json.recalled).toBeGreaterThan(0);
    expect(r.json.draft).toContain("Why memory is the moat");
    const follow = r.json.rules.filter((x) => x.kind === "follow");
    const avoid = r.json.rules.filter((x) => x.kind === "avoid");
    expect(avoid.map((x) => x.text)).toContain("A listicle post got far fewer replies than the essays");
    expect(avoid[0].agent).toBe("builder");
    expect(follow.some((x) => x.agent === "lofi" && x.text.startsWith("Voice rule"))).toBe(true);
    for (const rule of r.json.rules) expect(blobs.has(rule.blobId)).toBe(true);
    expect(await jobCount()).toBe(before);
  });

  it("rejects bad input", async () => {
    expect((await call("POST", `/api/rooms/${room.id}/draft`, { idea: " " })).status).toBe(400);
    expect((await call("POST", `/api/rooms/${room.id}/draft`, { idea: "x", agent: "keeper" })).status).toBe(400);
    expect((await call("POST", `/api/rooms/${room.id}/draft`, { idea: "x", refine: "shorter" })).status).toBe(400);
    expect((await call("POST", `/api/rooms/${room.id}/draft`, { idea: "x", refine: "louder", previous: "y" })).status).toBe(400);
  });
});

describe("ask the crew", () => {
  it("lets only members with relevant memories answer, each with receipts, and stores nothing", async () => {
    const before = await jobCount();
    const r = await call<ChatResponse>("POST", `/api/rooms/${room.id}/chat`, { message: "What should I write about this week?", agent: "all" });
    expect(r.status).toBe(200);
    const agents = r.json.replies.map((x) => x.agent);
    expect(agents).not.toContain("hippo"); // no deadline memories in this room
    expect(agents.length).toBeGreaterThan(0);
    for (const reply of r.json.replies) {
      expect(reply.cites.length).toBeGreaterThan(0);
      for (const b of reply.cites) expect(blobs.has(b)).toBe(true);
    }
    expect(r.json.proposal).toBeNull(); // the fallback never proposes
    expect(await jobCount()).toBe(before);
  });

  it("answers one-on-one, and says so when memory has nothing", async () => {
    const one = await call<ChatResponse>("POST", `/api/rooms/${room.id}/chat`, { message: "What did we decide?", agent: "one" });
    expect(one.json.replies.map((x) => x.agent)).toEqual(["one"]);
    const empty = await call<Room>("POST", "/api/rooms", { slug: "empty-room", name: "Empty room" });
    const none = await call<ChatResponse>("POST", `/api/rooms/${empty.json.id}/chat`, { message: "Anything?", agent: "all" });
    expect(none.json.replies).toEqual([{ agent: "one", text: "Nothing in this room's memory answers that yet.", cites: [] }]);
  });

  it("rejects bad input", async () => {
    expect((await call("POST", `/api/rooms/${room.id}/chat`, { message: "", agent: "all" })).status).toBe(400);
    expect((await call("POST", `/api/rooms/${room.id}/chat`, { message: "hi", agent: "keeper" })).status).toBe(400);
    expect((await call("POST", `/api/rooms/${room.id}/chat`, { message: "hi", agent: "ghost" })).status).toBe(400);
  });
});

describe("brief sections stay in their domain", () => {
  it("drops a line that restates another member's memory, but lets One cite anything", () => {
    const memories = [
      { code: "m1", blobId: "b1", text: "[done][x][2026-11-05][by:builder] Merged the deploy path" },
      { code: "m2", blobId: "b2", text: "[learned][x][2026-11-05][by:researcher] Tatum dropped JSON-RPC" },
    ];
    const out = inDomain(
      [
        { agent: "one", lines: [{ text: "Cut over next", cites: ["m1"] }] },
        { agent: "researcher", lines: [{ text: "Learned that we merged the deploy path", cites: ["m1"] }, { text: "Tatum dropped JSON-RPC", cites: ["m2"] }] },
        { agent: "hippo", lines: [{ text: "Padding", cites: ["m1"] }] },
      ],
      memories,
    );
    expect(out.map((s) => [s.agent, s.lines.map((l) => l.text)])).toEqual([
      ["one", ["Cut over next"]],
      ["researcher", ["Tatum dropped JSON-RPC"]],
    ]);
  });
});

describe("seed file", () => {
  it("needs a prefix on every memory line and skips comments", () => {
    const ok = parseSeedFile("# demo room\n\ns: Voice rule: contrarian opener\r\nd: Pillar is agent memory\n");
    expect(ok.errors).toEqual([]);
    expect(ok.lines.map((l) => [l.line, l.type])).toEqual([
      [3, "story"],
      [4, "decision"],
    ]);
    const bad = parseSeedFile("no prefix here\nd:   \n");
    expect(bad.errors).toHaveLength(2);
    expect(bad.errors[0]).toContain("line 1");
  });

  it("refuses preference lines: they go to the CEO namespace and would shape every room's brief", () => {
    const { lines, errors } = parseSeedFile("s: Voice: short and direct\np: Briefs: lead with the post to write today\npref: one line only\n");
    expect(lines.map((l) => l.type)).toEqual(["story"]);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain("line 2");
    expect(errors[0]).toContain("every room");
  });
});
