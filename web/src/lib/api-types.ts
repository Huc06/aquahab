// GENERATED from server/src/contract.ts by `pnpm contract:sync` in server/. Do not edit here.
// Aquahab API contract: the one source of truth for the JSON shapes the server returns and the web app
// consumes. `pnpm contract:sync` copies this file to web/src/lib/api-types.ts; CI fails if they differ.
// Keep it dependency-free (types and constants only) so both sides can import it.

/** The crew. Internal ids match web/src/lib/types.ts AgentId, plus the Walrus Keeper (the write gate). */
export type Role = "one" | "researcher" | "builder" | "lofi" | "hippo" | "keeper";
export const ROLES: readonly Role[] = ["one", "researcher", "builder", "lofi", "hippo", "keeper"] as const;

/** What a memory records. The type lives in the memory text itself, because recall has no tag filters. */
export type MemoryType =
  | "decision" // what was chosen and why (One)
  | "failure" // what broke, and the fix if known (Builder)
  | "done" // what shipped or changed (Builder)
  | "next" // an open next step (One)
  | "learned" // an open question that got answered (Researcher)
  | "deadline" // dates and commitments (Hippo)
  | "story" // demo, blog and positioning notes (Lofi)
  | "preference" // how the CEO wants to be briefed (Keeper, CEO namespace)
  | "feedback"; // the CEO's rating of a brief (Keeper, CEO namespace)

export const MEMORY_TYPES: readonly MemoryType[] = [
  "decision",
  "failure",
  "done",
  "next",
  "learned",
  "deadline",
  "story",
  "preference",
  "feedback",
] as const;

/** Which crew member files (signs) each memory type. */
export const FILED_BY: Record<MemoryType, Role> = {
  decision: "one",
  next: "one",
  failure: "builder",
  done: "builder",
  learned: "researcher",
  deadline: "hippo",
  story: "lofi",
  preference: "keeper",
  feedback: "keeper",
};

export interface CrewProfile {
  role: Role;
  name: string; // display name, also the on-chain delegate key label
  title: string; // DECISIONS.md §10 role titles
  section: string; // the morning-brief section this member writes
}

export const CREW: Record<Role, CrewProfile> = {
  one: { role: "one", name: "One", title: "Chief of Staff", section: "Next steps" },
  builder: { role: "builder", name: "Builder", title: "Head of Engineering", section: "What changed and what broke" },
  researcher: { role: "researcher", name: "Researcher", title: "Head of Research", section: "Open questions and what we learned" },
  hippo: { role: "hippo", name: "Hippo", title: "Head of Finance & Ops", section: "Deadlines" },
  lofi: { role: "lofi", name: "Lofi", title: "Head of Growth", section: "Story and demo notes" },
  keeper: { role: "keeper", name: "Walrus Keeper", title: "Keeper of Memory", section: "Memory" },
};

// ---------- rooms ----------

/** One real project. Each room is exactly one Walrus Memory namespace. */
export interface Room {
  id: string;
  slug: string;
  name: string;
  /** What the CEO is trying to achieve here. Optional. */
  goal: string | null;
  /** `aquahab:room:<slug>`, or an HMAC alias when `private` (namespace names are public on-chain). */
  namespace: string;
  private: boolean;
  /** Local "HH:MM" in the CEO's timezone. */
  briefAt: string;
  debriefAt: string;
  timezone: string;
  memoryCount: number;
  lastBriefAt: string | null;
  createdAt: string;
  /** Day N of the crew remembering this room (1 on the day it was created). */
  dayIndex: number;
  /**
   * How each crew member is labelled in this room ("Brand Voice" for Lofi in a creator room). Wording only:
   * the canonical titles in CREW and the memory types stay the same. null when the room has none.
   */
  contextTags: ContextTags | null;
}

/** A label per crew member, at most CONTEXT_TAG_MAX characters each. */
export type ContextTags = Partial<Record<Role, string>>;
export const CONTEXT_TAG_MAX = 40;

