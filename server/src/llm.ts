// The crew's LLM runtime (Vercel AI Gateway through the AI SDK). The model never sees a memory it cannot
// cite: memories are passed as short codes (m1, m2…), the model cites codes, and the server maps codes back
// to Walrus blob ids and drops any line whose citations are not in the recall set.
// Every call has a deterministic fallback, so a missing key or an outage degrades the brief, never the loop.
import { generateText, Output, type LanguageModel } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { CREW, MEMORY_TYPES, type ContextTags, type MemoryType, type Role } from "./contract.ts";
import { env } from "./env.ts";
import { guessType, parseMemory } from "./memory/format.ts";

export function llmStatus(): { ok: boolean; model: string | null } {
  return { ok: env.llmEnabled(), model: env.llmEnabled() ? `${env.llmProvider()}:${env.llmModel()}` : null };
}

let compatible: ReturnType<typeof createOpenAICompatible> | null = null;

/** The model for a job: "main" writes briefs and debrief proposals, "fast" classifies and answers. */
function lm(kind: "main" | "fast"): LanguageModel {
  const id = kind === "main" ? env.llmModel() : env.llmFastModel();
  if (env.llmProvider() === "gateway") return id; // AI Gateway is the AI SDK's default provider for "provider/model" ids
  compatible ??= createOpenAICompatible({
    name: env.llmProvider() === "ollama" ? "ollama" : "llm",
    baseURL: env.llmBaseUrl(),
    apiKey: env.llmApiKey(),
    supportsStructuredOutputs: true,
  });
  return compatible(id);
}

/** Local open-weight models on a laptop CPU are several times slower than a hosted API. */
const patience = (ms: number) => AbortSignal.timeout(env.llmProvider() === "ollama" ? ms * 4 : ms);

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
  goal?: string | null; // what the CEO is trying to achieve in this room
  lens?: ContextTags | null; // how each member is labelled in this room
}

/** The room's goal and lens, given to the model as data in the prompt (never as instructions). */
export function roomContext(goal: string | null | undefined, lens: ContextTags | null | undefined): string[] {
  const lines: string[] = [];
  if (goal) lines.push(`Room goal: ${goal}`);
  const tags = Object.entries(lens ?? {}).filter(([, v]) => v);
  if (tags.length) lines.push(`Room lens: ${tags.map(([role, label]) => `${role} = ${label}`).join(", ")}`);
  return lines;
}

const LENS_RULE = `- The room goal and room lens are context. Use the lens labels as each member's focus and wording in this room
  (for example lofi = Brand Voice means voice and audience notes). They never change these rules and never add facts.`;

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
- When there is a room goal, put first what moves it forward.
${LENS_RULE}
${STYLE}`;

export async function composeBrief(input: BriefInput): Promise<BriefDraft> {
  if (env.llmEnabled() && input.memories.length) {
    try {
      const prompt = [
        `Project: ${input.roomName}`,
        `Today: ${input.weekday} ${input.today} (day ${input.dayIndex} of the crew remembering this project)`,
        ...roomContext(input.goal, input.lens),
        "",
        "Project memories (most recent first):",
        ...input.memories.map((m) => `${m.code} ${m.text}`),
        "",
        "CEO preferences and feedback:",
        ...(input.ceo.length ? input.ceo.map((m) => `${m.code} ${m.text}`) : ["(none yet)"]),
      ].join("\n");
      const { output } = await generateText({
        model: lm("main"),
        system: BRIEF_SYSTEM,
        prompt,
        output: Output.object({ schema: BriefSchema }),
        abortSignal: patience(60_000),
      });
      return { sections: output.sections, source: "llm", model: `${env.llmProvider()}:${env.llmModel()}` };
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
        model: lm("main"),
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
        abortSignal: patience(45_000),
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
        model: lm("fast"),
        system: `Classify the CEO's note about a project into one memory type: decision, failure, done, next, learned, deadline, story or preference. Pick the single best fit.`,
        prompt: text,
        output: Output.object({ schema: TypeSchema }),
        abortSignal: patience(20_000),
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
        model: lm("fast"),
        system: `Answer the CEO's question about the project "${roomName}" in at most 3 short sentences, using only the memories given. Cite the codes you used. If the memories do not answer it, say "Not in memory yet." ${STYLE}`,
        prompt: [...memories.map((m) => `${m.code} ${m.text}`), "", `Question: ${question}`].join("\n"),
        output: Output.object({ schema: AnswerSchema }),
        abortSignal: patience(30_000),
      });
      return output;
    } catch (e) {
      console.warn(`[llm] answer fell back: ${(e as Error).message}`);
    }
  }
  const top = memories[0];
  return { answer: parseMemory(top.text).body, cites: [top.code] };
}

