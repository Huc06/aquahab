// The whole daily loop through the HTTP API, against the SDK's MemWalMock:
// day-one brief (empty) → capture → Keeper files → brief cites the stored blobs → debrief → keep/drop →
// feedback becomes a CEO memory → the memory wall lists everything.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.ts";
import { ceoLines } from "../src/brief.ts";
import { cached, closeDb, q } from "../src/db.ts";
import { processQueue } from "../src/memory/keeper.ts";
import type { Brief, Candidate, MemoriesResponse, MemoryJob, Room } from "../src/contract.ts";

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

let room: Room;

beforeAll(async () => {
  const r = await call<Room>("POST", "/api/rooms", { slug: "aquahab", name: "Aquahab" });
  expect(r.status).toBe(201);
  room = r.json;
});

afterAll(closeDb);

describe("the daily loop", () => {
  it("one room is one namespace", () => {
    expect(room.namespace).toBe("aquahab:room:aquahab");
    expect(room.dayIndex).toBe(1);
  });

  it("gives an honest day-one brief from empty memory", async () => {
    const { json: b } = await call<Brief>("POST", `/api/rooms/${room.id}/brief`);
    expect(b.source).toBe("empty");
    expect(b.recalled).toBe(0);
    expect(b.kind).toBe("day-one");
    expect(b.sections.map((s) => s.agent)).toEqual(["one", "keeper"]);
  });

  it("files quick captures through the Keeper, signed by the right crew member", async () => {
    const d = await call<MemoryJob>("POST", `/api/rooms/${room.id}/capture`, { text: "d: Use Tatum GraphQL for events; JSON-RPC returns 404" });
    const f = await call<MemoryJob>("POST", `/api/rooms/${room.id}/capture`, { text: "f: SuiGrpcClient fails against Tatum gRPC; use @grpc/grpc-js" });
    const n = await call<MemoryJob>("POST", `/api/rooms/${room.id}/capture`, { text: "n: Wire the review panel to the debrief endpoint" });
    expect(d.status).toBe(202);
    expect([d.json.agent, f.json.agent, n.json.agent]).toEqual(["one", "builder", "one"]);
    expect(d.json.status).toBe("queued");
    await drain();
    const stored = await call<MemoryJob>("GET", `/api/memory-jobs/${d.json.jobId}`);
    expect(stored.json.status).toBe("stored");
    expect(stored.json.blobId).toBeTruthy();
  });

  it("never files the same memory twice", async () => {
    const again = await call<MemoryJob>("POST", `/api/rooms/${room.id}/capture`, { text: "d: Use Tatum GraphQL for events; JSON-RPC returns 404" });
    expect(again.json.status).toBe("stored");
  });

  it("redacts credentials before anything reaches the relayer", async () => {
    const j = await call<MemoryJob>("POST", `/api/rooms/${room.id}/capture`, { text: "l: the Tatum key t-0123456789abcdef01234567-89abcdef0123456789abcdef works on mainnet" });
    expect(j.json.redacted).toBe(true);
    expect(j.json.text).not.toContain("t-0123");
  });

  it("writes a brief whose every line cites stored blobs", async () => {
    await drain();
    const { json: b } = await call<Brief>("POST", `/api/rooms/${room.id}/brief`);
    expect(b.source).toBe("fallback"); // no LLM key in tests
    expect(b.recalled).toBeGreaterThan(0);
    const jobs = await call<MemoryJob[]>("GET", `/api/memory-jobs?roomId=${room.id}`);
    const blobs = new Set(jobs.json.map((j) => j.blobId));
    const lines = b.sections.filter((s) => s.agent !== "keeper").flatMap((s) => s.lines);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.cites.length).toBeGreaterThan(0);
      for (const c of l.cites) expect(blobs.has(c)).toBe(true);
    }
  });

  it("turns the debrief into proposals, and files only what the CEO keeps", async () => {
    const { json: cands } = await call<Candidate[]>("POST", `/api/rooms/${room.id}/debrief`, {
      text: "We decided to host the server on Vercel with Neon. The Telegram webhook broke because of a missing secret. Next we record the demo video.",
    });
    expect(cands.length).toBe(3);
    const before = (await call<MemoryJob[]>("GET", `/api/memory-jobs?roomId=${room.id}`)).json.length;
    const { status, json: jobs } = await call<MemoryJob[]>("POST", "/api/candidates/decide", {
      decisions: [
        { id: cands[0].id, keep: true },
        { id: cands[1].id, keep: true, type: "failure" },
        { id: cands[2].id, keep: false },
      ],
    });
    expect(status).toBe(202);
    expect(jobs.length).toBe(2);
    expect(jobs[1].agent).toBe("builder");
    const after = (await call<MemoryJob[]>("GET", `/api/memory-jobs?roomId=${room.id}`)).json.length;
    expect(after - before).toBe(2);
    expect((await call<Candidate[]>("GET", `/api/rooms/${room.id}/candidates`)).json.length).toBe(0);
  });

  it("turns 👎 with a reason into a CEO feedback memory", async () => {
    const { json: b } = await call<Brief>("GET", `/api/rooms/${room.id}/brief/latest`);
    const { json } = await call<{ job: MemoryJob }>("POST", `/api/briefs/${b.id}/feedback`, { rating: "down", reason: "Too long, keep it to five lines" });
    expect(json.job.namespace).toBe("aquahab:ceo");
    expect(json.job.type).toBe("feedback");
    expect(json.job.agent).toBe("keeper");
  });

  it("never says the crew read the feedback when no model wrote the brief", async () => {
    await drain();
    const { json } = await call<Brief>("POST", `/api/rooms/${room.id}/brief`);
    expect(json.source).toBe("fallback");
    expect(json.sections.flatMap((s) => s.lines).some((l) => l.text.startsWith("I gave the crew"))).toBe(false);
  });

  it("lists the room's memory wall with types and authors", async () => {
    await drain();
    const { json } = await call<MemoriesResponse>("GET", `/api/rooms/${room.id}/memories`);
    expect(json.namespace).toBe(room.namespace);
    expect(json.memories.length).toBeGreaterThanOrEqual(6);
    expect(json.counts.decision).toBeGreaterThanOrEqual(2);
    expect(json.memories.every((m) => m.agent && m.type)).toBe(true);
  });

  it("reports mock mode honestly in health", async () => {
    const { json } = await call("GET", "/api/health");
    expect(json.mode).toBe("mock");
    expect(json.tatum.ok).toBe(false);
    expect(json.queue.stored).toBeGreaterThanOrEqual(7);
  });

  it("rejects writes without the CEO session", async () => {
    process.env.AUTH = "on";
    const r = await call("POST", `/api/rooms/${room.id}/capture`, { text: "d: should be refused" });
    process.env.AUTH = "off";
    expect(r.status).toBe(401);
  });

  it("returns 404 for an unknown room", async () => {
    expect((await call("GET", "/api/rooms/nope/memories")).status).toBe(404);
  });
});