/** One-click lenses for the room form. */
export const CONTEXT_PRESETS: Record<"creator", ContextTags> = {
  creator: {
    one: "Content Strategy",
    researcher: "Trends & Signals",
    builder: "Tech & Distribution",
    hippo: "Deals & Ops",
    lofi: "Brand Voice",
  },
};

export interface CreateRoomRequest {
  slug: string;
  name: string;
  goal?: string;
  private?: boolean;
  briefAt?: string;
  debriefAt?: string;
  contextTags?: ContextTags;
}

export interface UpdateRoomRequest {
  name?: string;
  /** An empty string clears the goal. */
  goal?: string;
  briefAt?: string;
  debriefAt?: string;
  /** Replaces the room's tags; {} clears them. */
  contextTags?: ContextTags;
}

/** The quick-capture prefix for each type the CEO can file (feedback comes from rating a brief). */
export const CAPTURE_PREFIX: Record<Exclude<MemoryType, "feedback">, string> = {
  decision: "d:",
  failure: "f:",
  next: "n:",
  done: "done:",
  learned: "l:",
  deadline: "due:",
  story: "s:",
  preference: "p:",
};

// ---------- briefs ----------

export interface BriefLine {
  text: string;
  /** Walrus blob ids of the memories this line was built from. Every id is in the brief's recall set. */
  cites: string[];
}

export interface BriefSection {
  agent: Role;
  title: string;
  lines: BriefLine[];
}

export interface Brief {
  id: string;
  roomId: string;
  createdAt: string;
  dayIndex: number;
  kind: "morning" | "manual" | "day-one";
  /** How many memories were recalled from Walrus to write it (0 on day one). */
  recalled: number;
  /** "llm": written by the model; "fallback": assembled without the model; "empty": no memory yet. */
  source: "llm" | "fallback" | "empty";
  /** True when Walrus recall came back empty but the ledger had memories (see FRICTION.md). */
  degraded: boolean;
  sections: BriefSection[];
  feedback: "up" | "down" | null;
}

export interface BriefFeedbackRequest {
  rating: "up" | "down";
  reason?: string;
}

// ---------- the write lifecycle ----------

/** Mirrors the Walrus Memory write lifecycle: accepted job → running → done with a blob id. */
export type MemoryJobStatus = "queued" | "pending" | "stored" | "failed";

export interface MemoryJob {
  jobId: string;
  status: MemoryJobStatus;
  blobId: string | null;
  agent: Role;
  roomId: string | null; // null for the CEO namespace
  namespace: string;
  type: MemoryType;
  /** The memory body without the `[type][room][date][by:agent]` prefix. */
  text: string;
  error: string | null;
  createdAt: string;
  storedAt: string | null;
  /** True when the Keeper's redaction removed something credential-shaped before the write. */
  redacted: boolean;
}

export interface CaptureRequest {
  /** Free text, or a quick-capture prefix: `d:` decision, `f:` failure, `n:` next, `done:`, `l:` learned, `due:` deadline, `s:` story, `p:` preference. */
  text: string;
}

// ---------- the evening debrief ----------

export interface Candidate {
  id: string;
  roomId: string;
  type: MemoryType;
  agent: Role;
  text: string;
  source: "debrief" | "feedback" | "capture";
  status: "proposed" | "kept" | "dropped";
  jobId: string | null;
  /** Blob id of an older memory this one replaces, when the crew spotted it. */
  supersedes: string | null;
  createdAt: string;
}

export interface DebriefRequest {
  /** The CEO's own words about the day. */
  text: string;
}

export interface CandidateDecision {
  id: string;
  keep: boolean;
  text?: string; // edited text
  type?: MemoryType; // corrected type
}

export interface DecideRequest {
  decisions: CandidateDecision[];
}

// ---------- memories ----------