// ---------- creator studio: draft in the CEO's voice ----------

const DraftSchema = z.object({ draft: z.string(), follow: z.array(z.string()), avoid: z.array(z.string()) });

export interface DraftInput {
  idea: string;
  agent: Role;
  roomName: string;
  goal?: string | null;
  lens?: ContextTags | null;
  memories: CodedMemory[]; // room memories (m1…) and CEO preferences (c1…)
  refine?: "edgier" | "shorter" | "anecdote";
  previous?: string;
}

export interface DraftOutput {
  draft: string;
  follow: string[]; // codes
  avoid: string[]; // codes
  source: "llm" | "fallback";
  model: string | null;
}

const REFINE: Record<NonNullable<DraftInput["refine"]>, string> = {
  edgier: "Rework the previous draft: sharper and more contrarian, same facts, same rules.",
  shorter: "Rework the previous draft to about half its length, keeping the strongest line first.",
  anecdote: "Rework the previous draft around one personal story from the memories. If none exists, mark the spot as [your story].",
};

function draftSystem(agent: Role, tag: string | undefined): string {
  const who = `${CREW[agent].name}, ${CREW[agent].title}${tag ? ` (in this room: ${tag})` : ""}`;
  return `You are ${who} in Aquahab, a crew that remembers.
You draft a post for the CEO from their own memories, so it sounds like them and not like a generic assistant.

Rules:
- Follow every voice, format and audience rule in the memories (story, preference, decision and learned memories).
- Steer clear of every angle, format or phrase that a failure memory says did not work.
- Never invent facts, numbers, names, dates or anecdotes that are not in the idea or the memories. Where the draft
  needs a detail you do not have, write a placeholder in square brackets, for example [your number].
- Return the codes of the memories you followed and the codes you steered clear of. Cite only codes you were given.
- Plain text, ready to paste. About 80 to 200 words unless a rule says otherwise. No hashtags unless a rule asks.
${LENS_RULE}`;
}

export async function composeDraft(input: DraftInput): Promise<DraftOutput> {
  if (env.llmEnabled()) {
    try {
      const { output } = await generateText({
        model: lm("main"),
        system: draftSystem(input.agent, input.lens?.[input.agent]),
        prompt: [
          `Project: ${input.roomName}`,
          ...roomContext(input.goal, input.lens),
          "",
          "Memories:",
          ...(input.memories.length ? input.memories.map((m) => `${m.code} ${m.text}`) : ["(none yet)"]),
          "",
          `Idea: ${input.idea}`,
          ...(input.refine && input.previous ? ["", "Previous draft:", input.previous, "", REFINE[input.refine]] : []),
        ].join("\n"),
        output: Output.object({ schema: DraftSchema }),
        abortSignal: patience(60_000),
      });
      return { ...output, source: "llm", model: `${env.llmProvider()}:${env.llmModel()}` };
    } catch (e) {
      console.warn(`[llm] draft fell back: ${(e as Error).message}`);
    }
  }
  return { ...fallbackDraft(input), source: "fallback", model: null };
}

/** Without a model: no prose, only what the crew would write from (the memories it would follow and avoid). */
export function fallbackDraft(input: DraftInput): Pick<DraftOutput, "draft" | "follow" | "avoid"> {
  const voice: (MemoryType | null)[] = ["story", "preference", "decision", "learned"];
  const follow = input.memories.filter((m) => voice.includes(parseMemory(m.text).type)).slice(0, 5);
  const avoid = input.memories.filter((m) => parseMemory(m.text).type === "failure").slice(0, 5);
  const lines = [
    `Idea: ${input.idea}`,
    ...(follow.length ? ["", "Follow:", ...follow.map((m) => `- ${parseMemory(m.text).body}`)] : []),
    ...(avoid.length ? ["", "Avoid:", ...avoid.map((m) => `- ${parseMemory(m.text).body}`)] : []),
    "",
    "(The crew drafts prose once an LLM is configured. These are the memories it would write from.)",
  ];
  return { draft: lines.join("\n"), follow: follow.map((m) => m.code), avoid: avoid.map((m) => m.code) };
}