describe("the Keeper's feedback lines", () => {
  const ceo = (type: string, body: string, date = "2026-11-07") => ({ code: "c1", blobId: `blob-${type}`, text: `[${type}][ceo][${date}][by:keeper] ${body}` });

  it("reads a rating with or without a reason, and a preference", () => {
    expect(ceoLines([ceo("feedback", "CEO found the Aquahab brief (day 4) not useful.")])).toEqual([
      { text: "I gave the crew your feedback from 7 Nov on the Aquahab brief (day 4): not useful.", cites: ["blob-feedback"] },
    ]);
    expect(ceoLines([ceo("feedback", "CEO found the Aquahab brief (day 4) not useful: Too long, keep it to five lines.")])[0].text).toBe(
      'I gave the crew your feedback from 7 Nov on the Aquahab brief (day 4): not useful, "Too long, keep it to five lines".',
    );
    expect(ceoLines([ceo("preference", "Keep the brief short.", "2026-11-06")])[0].text).toBe('I gave the crew your preference from 6 Nov: "Keep the brief short".');
  });
});

describe("caching proofs", () => {
  it("does not keep a value the caller marks incomplete", async () => {
    let loads = 0;
    const load = async () => ({ n: ++loads });
    await cached("t:incomplete", 300, load, () => false);
    await cached("t:incomplete", 300, load, () => false);
    expect(loads).toBe(2);
    await cached("t:complete", 300, load);
    await cached("t:complete", 300, load);
    expect(loads).toBe(3);
  });

  it("does not cache a receipt the chain has not confirmed yet", async () => {
    const blobId = (await call<MemoriesResponse>("GET", `/api/rooms/${room.id}/memories`)).json.memories[0].blobId;
    const r = await call("GET", `/api/memories/${blobId}/receipt`);
    expect(r.status).toBe(200);
    expect(r.json.blobObjectId).toBeNull(); // no chain index in mock mode
    expect(Number((await q(`select count(*) as n from cache where key = $1`, [`receipt:${blobId}`]))[0].n)).toBe(0);
  });
});