export interface Memory {
  blobId: string;
  type: MemoryType | null;
  text: string | null; // null when the text has not been recalled yet (e.g. a contractor's write)
  agent: Role | null; // parsed from `[by:<role>]`
  /** The delegate key that signed the write (Ed25519 public key hex), from the relayer. */
  agentId: string | null;
  agentLabel: string | null; // on-chain label of agentId, e.g. "Builder" or "Claude Code"
  roomId: string | null;
  namespace: string;
  createdAt: string;
  expiresAt: string | null;
  endEpoch: number | null;
  /** The Walrus Blob object on Sui (read through Tatum), when found. */
  blobObjectId: string | null;
  verified: boolean;
  checkedAt: string | null;
  supersedes: string | null;
  supersededBy: string | null;
  imported: boolean;
}

export interface MemoriesResponse {
  roomId: string;
  namespace: string;
  memories: Memory[];
  counts: Partial<Record<MemoryType, number>>;
  verifiedCount: number;
  checkedAt: string;
}

export interface RecallHit {
  blobId: string;
  text: string;
  distance: number;
  createdAt: string | null;
}

export interface RecallResponse {
  roomId: string;
  query: string;
  hits: RecallHit[];
  latencyMs: number;
}

/** On-chain receipt of one memory, read live from Sui through Tatum. */
export interface MemoryReceipt {
  blobId: string;
  blobIdU256: string;
  blobObjectId: string | null;
  namespaceOnChain: string | null;
  endEpoch: number | null;
  size: number | null;
  lastTx: string | null;
  checkpoint: string | null;
  storedAt: string | null;
  links: { suiscan: string | null; walruscan: string };
}

// ---------- crew (from Sui via Tatum) ----------

export interface CrewMember {
  role: Role | null; // null for a key whose label is not a crew role (e.g. a Claude Code contractor)
  name: string;
  title: string | null;
  label: string; // on-chain label
  publicKey: string; // 64 hex, no 0x (this is MEMWAL_AGENT_ID for that key)
  suiAddress: string;
  hiredAt: string | null;
  hireTx: string | null;
  employed: boolean;
  memoryCount: number;
}

export interface CrewEvent {
  kind: "hired" | "fired";
  label: string;
  publicKey: string | null;
  at: string | null;
  tx: string | null;
}

export interface CrewResponse {
  accountId: string;
  owner: string;
  agents: CrewMember[];
  /** Crew roles with no key on the account right now (fired, or never hired). */
  vacancies: Role[];
  history: CrewEvent[];
  source: "tatum-grpc" | "relayer" | "config";
  checkedAt: string;
}

// ---------- health and proof ----------

export interface HealthResponse {
  mode: "mainnet" | "mock";
  relayer: { status: "ok" | "down"; writes: "ok" | "degraded" | "paused"; version: string | null };
  tatum: { ok: boolean; epoch: string | null; checkpoint: string | null; latencyMs: number | null };
  llm: { ok: boolean; model: string | null };
  queue: { queued: number; pending: number; failed: number; stored: number };
  checkedAt: string;
}

export interface ProofResponse {
  accountId: string;
  owner: string;
  memories: number; // relayer count across aquahab namespaces
  onChain: number; // matched Walrus Blob objects owned by the account owner
  byNamespace: { namespace: string; relayer: number; onChain: number }[];
  byAgent: { label: string; publicKey: string; memories: number }[];
  firstMemoryAt: string | null;
  checkedAt: string;
}

// ---------- live events (SSE) ----------

export type AquahabEvent =
  | { type: "memory.queued"; job: MemoryJob }
  | { type: "memory.stored"; job: MemoryJob }
  | { type: "memory.failed"; job: MemoryJob }
  | { type: "recall.used"; roomId: string; blobIds: string[]; purpose: string }
  | { type: "brief.created"; roomId: string; briefId: string }
  | { type: "standup.created"; roomId: string; standupId: string }
  | { type: "crew.changed"; roles: Role[] };

export interface ApiError {
  error: string;
  detail?: string;
}

// ---------- link helpers ----------

export const suiscanObject = (id: string) => `https://suiscan.xyz/mainnet/object/${id}`;
export const suiscanTx = (digest: string) => `https://suiscan.xyz/mainnet/tx/${digest}`;
export const walruscanBlob = (blobId: string) => `https://walruscan.com/mainnet/blob/${blobId}`;

