// The memory line format. Walrus recall has no tag filters (walrus-memory #1109), so a memory carries its
// type, room, date and author in its own text:
//
//   [decision][aquahab][2026-11-04][by:one] Use Tatum GraphQL for events; JSON-RPC returns 404
//   [failure][aquahab][2026-11-05][by:builder][supersedes:<blob_id>] ...
//
// The prefix is readable by people, by the LLM, and by any other agent recalling the same namespace
// (e.g. Claude Code through the memwal plugin).
import { FILED_BY, MEMORY_TYPES, ROLES, type MemoryType, type Role } from "../contract.ts";

export interface MemoryLine {
  type: MemoryType;
  room: string; // room slug, or "ceo"
  date: string; // YYYY-MM-DD
  /** The crew member who files it, or "contractor" for an outside key on the payroll (Claude Code). */
  by: Role | "contractor";
  supersedes?: string | null;
  imported?: boolean;
  body: string;
}

export function formatMemory(m: MemoryLine): string {
  const tags = [`[${m.type}]`, `[${m.room}]`, `[${m.date}]`, `[by:${m.by}]`];
  if (m.supersedes) tags.push(`[supersedes:${m.supersedes}]`);
  if (m.imported) tags.push(`[imported]`);
  return `${tags.join("")} ${m.body.trim()}`;
}

const TAG = /^\[([^\]]+)\]/;

/** Parse a memory line. Returns null fields for text that does not follow the format (e.g. a contractor's note). */
export function parseMemory(text: string): {
  type: MemoryType | null;
  room: string | null;
  date: string | null;
  by: Role | null;
  supersedes: string | null;
  imported: boolean;
  body: string;
} {
  let rest = text.trim();
  const tags: string[] = [];
  for (let i = 0; i < 8; i++) {
    const m = rest.match(TAG);
    if (!m) break;
    tags.push(m[1]);
    rest = rest.slice(m[0].length);
  }
  const out = {
    type: null as MemoryType | null,
    room: null as string | null,
    date: null as string | null,
    by: null as Role | null,
    supersedes: null as string | null,
    imported: false,
    body: rest.trim(),
  };
  for (const t of tags) {
    if ((MEMORY_TYPES as readonly string[]).includes(t) && !out.type) out.type = t as MemoryType;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(t)) out.date = t;
    else if (t.startsWith("by:")) {
      const r = t.slice(3);
      if ((ROLES as readonly string[]).includes(r)) out.by = r as Role;
    } else if (t.startsWith("supersedes:")) out.supersedes = t.slice(11);
    else if (t === "imported") out.imported = true;
    else if (!out.room) out.room = t;
  }
  if (!tags.length) out.body = text.trim();
  return out;
}

// ---------- quick capture ----------

const PREFIXES: [RegExp, MemoryType][] = [
  [/^(d|decided|decision)\s*:\s*/i, "decision"],
  [/^(f|failed|fail|broke|bug)\s*:\s*/i, "failure"],
  [/^(n|next|todo)\s*:\s*/i, "next"],
  [/^(done|shipped|x)\s*:\s*/i, "done"],
  [/^(l|learned|til)\s*:\s*/i, "learned"],
  [/^(due|deadline|dl)\s*:\s*/i, "deadline"],
  [/^(s|story)\s*:\s*/i, "story"],
  [/^(p|pref|preference)\s*:\s*/i, "preference"],
];

/** `d: use GraphQL` → { type: "decision", body: "use GraphQL" }. Returns null type when there is no prefix. */
export function parseCapture(text: string): { type: MemoryType | null; body: string } {
  const t = text.trim();
  for (const [re, type] of PREFIXES) {
    if (re.test(t)) return { type, body: t.replace(re, "").trim() };
  }
  return { type: null, body: t };
}

/** Rough type guess used when the LLM is unavailable. */
export function guessType(body: string): MemoryType {
  const t = body.toLowerCase();
  if (/\b(broke|broken|fail|failed|error|bug|crash|regress|blocked)\b/.test(t)) return "failure";
  if (/\b(shipped|merged|deployed|released|finished|done|launched|fixed)\b/.test(t)) return "done";
  if (/\b(deadline|due|by (mon|tue|wed|thu|fri|sat|sun)|submit|\d{1,2} (nov|dec|jan))\b/.test(t)) return "deadline";
  if (/\b(decided|decision|chose|choose|go with|we will|switch to)\b/.test(t)) return "decision";
  if (/\b(learned|turns out|found out|til|realised|realized)\b/.test(t)) return "learned";
  if (/\b(demo|video|blog|story|tweet|post|pitch)\b/.test(t)) return "story";
  if (/\b(next|todo|need to|should|tomorrow|then)\b/.test(t)) return "next";
  return "next";
}

export const agentFor = (type: MemoryType): Role => FILED_BY[type];

// ---------- redaction (the Keeper runs this before every write) ----------
// The managed relayer sees plaintext, embeddings and decrypted recalls, so nothing credential-shaped is
// ever sent. Extends PR #2's CREDENTIAL_LIKE rule (web/src/lib/feedback.ts) with key formats seen in this stack.

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{8,}/g, // OpenAI / Anthropic style keys
  /\b(vck|vcp|ghp|gho|ghs|xox[abp])_[A-Za-z0-9_-]{10,}/g, // Vercel, GitHub, Slack tokens
  /\bt-[0-9a-f]{24}-[0-9a-f]{20,40}\b/gi, // Tatum API keys: t-<24 hex>-<24 hex>

  /\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/g, // Telegram bot tokens
  /\bsuiprivkey1[0-9a-z]{20,}/gi, // Sui bech32 private keys
  // Bare 32-byte hex is how delegate private keys are exported. `0x`-prefixed hex (Sui addresses, object
  // ids, package ids) is public on-chain data and stays, so project memories can name what was deployed.
  /(?<![a-f0-9x])[a-f0-9]{64}(?![a-f0-9])/gi,
  /\b(password|passwd|api[_ -]?key|secret|token)\s*[:=]\s*\S+/gi,
  /\bbearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi,
  /[\w.+-]+@[\w-]+\.[\w.-]+/g, // email addresses
];

export const MAX_MEMORY_CHARS = 1000;

export function redact(text: string): { text: string; removed: number } {
  let removed = 0;
  let out = text;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, () => {
      removed++;
      return "[removed]";
    });
  }
  out = out.replace(/\s+/g, " ").trim();
  if (out.length > MAX_MEMORY_CHARS) out = `${out.slice(0, MAX_MEMORY_CHARS - 1)}…`;
  return { text: out, removed };
}
