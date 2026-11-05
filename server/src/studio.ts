// Creator studio: draft in the CEO's voice, and ask the crew. Both recall first, and neither stores anything:
// a draft or a chat reply reaches Walrus only when the CEO commits a one-line memory through /capture.
import {
  CAPTURE_PREFIX,
  FILED_BY,
  ROLES,
  type ChatReply,
  type ChatRequest,
  type ChatResponse,
  type DraftRequest,
  type DraftResponse,
  type DraftRule,
  type MemoryType,
  type Role,
  type Room,
} from "./contract.ts";
import { ActionError } from "./actions.ts";
import { composeDraft, crewChat, DOMAIN, SPEAKERS, type CodedMemory, type Speaker } from "./llm.ts";
import { parseMemory } from "./memory/format.ts";
import { recall } from "./memory/walrus.ts";
import { CEO_NAMESPACE } from "./rooms.ts";

const MAX_INPUT = 1000;
const REFINES = ["edgier", "shorter", "anecdote"] as const;

/** Recall the room (and optionally the CEO's preferences), coded m1… and c1…, without duplicates. */
async function recallCoded(room: Room, query: string, purpose: string, as: Role, opts: { roomLimit: number; ceoLimit: number }): Promise<CodedMemory[]> {
  const [roomHits, ceoHits] = [
    await recall({ namespace: room.namespace, query, sort: "relevance", limit: opts.roomLimit, purpose, roomId: room.id, as }),
    opts.ceoLimit ? await recall({ namespace: CEO_NAMESPACE, query, sort: "relevance", limit: opts.ceoLimit, purpose, roomId: null, as: "keeper" }) : null,
  ];
  const seen = new Set<string>();
  const unique = <T extends { blob_id: string }>(hits: T[]) => hits.filter((h) => (seen.has(h.blob_id) ? false : (seen.add(h.blob_id), true)));
  return [
    ...unique(roomHits.hits).map((h, i) => ({ code: `m${i + 1}`, blobId: h.blob_id, text: h.text })),
    ...unique(ceoHits?.hits ?? []).map((h, i) => ({ code: `c${i + 1}`, blobId: h.blob_id, text: h.text })),
  ];
}

/** Who signed (or would sign) a memory: the [by:role] tag, else the member that files its type. */
function authorOf(text: string): Role {
  const p = parseMemory(text);
  return p.by ?? (p.type ? FILED_BY[p.type] : "keeper");
}

const isSpeaker = (r: unknown): r is Speaker => SPEAKERS.includes(r as Speaker);

// ---------- draft ----------

export async function draft(room: Room, req: DraftRequest): Promise<DraftResponse> {
  const idea = typeof req?.idea === "string" ? req.idea.trim() : "";
  if (!idea) throw new ActionError("Say what to write about: { idea }.");
  if (idea.length > MAX_INPUT) throw new ActionError(`Keep the idea under ${MAX_INPUT} characters.`);
  const agent: Role = req.agent ?? "lofi";
  if (!isSpeaker(agent)) throw new ActionError(`agent is one of ${SPEAKERS.join(", ")}.`);
  if (req.refine && !REFINES.includes(req.refine)) throw new ActionError(`refine is one of ${REFINES.join(", ")}.`);
  if (req.refine && !req.previous?.trim()) throw new ActionError("refine needs the previous draft.");

  const memories = await recallCoded(room, `voice rules, format, audience, what worked and what failed: ${idea}`, "draft", agent, { roomLimit: 15, ceoLimit: 6 });
  const out = await composeDraft({
    idea,
    agent,
    roomName: room.name,
    goal: room.goal,
    lens: room.contextTags,
    memories,
    refine: req.refine,
    previous: req.previous?.slice(0, 4000),
  });

  // Codes become receipts. A code the model made up is dropped; a memory is listed once.
  const byCode = new Map(memories.map((m) => [m.code, m]));
  const listed = new Set<string>();
  const rules: DraftRule[] = [];
  for (const [kind, codes] of [["avoid", out.avoid], ["follow", out.follow]] as const) {
    for (const code of codes) {
      const m = byCode.get(code);
      if (!m || listed.has(m.blobId)) continue;
      listed.add(m.blobId);
      rules.push({ blobId: m.blobId, text: parseMemory(m.text).body, agent: authorOf(m.text), kind });
    }
  }
  rules.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "follow" ? -1 : 1));
  return { roomId: room.id, agent, draft: out.draft.trim(), rules, recalled: memories.length, source: out.source, model: out.model };
}

// ---------- ask the crew ----------

export async function chat(room: Room, req: ChatRequest): Promise<ChatResponse> {
  const message = typeof req?.message === "string" ? req.message.trim() : "";
  if (!message) throw new ActionError("Write a message: { message, agent }.");
  if (message.length > MAX_INPUT) throw new ActionError(`Keep the message under ${MAX_INPUT} characters.`);
  const target = req.agent ?? "all";
  if (target !== "all" && !isSpeaker(target)) {
    throw new ActionError(ROLES.includes(target as Role) ? `${target} files memories but does not chat.` : `agent is "all" or one of ${SPEAKERS.join(", ")}.`);
  }

  const memories = await recallCoded(room, message, "chat", target === "all" ? "one" : target, { roomLimit: 20, ceoLimit: 4 });
  const roomMemories = memories.filter((m) => m.code.startsWith("m"));
  // In a group, only members whose domain shows up in the recall get the floor.
  const speakers: Speaker[] =
    target === "all"
      ? SPEAKERS.filter((s) => roomMemories.some((m) => DOMAIN[s].includes(parseMemory(m.text).type as MemoryType)))
      : [target];

  const out = speakers.length
    ? await crewChat({ message, roomName: room.name, goal: room.goal, lens: room.contextTags, memories, speakers, oneOnOne: target !== "all" })
    : { replies: [], proposal: null, source: "fallback" as const, model: null };

  const byCode = new Map(memories.map((m) => [m.code, m]));
  const allowed = new Set<Speaker>(speakers);
  const spoke = new Set<Speaker>();
  const replies: ChatReply[] = [];
  for (const r of out.replies) {
    if (!allowed.has(r.agent) || spoke.has(r.agent) || !r.text.trim()) continue;
    const cites = [...new Set(r.cites.map((c) => byCode.get(c)?.blobId).filter((b): b is string => !!b))];
    if (!cites.length) continue; // receipts or it didn't happen
    spoke.add(r.agent);
    replies.push({ agent: r.agent, text: r.text.trim(), cites });
  }
  if (!replies.length) {
    replies.push({ agent: target === "all" ? "one" : target, text: "Nothing in this room's memory answers that yet.", cites: [] });
  }

  const p = out.proposal;
  const proposalText = p?.text.replace(/\s+/g, " ").trim().slice(0, 300);
  const proposal =
    p && proposalText
      ? { type: p.type, agent: FILED_BY[p.type], text: proposalText, capture: `${CAPTURE_PREFIX[p.type]} ${proposalText}` }
      : null;
  return { roomId: room.id, replies, proposal, recalled: memories.length, source: out.source, model: out.model };
}