// ---------- board (derived from the memories the crew has filed) ----------

export type BoardColumn = "backlog" | "blocked" | "decided" | "done";

export interface BoardCard {
  jobId: string;
  blobId: string | null;
  type: MemoryType;
  text: string;
  agent: Role;
  createdAt: string;
}

export interface BoardResponse {
  roomId: string;
  columns: { column: BoardColumn; title: string; cards: BoardCard[] }[];
}

// ---------- creator studio: draft and ask the crew (nothing here is stored) ----------

/** POST /api/rooms/:id/draft. The crew drafts from the room's voice, story and failure memories. */
export interface DraftRequest {
  /** What to write about, in the CEO's words. */
  idea: string;
  /** Who drafts (default "lofi"). */
  agent?: Role;
  /** Rework `previous` in one direction. */
  refine?: "edgier" | "shorter" | "anecdote";
  previous?: string;
}

/** A memory the draft followed or steered clear of. */
export interface DraftRule {
  blobId: string;
  text: string;
  agent: Role;
  kind: "follow" | "avoid";
}

export interface DraftResponse {
  roomId: string;
  agent: Role;
  draft: string;
  rules: DraftRule[];
  /** How many memories the crew recalled for this draft. */
  recalled: number;
  source: "llm" | "fallback";
  model: string | null;
}

/** POST /api/rooms/:id/chat. Ephemeral: the message and the replies are not stored anywhere. */
export interface ChatRequest {
  message: string;
  /** One member, or "all" (only members with relevant memories reply). */
  agent: Role | "all";
}

export interface ChatReply {
  agent: Role;
  text: string;
  /** Blob ids the reply is based on. A reply that cites nothing real is dropped. */
  cites: string[];
}

/** A memory the crew suggests keeping. Commit it by POSTing `capture` to /api/rooms/:id/capture. */
export interface ChatProposal {
  type: Exclude<MemoryType, "feedback">;
  /** Who will sign it (FILED_BY[type]). */
  agent: Role;
  text: string;
  /** The capture text, prefix included, for example "d: Focus the next two weeks on …". */
  capture: string;
}

export interface ChatResponse {
  roomId: string;
  replies: ChatReply[];
  proposal: ChatProposal | null;
  recalled: number;
  source: "llm" | "fallback";
  model: string | null;
}

// ---------- the memory switch ----------

/** POST /api/rooms/:id/compare. The same question answered without memory, then from the room's memory. Stores nothing. */
export interface CompareRequest {
  question: string;
}

export interface CompareAnswer {
  text: string;
  /** Blob ids the answer rests on. Always empty without memory. */
  cites: string[];
  source: "llm" | "fallback";
}

export interface CompareResponse {
  roomId: string;
  question: string;
  /** A capable model that has never seen this project: no recall is made. */
  withoutMemory: CompareAnswer;
  /** The same question, answered only from what was recalled from Walrus. An answer that cites nothing says so. */
  withMemory: CompareAnswer & { recalled: number };
}

// ---------- the crew standup ----------

/** One turn of the standup: a member speaks to the crew (`to: null`) or answers another member. */
export interface StandupTurn {
  agent: Role;
  /** The member this turn answers, or null when it speaks to the whole crew. */
  to: Role | null;
  text: string;
  /** Blob ids the turn is based on. A turn that cites nothing real is dropped. */
  cites: string[];
}

/**
 * The crew talking to each other about one room, from its memories: after the morning brief, or on demand.
 * Kept in the ledger, never on Walrus: it is a conversation about memories, not a new memory.
 * The office plays the turns in order (`standup.created` announces a new one).
 */
export interface Standup {
  id: string;
  roomId: string;
  createdAt: string;
  dayIndex: number;
  turns: StandupTurn[];
  /** How many memories were recalled from Walrus to hold it. */
  recalled: number;
  /** "llm": written by the model; "fallback": each member reads out its newest memory. */
  source: "llm" | "fallback";
  model: string | null;
}
