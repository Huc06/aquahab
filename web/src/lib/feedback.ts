// Feedback loop, mock only. Follows docs/features/feedback-loop.md (UI states and rules).
// Nothing here calls Walrus. The backend replaces these functions with API calls
// (POST /api/tasks/:taskId/feedback, POST /api/memory/remember).

export type Rating = "positive" | "neutral" | "negative";
export type CandidateType = "preference" | "feedback" | "decision";
export type CandidateScope = "agent" | "company";
export type FilingStatus = "queued" | "pending" | "stored";

export interface Candidate {
  id: string;
  text: string;
  type: CandidateType;
  scope: CandidateScope;
  confidence: number;
  kept: boolean;
  blocked: boolean;
}

// Mirrors the credential rule in AC-FL-07. Matched lines are replaced before they reach the UI.
const CREDENTIAL_LIKE = /(sk-[A-Za-z0-9]{8,}|0x[a-fA-F0-9]{40,}|password\s*[:=]|api[_ -]?key\s*[:=]|bearer\s+\S+)/i;

export const isCredentialLike = (text: string) => CREDENTIAL_LIKE.test(text);

const MAX_CANDIDATES = 5;

function sentences(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Corrective instruction becomes a feedback memory for the agent. Comment sentences become preferences.
export function proposeCandidates(rating: Rating, comment: string, instruction: string): Candidate[] {
  const drafts: Omit<Candidate, "id" | "kept" | "blocked">[] = [
    ...sentences(instruction).map((text) => ({ text, type: "feedback" as const, scope: "agent" as const, confidence: 0.9 })),
    ...(rating === "positive" ? [] : sentences(comment).map((text) => ({ text, type: "preference" as const, scope: "agent" as const, confidence: 0.8 }))),
  ];
  return drafts.slice(0, MAX_CANDIDATES).map((d, i) => {
    const blocked = isCredentialLike(d.text);
    return { ...d, id: `c${i}`, text: blocked ? "[removed]" : d.text, kept: !blocked, blocked };
  });
}

// Simulates the filing timeline: queued, then pending, then stored. Mock only, so "stored" means "saved in the mock", not on Walrus.
export function fileCandidates(ids: string[], update: (id: string, status: FilingStatus) => void): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  ids.forEach((id, i) => {
    update(id, "queued");
    timers.push(setTimeout(() => update(id, "pending"), 600 + i * 300));
    timers.push(setTimeout(() => update(id, "stored"), 1800 + i * 300));
  });
  return () => timers.forEach(clearTimeout);
}
