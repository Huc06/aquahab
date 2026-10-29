// Chat intent resolver. Rule-based for MVP (see docs/product/DECISIONS.md §8, chat section).
// Only two intents are in MVP: assign a mission, and ask for status. Everything else is unknown.

export type Intent =
  | { kind: "assign"; objective: string }
  | { kind: "status" }
  | { kind: "unknown" };

const ASSIGN_WORDS = ["assign", "plan", "launch", "research", "write", "build", "prepare", "draft"];
const STATUS_WORDS = ["status", "update", "what are you doing", "progress"];

export function resolveIntent(text: string): Intent {
  const t = text.trim().toLowerCase();
  if (!t) return { kind: "unknown" };
  if (STATUS_WORDS.some((w) => t.includes(w))) return { kind: "status" };
  if (ASSIGN_WORDS.some((w) => t.includes(w))) return { kind: "assign", objective: text.trim() };
  return { kind: "unknown" };
}
