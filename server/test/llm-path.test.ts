// The LLM path end to end, against a local OpenAI-compatible server (the same wire format as Groq, OpenRouter
// or Ollama): the real provider, structured output, the prompt we send, and how replies are checked against
// the recall. The fake model also misbehaves on purpose (made-up codes, a member who may not speak).
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brief, ChatResponse, CompareResponse, DraftResponse, MemoriesResponse, MemoryJob, Room, Standup } from "../src/contract.ts";

const seen: { system: string; user: string; format: any; model: string }[] = [];
let server: Server;
let flakyFailed = false;

function reply(content: unknown) {
  return {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "fake",
    choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(content) }, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
  };
}

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      const body = JSON.parse(raw);
      const system = body.messages.find((m: any) => m.role === "system")?.content ?? "";
      const user = body.messages.find((m: any) => m.role === "user")?.content ?? "";
      const text = typeof user === "string" ? user : user.map((p: any) => p.text).join("");
      seen.push({ system, user: text, format: body.response_format, model: body.model });
      if (text.includes("Idea: flaky") && !flakyFailed) {
        // What Groq answers when a sample fails the schema.
        flakyFailed = true;
        res.writeHead(400, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: { message: "Failed to generate JSON. Please adjust your prompt.", type: "invalid_request_error", code: "json_validate_failed" } }));
      }
      let out: unknown = {};
      if (system.includes("You draft a post")) out = { draft: "Everyone says models are the moat. [your number] says otherwise.", follow: ["m1", "m42"], avoid: ["m2"] };
      else if (system.includes("The CEO asks the crew")) {
        out = {
          replies: [
            { agent: "one", text: "We read Sui through Tatum gRPC and GraphQL.", cites: ["m1"] },
            { agent: "hippo", text: "Not allowed to speak here.", cites: ["m1"] },
            { agent: "builder", text: "Cites nothing real.", cites: ["m77"] },
          ],
          proposal: { type: "decision", text: "  Keep Tatum   GraphQL for events  " },
        };
      } else if (system.includes("short standup")) {
        const code = (word: string) => text.match(new RegExp(`^(m\\d+) .*${word}`, "m"))?.[1] ?? "m0";
        out = text.includes("Project: Thin room")
          ? { turns: [{ agent: "builder", to: null, text: "Cites a decision, not my domain.", cites: [code("Tatum")] }] }
          : {
              turns: [
                { agent: "one", to: null, text: "We keep reading Sui through Tatum.", cites: [code("Tatum")] },
                { agent: "builder", to: "one", text: "Listicles flopped, so not that format.", cites: [code("Listicles")] },
                { agent: "hippo", to: null, text: "Not in this standup.", cites: [code("Tatum")] },
                { agent: "builder", to: "builder", text: "  Talking   to myself. ", cites: [code("Listicles"), "m99"] },
                { agent: "builder", to: null, text: "Out of my domain.", cites: [code("Tatum")] },
                { agent: "one", to: "lofi", text: "Made up.", cites: ["m42"] },
              ],
            };
      } else if (system.includes("morning brief")) out = { sections: [{ agent: "one", lines: [{ text: "Ship the deploy (m1).", cites: ["m1"] }] }] };
      else if (system.includes("with no memory of the project")) out = { answer: "I have no record of this project, so I cannot say how you read Sui." };
      else if (system.includes("Answer the CEO's question")) {
        const code = text.match(/^(m\d+) .*Tatum/m)?.[1] ?? "m0";
        out = text.includes("Question: uncited") ? { answer: "Something I made up.", cites: ["m42"] } : { answer: `Through Tatum gRPC and GraphQL (${code}).`, cites: [code, "m42"] };
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(reply(out)));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.LLM_PROVIDER = "openai-compatible";
  process.env.LLM_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  process.env.LLM_API_KEY = "test-key-not-real";
  process.env.LLM_MODEL = "fake-main";
  process.env.LLM_FAST_MODEL = "fake-fast";
});

afterAll(async () => {
  const { closeDb } = await import("../src/db.ts");
  await closeDb();
  server.close();
});

// Imported lazily so the env above is in place before the provider is created.
const load = async () => {
  const { app } = await import("../src/app.ts");
  const { processQueue } = await import("../src/memory/keeper.ts");
  const call = async <T = any>(method: string, path: string, body?: unknown) => {
    const r = await app.request(path, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: (await r.json()) as T };
  };
  return { call, processQueue };
};

