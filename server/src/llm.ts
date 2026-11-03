// The crew's LLM runtime (Vercel AI Gateway through the AI SDK). The model never sees a memory it cannot
// cite: memories are passed as short codes (m1, m2…), the model cites codes, and the server maps codes back
// to Walrus blob ids and drops any line whose citations are not in the recall set.
// Every call has a deterministic fallback, so a missing key or an outage degrades the brief, never the loop.
import { generateText, Output } from "ai";
import { z } from "zod";
import { MEMORY_TYPES, type MemoryType, type Role } from "./contract.ts";
import { env } from "./env.ts";
import { guessType, parseMemory } from "./memory/format.ts";

export function llmStatus(): { ok: boolean; model: string | null } {
  return { ok: env.llmEnabled(), model: env.llmEnabled() ? env.llmModel() : null };
}

const STYLE = `Write plain, concrete English. Short lines. No filler, no emojis, no em dashes, no hype.
Never invent facts, names, dates or numbers that are not in the memories.`;

export interface CodedMemory {
  code: string; // m1, m2, c1…
  blobId: string;
  text: string; // full memory line, with its [type][room][date][by:agent] prefix
}

// ---------- the morning brief ----------

const BRIEF_AGENTS = ["one", "builder", "researcher", "hippo", "lofi"] as const;

const BriefSchema = z.object({
  sections: z
    .array(
      z.object({
        agent: z.enum(BRIEF_AGENTS),
        lines: z.array(z.object({ text: z.string(), cites: z.array(z.string()) })).max(5),
      }),
    )
    .max(5),
});

export interface BriefDraft {
  sections: { agent: Role; lines: { text: string; cites: string[] }[] }[];
  source: "llm" | "fallback";
  model: string | null;
}

export interface BriefInput {
  roomName: string;
  today: string; // YYYY-MM-DD local
  weekday: string;
  dayIndex: number;
  memories: CodedMemory[]; // the room, recalled from Walrus
  ceo: CodedMemory[]; // CEO preferences and feedback, recalled from aquahab:ceo
}

const BRIEF_SYSTEM = `You are the crew of Aquahab, a project office. You write the CEO's morning brief for one project.
The brief answers one question: where did we leave off, and what happens next?

Each crew member writes only its own section:
- one (Chief of Staff): the top 3 next steps, most important first. Draw on next, decision and failure memories.
- builder (Head of Engineering): what changed and what broke recently, with the fix if known (done, failure).
- researcher (Head of Research): open questions, and what was learned (learned).
- hippo (Head of Finance & Ops): deadlines and commitments, with days left counted from today (deadline).
- lofi (Head of Growth): demo, blog and story notes (story).

Rules:
- Use only the memories given. Every line cites the codes of the memories it is based on (for example ["m3","m7"]).
- When a memory says [supersedes:X], the newer one wins; do not report the older fact as current.
- A next step that a later done memory completed is not a next step any more.
- Leave out a section that has nothing real to say. Never pad.
- CEO preferences and feedback (codes c1, c2…) override these defaults, for example on length or tone. Cite the preference code on the first line it shapes.
${STYLE}`;

export async function composeBrief(input: BriefInput): Promise<BriefDraft> {
  if (env.llmEnabled() && input.memories.length) {
    try {
      const prompt = [
        `Project: ${input.roomName}`,
        `Today: ${input.weekday} ${input.today} (day ${input.dayIndex} of the crew remembering this project)`,
        "",
        "Project memories (most recent first):",
        ...input.memories.map((m) => `${m.code} ${m.text}`),
        "",
        "CEO preferences and feedback:",
        ...(input.ceo.length ? input.ceo.map((m) => `${m.code} ${m.text}`) : ["(none yet)"]),
      ].join("\n");
      const { output } = await generateText({
        model: env.llmModel(),
        system: BRIEF_SYSTEM,
        prompt,
        output: Output.object({ schema: BriefSchema }),
        abortSignal: AbortSignal.timeout(60_000),
      });
      return { sections: output.sections, source: "llm", model: env.llmModel() };
    } catch (e) {
      console.warn(`[llm] brief fell back: ${(e as Error).message}`);
    }
  }
  return { ...fallbackBrief(input), source: "fallback", model: null };
}

/** Assemble a brief without the model: newest memories of each type, in each member's section. */
export function fallbackBrief(input: BriefInput): Pick<BriefDraft, "sections"> {
  const want: Record<(typeof BRIEF_AGENTS)[number], MemoryType[]> = {
    one: ["next", "decision"],
    builder: ["done", "failure"],
    researcher: ["learned"],
    hippo: ["deadline"],
    lofi: ["story"],
  };
  const superseded = new Set(input.memories.map((m) => parseMemory(m.text).supersedes).filter(Boolean) as string[]);
  const live = input.memories.filter((m) => !superseded.has(m.blobId));
  const sections = BRIEF_AGENTS.map((agent) => ({
    agent,
    lines: live
      .filter((m) => {
        const t = parseMemory(m.text).type;
        return t !== null && want[agent].includes(t);
      })
      .slice(0, 3)
      .map((m) => ({ text: parseMemory(m.text).body, cites: [m.code] })),
  })).filter((s) => s.lines.length);
  return { sections };
}