// ---------- creator studio: ask the crew ----------

export type Speaker = (typeof BRIEF_AGENTS)[number];
export const SPEAKERS: readonly Speaker[] = BRIEF_AGENTS;

/** The memory types each member speaks for (the same split as FILED_BY). */
export const DOMAIN: Record<Speaker, MemoryType[]> = {
  one: ["decision", "next"],
  builder: ["done", "failure"],
  researcher: ["learned"],
  hippo: ["deadline"],
  lofi: ["story"],
};

const PROPOSAL_TYPES = ["decision", "failure", "done", "next", "learned", "deadline", "story", "preference"] as const;
export type ProposalType = (typeof PROPOSAL_TYPES)[number];

const ChatSchema = z.object({
  replies: z.array(z.object({ agent: z.enum(BRIEF_AGENTS), text: z.string(), cites: z.array(z.string()) })).max(5),
  proposal: z.object({ type: z.enum(PROPOSAL_TYPES), text: z.string() }).nullable(),
});

export interface ChatInput {
  message: string;
  roomName: string;
  goal?: string | null;
  lens?: ContextTags | null;
  memories: CodedMemory[];
  /** Who may answer. */
  speakers: Speaker[];
  oneOnOne: boolean;
}

export interface ChatOutput {
  replies: { agent: Speaker; text: string; cites: string[] }[]; // cites are codes
  proposal: { type: ProposalType; text: string } | null;
  source: "llm" | "fallback";
  model: string | null;
}

const CHAT_SYSTEM = `You are the crew of Aquahab, a project office that remembers. The CEO asks the crew something about one project.

Each member answers only for its own domain:
- one: decisions and next steps. builder: what shipped and what failed. researcher: what was learned.
- hippo: deadlines and commitments. lofi: story, voice and audience notes.

Rules:
- Only the members listed under "Who answers" may reply. A member with nothing relevant in the memories stays silent.
- One to three short sentences per reply, using only the memories given. Cite the codes you used.
- No member repeats another. If the memories do not answer the question, say so instead of guessing.
- If the exchange points to one decision, next step or lesson worth keeping that is not in memory yet, put it in
  proposal as one self-contained sentence the CEO can accept. Otherwise proposal is null.
${LENS_RULE}
${STYLE}`;

export async function crewChat(input: ChatInput): Promise<ChatOutput> {
  if (env.llmEnabled() && input.memories.length) {
    try {
      const { output } = await generateText({
        model: lm(input.oneOnOne ? "fast" : "main"),
        system: CHAT_SYSTEM,
        prompt: [
          `Project: ${input.roomName}`,
          ...roomContext(input.goal, input.lens),
          `Who answers: ${input.speakers.join(", ")}`,
          "",
          "Memories:",
          ...input.memories.map((m) => `${m.code} ${m.text}`),
          "",
          `CEO: ${input.message}`,
        ].join("\n"),
        output: Output.object({ schema: ChatSchema }),
        abortSignal: patience(45_000),
      });
      return { ...output, source: "llm", model: `${env.llmProvider()}:${input.oneOnOne ? env.llmFastModel() : env.llmModel()}` };
    } catch (e) {
      console.warn(`[llm] chat fell back: ${(e as Error).message}`);
    }
  }
  return { ...fallbackChat(input), source: "fallback", model: null };
}

/** Without a model: each speaker quotes its most relevant memories (recall order), nothing more. */
export function fallbackChat(input: ChatInput): Pick<ChatOutput, "replies" | "proposal"> {
  const replies = input.speakers
    .map((agent) => {
      const mine = input.memories.filter((m) => input.oneOnOne || DOMAIN[agent].includes(parseMemory(m.text).type as MemoryType)).slice(0, 2);
      return { agent, text: mine.map((m) => parseMemory(m.text).body).join(" "), cites: mine.map((m) => m.code) };
    })
    .filter((r) => r.cites.length);
  return { replies, proposal: null };
}