describe("LLM path (OpenAI-compatible provider)", () => {
  let room: Room;
  let blobs: string[];
  let blobOf: (word: string) => string;
  let call: Awaited<ReturnType<typeof load>>["call"];
  let processQueue: Awaited<ReturnType<typeof load>>["processQueue"];

  beforeAll(async () => {
    const l = await load();
    call = l.call;
    processQueue = l.processQueue;
    room = (await call<Room>("POST", "/api/rooms", { slug: "llm", name: "LLM room", goal: "Ship it", contextTags: { lofi: "Brand Voice" } })).json;
    await call("POST", `/api/rooms/${room.id}/capture`, { text: "d: Read Sui through Tatum gRPC and GraphQL" });
    await call("POST", `/api/rooms/${room.id}/capture`, { text: "f: Listicles flopped" });
    for (let i = 0; i < 5; i++) await l.processQueue({ sleep: async () => {} });
    const wall = (await call<MemoriesResponse>("GET", `/api/rooms/${room.id}/memories`)).json.memories;
    blobs = wall.map((m) => m.blobId);
    blobOf = (word) => wall.find((m) => m.text?.includes(word))!.blobId;
    expect(blobs).toHaveLength(2);
  });

  it("sends structured output and the room context as data", async () => {
    const r = await call<DraftResponse>("POST", `/api/rooms/${room.id}/draft`, { idea: "the moat" });
    expect(r.status).toBe(200);
    expect(r.json.source).toBe("llm");
    expect(r.json.model).toBe("openai-compatible:fake-main");
    const req = seen.find((s) => s.system.includes("You draft a post"))!;
    expect(req.model).toBe("fake-main");
    expect(req.format?.type).toBe("json_schema");
    expect(req.system).toContain("Lofi, Head of Growth (in this room: Brand Voice)");
    expect(req.user).toContain("Room goal: Ship it");
    expect(req.user).toContain("Room lens: lofi = Brand Voice");
    expect(req.user).toContain("Idea: the moat");
  });

  it("maps draft codes to blob ids and drops codes the model made up", async () => {
    const r = await call<DraftResponse>("POST", `/api/rooms/${room.id}/draft`, { idea: "the moat" });
    expect(r.json.draft).toContain("[your number]");
    expect(r.json.rules).toHaveLength(2); // m42 does not exist
    expect(r.json.rules.map((x) => x.kind)).toEqual(["follow", "avoid"]);
    for (const rule of r.json.rules) expect(blobs).toContain(rule.blobId);
  });

  it("keeps only allowed, cited replies, and turns the proposal into a capture line", async () => {
    const r = await call<ChatResponse>("POST", `/api/rooms/${room.id}/chat`, { message: "How do we read Sui?", agent: "all" });
    expect(r.json.source).toBe("llm");
    expect(r.json.model).toBe("openai-compatible:fake-main"); // group mode uses the main model
    // hippo was not given the floor (no deadline memories); builder cited a code that was never recalled.
    expect(r.json.replies.map((x) => x.agent)).toEqual(["one"]);
    expect(blobs).toContain(r.json.replies[0].cites[0]);
    expect(r.json.proposal).toEqual({ type: "decision", agent: "one", text: "Keep Tatum GraphQL for events", capture: "d: Keep Tatum GraphQL for events" });
    const req = seen.filter((s) => s.system.includes("The CEO asks the crew")).at(-1)!;
    expect(req.user).toMatch(/Who answers: one, builder$/m);
  });

  it("retries once when the provider rejects a sample (json_validate_failed)", async () => {
    const before = seen.length;
    const r = await call<DraftResponse>("POST", `/api/rooms/${room.id}/draft`, { idea: "flaky" });
    expect(flakyFailed).toBe(true);
    expect(r.json.source).toBe("llm");
    expect(seen.length - before).toBe(2);
  });

  it("asks one question without memory and from memory: the blank side never sees a memory", async () => {
    const before = seen.length;
    const r = await call<CompareResponse>("POST", `/api/rooms/${room.id}/compare`, { question: "How do we read Sui?" });
    expect(r.status).toBe(200);
    expect(r.json.withoutMemory).toEqual({ text: "I have no record of this project, so I cannot say how you read Sui.", cites: [], source: "llm" });
    expect(r.json.withMemory).toEqual({ text: "Through Tatum gRPC and GraphQL.", cites: [blobOf("Tatum")], source: "llm", recalled: 2 }); // m42 dropped, code out of the text
    const calls = seen.slice(before);
    expect(calls).toHaveLength(2);
    const blank = calls.find((s) => s.system.includes("with no memory of the project"))!;
    expect(blank.model).toBe("fake-fast");
    expect(blank.user).toBe("Question: How do we read Sui?");
    expect(blank.system + blank.user).not.toMatch(/Tatum|Listicles|Ship it|Brand Voice/); // no memory, goal or lens
    const memory = calls.find((s) => s.system.includes("using only the memories given"))!;
    expect(memory.model).toBe("fake-main");
    expect(memory.user).toContain("Read Sui through Tatum gRPC and GraphQL");
  });

  it("does not present an uncited answer as memory", async () => {
    const r = await call<CompareResponse>("POST", `/api/rooms/${room.id}/compare`, { question: "uncited" });
    expect(r.json.withMemory).toEqual({ text: "Nothing in this room's memory answers that yet.", cites: [], source: "llm", recalled: 2 });
  });

  it("uses the fast model one-on-one", async () => {
    const r = await call<ChatResponse>("POST", `/api/rooms/${room.id}/chat`, { message: "What did we decide?", agent: "one" });
    expect(r.json.model).toBe("openai-compatible:fake-fast");
    expect(seen.at(-1)!.model).toBe("fake-fast");
  });

  it("lets the crew talk to each other, keeping only cited turns in each member's domain", async () => {
    const r = await call<Standup>("POST", `/api/rooms/${room.id}/standup`);
    expect(r.status).toBe(201);
    expect(r.json.source).toBe("llm");
    expect(r.json.model).toBe("openai-compatible:fake-main");
    const [d, f] = [blobOf("Tatum"), blobOf("Listicles")];
    expect(r.json.turns).toEqual([
      { agent: "one", to: null, text: "We keep reading Sui through Tatum.", cites: [d] },
      { agent: "builder", to: "one", text: "Listicles flopped, so not that format.", cites: [f] },
      { agent: "builder", to: null, text: "Talking to myself.", cites: [f] },
    ]);
    const req = seen.filter((s) => s.system.includes("short standup")).at(-1)!;
    expect(req.user).toMatch(/^Who is here: one, builder$/m);
    expect(req.user).toContain("Room goal: Ship it");
    expect(req.system).toContain("compare every next memory with every done memory");
    expect(req.system).toContain("When no next step is open, one opens by saying so");
  });

  it("reads the memories out when none of the model's turns survive", async () => {
    const thin = (await call<Room>("POST", "/api/rooms", { slug: "thin", name: "Thin room" })).json;
    await call("POST", `/api/rooms/${thin.id}/capture`, { text: "d: Read Sui through Tatum gRPC" });
    await call("POST", `/api/rooms/${thin.id}/capture`, { text: "f: Listicles flopped again" });
    for (let i = 0; i < 5; i++) await processQueue({ sleep: async () => {} });
    const r = await call<Standup>("POST", `/api/rooms/${thin.id}/standup`);
    expect(r.status).toBe(201);
    expect(r.json.source).toBe("fallback");
    expect(r.json.model).toBeNull();
    expect(r.json.turns.map((t) => [t.agent, t.text])).toEqual([
      ["one", "Read Sui through Tatum gRPC"],
      ["builder", "Listicles flopped again"],
    ]);
  });

  it("puts the goal and lens in the brief prompt", async () => {
    const r = await call("POST", `/api/rooms/${room.id}/brief`);
    expect(r.status).toBe(201);
    const req = seen.filter((s) => s.system.includes("morning brief")).at(-1)!;
    expect(req.user).toContain("Room goal: Ship it");
    expect(req.system).toContain("Use the lens labels");
  });

  it("keeps one to open next steps and keeps codes out of the text", async () => {
    const r = await call<Brief>("POST", `/api/rooms/${room.id}/brief`);
    expect(r.json.sections.find((s) => s.agent === "one")?.lines.map((l) => l.text)).toEqual(["Ship the deploy."]);
    const req = seen.filter((s) => s.system.includes("morning brief")).at(-1)!;
    expect(req.system).toContain("compare every next memory with every done memory");
    expect(req.system).toContain("A decision is not a task");
    expect(req.system).toContain("Never make up a next step that no memory states");
  });

  it("names the CEO feedback the crew read, with its receipt", async () => {
    const first = await call<Brief>("POST", `/api/rooms/${room.id}/brief`);
    const fb = await call<{ job: MemoryJob }>("POST", `/api/briefs/${first.json.id}/feedback`, { rating: "down", reason: "Too long, keep it to five lines." });
    for (let i = 0; i < 5; i++) await processQueue({ sleep: async () => {} });
    const stored = (await call<MemoryJob>("GET", `/api/memory-jobs/${fb.json.job.jobId}`)).json;
    expect(stored.status).toBe("stored");

    const next = await call<Brief>("POST", `/api/rooms/${room.id}/brief`);
    const keeper = next.json.sections.find((s) => s.agent === "keeper")!;
    const named = keeper.lines.filter((l) => l.text.startsWith("I gave the crew your"));
    expect(named).toHaveLength(1);
    expect(named[0].text).toMatch(/^I gave the crew your feedback from \d{1,2} [A-Z][a-z]{2} on the LLM room brief \(day \d+\): not useful, "Too long, keep it to five lines"\.$/);
    expect(named[0].cites).toEqual([stored.blobId]);
    expect(keeper.lines[0].text).toMatch(/memories in this room/); // the count stays first

    const req = seen.filter((s) => s.system.includes("morning brief")).at(-1)!;
    expect(req.user).toContain("Too long, keep it to five lines"); // the model was given it
  });
});