// ---------- the evening debrief ----------

const CandidateSchema = z.object({
  candidates: z
    .array(
      z.object({
        type: z.enum(MEMORY_TYPES as [MemoryType, ...MemoryType[]]),
        text: z.string(),
        supersedes: z.string().nullable(),
      }),
    )
    .max(6),
});

export interface CandidateDraft {
  type: MemoryType;
  text: string;
  supersedes: string | null; // a code from `existing`
}

const DEBRIEF_SYSTEM = `You are the crew of Aquahab. The CEO just told you how the day went on one project.
Propose at most 6 memories worth keeping, so that a fresh session in two weeks knows where things stand.

Types: decision (what was chosen and why), failure (what broke, and the fix if known), done (what shipped
or changed), next (an open next step), learned (an answered question), deadline (a date or commitment, with
the date), story (demo, blog or positioning notes), preference (how the CEO wants to be briefed).

Rules:
- One self-contained sentence each. Keep the concrete nouns: files, services, tools, people's roles, dates, reasons.
- Only what the CEO said. No invented details. Skip small talk and feelings unless they are a decision.
- If a candidate updates or contradicts an existing memory, set supersedes to that memory's code. If an
  existing next step got done, propose a done memory that supersedes it. Otherwise supersedes is null.
- Fewer, sharper memories beat many vague ones. Zero is fine if nothing is worth keeping.
${STYLE}`;

export async function extractCandidates(note: string, roomName: string, existing: CodedMemory[]): Promise<CandidateDraft[]> {
  if (env.llmEnabled()) {
    try {
      const { output } = await generateText({
        model: env.llmModel(),
        system: DEBRIEF_SYSTEM,
        prompt: [
          `Project: ${roomName}`,
          "Existing memories (most recent first):",
          ...(existing.length ? existing.map((m) => `${m.code} ${m.text}`) : ["(none yet)"]),
          "",
          "The CEO's note about today:",
          note,
        ].join("\n"),
        output: Output.object({ schema: CandidateSchema }),
        abortSignal: AbortSignal.timeout(45_000),
      });
      return output.candidates.filter((c) => c.text.trim());
    } catch (e) {
      console.warn(`[llm] debrief fell back: ${(e as Error).message}`);
    }
  }
  return fallbackCandidates(note);
}

export function fallbackCandidates(note: string): CandidateDraft[] {
  return note
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((s) => s.length >= 12)
    .slice(0, 6)
    .map((text) => ({ type: guessType(text), text, supersedes: null }));
}

// ---------- quick capture without a prefix ----------

const TypeSchema = z.object({ type: z.enum(MEMORY_TYPES as [MemoryType, ...MemoryType[]]) });

export async function classifyCapture(text: string): Promise<MemoryType> {
  if (env.llmEnabled()) {
    try {
      const { output } = await generateText({
        model: env.llmFastModel(),
        system: `Classify the CEO's note about a project into one memory type: decision, failure, done, next, learned, deadline, story or preference. Pick the single best fit.`,
        prompt: text,
        output: Output.object({ schema: TypeSchema }),
        abortSignal: AbortSignal.timeout(20_000),
      });
      return output.type;
    } catch (e) {
      console.warn(`[llm] classify fell back: ${(e as Error).message}`);
    }
  }
  return guessType(text);
}

// ---------- "ask this room" ----------

const AnswerSchema = z.object({ answer: z.string(), cites: z.array(z.string()) });

export async function answerFromMemory(question: string, roomName: string, memories: CodedMemory[]): Promise<{ answer: string; cites: string[] }> {
  if (!memories.length) return { answer: "Nothing in this room's memory answers that yet.", cites: [] };
  if (env.llmEnabled()) {
    try {
      const { output } = await generateText({
        model: env.llmFastModel(),
        system: `Answer the CEO's question about the project "${roomName}" in at most 3 short sentences, using only the memories given. Cite the codes you used. If the memories do not answer it, say "Not in memory yet." ${STYLE}`,
        prompt: [...memories.map((m) => `${m.code} ${m.text}`), "", `Question: ${question}`].join("\n"),
        output: Output.object({ schema: AnswerSchema }),
        abortSignal: AbortSignal.timeout(30_000),
      });
      return output;
    } catch (e) {
      console.warn(`[llm] answer fell back: ${(e as Error).message}`);
    }
  }
  const top = memories[0];
  return { answer: parseMemory(top.text).body, cites: [top.code] };
}
