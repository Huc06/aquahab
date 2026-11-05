// The LLM path end to end, against a local OpenAI-compatible server (the same wire format as Groq, OpenRouter
// or Ollama): the real provider, structured output, the prompt we send, and how replies are checked against
// the recall. The fake model also misbehaves on purpose (made-up codes, a member who may not speak).
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ChatResponse, DraftResponse, MemoriesResponse, Room } from "../src/contract.ts";

const seen: { system: string; user: string; format: any; model: string }[] = [];
let server: Server;

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
      } else if (system.includes("morning brief")) out = { sections: [{ agent: "one", lines: [{ text: "Ship the deploy.", cites: ["m1"] }] }] };
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
  let call: Awaited<ReturnType<typeof load>>["call"];

  beforeAll(async () => {
    const l = await load();
    call = l.call;
    room = (await call<Room>("POST", "/api/rooms", { slug: "llm", name: "LLM room", goal: "Ship it", contextTags: { lofi: "Brand Voice" } })).json;
    await call("POST", `/api/rooms/${room.id}/capture`, { text: "d: Read Sui through Tatum gRPC and GraphQL" });
    await call("POST", `/api/rooms/${room.id}/capture`, { text: "f: Listicles flopped" });
    for (let i = 0; i < 5; i++) await l.processQueue({ sleep: async () => {} });
    blobs = (await call<MemoriesResponse>("GET", `/api/rooms/${room.id}/memories`)).json.memories.map((m) => m.blobId);
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

  it("uses the fast model one-on-one", async () => {
    const r = await call<ChatResponse>("POST", `/api/rooms/${room.id}/chat`, { message: "What did we decide?", agent: "one" });
    expect(r.json.model).toBe("openai-compatible:fake-fast");
    expect(seen.at(-1)!.model).toBe("fake-fast");
  });

  it("puts the goal and lens in the brief prompt", async () => {
    const r = await call("POST", `/api/rooms/${room.id}/brief`);
    expect(r.status).toBe(201);
    const req = seen.filter((s) => s.system.includes("morning brief")).at(-1)!;
    expect(req.user).toContain("Room goal: Ship it");
    expect(req.system).toContain("Use the lens labels");
  });
});
