"use client";

import { useEffect, useState } from "react";
import { api, onEvents } from "./api";
import type { StandupTurn } from "./api-types";
import type { AgentId } from "./types";
import { useApi } from "./useApi";

// What the crew says in the office, under the speaker's name, next to the status.
//
// After the morning brief the crew holds a standup about the room (server/src/standup.ts): real turns, in order,
// each citing the Walrus blobs it rests on, some answering another member (`to`). The office plays it on a loop.
// Until a room has a standup, the crew makes small talk, which is flavour only: no line states a fact about a
// room, a decision or a memory.
export const BANTER: { speaker: AgentId; text: string }[] = [
  { speaker: "lofi", text: "Rain on the glass, lo-fi on. Anyone else in?" },
  { speaker: "researcher", text: "Pulling the market brief now. Coffee first." },
  { speaker: "one", text: "Quick check: is the snack budget still a line item?" },
  { speaker: "builder", text: "Launch plan is open. Mostly under control." },
  { speaker: "lofi", text: "Snacks are brand voice. Non-negotiable." },
  { speaker: "hippo", text: "Quality review is on track. Mostly." },
  { speaker: "one", text: "Noted. Approved as a creative expense." },
  { speaker: "researcher", text: "The current is strong today. Good for signal." },
  { speaker: "builder", text: "Ship it, then fix it." },
  { speaker: "hippo", text: "Budget looks fine. Probably." },
  { speaker: "lofi", text: "Blink twice if you hear the bass." },
  { speaker: "one", text: "Only if you blink on the beat." },
];

export const BANTER_EVERY_MS = 4500;
/** A standup turn is a real sentence; give it time to be read. */
export const STANDUP_EVERY_MS = 7000;

export interface BanterLine {
  speaker: AgentId;
  text: string;
  /** The member this line answers, or null when it speaks to the crew. */
  to: AgentId | null;
  /** Blob ids the line rests on. Empty for small talk. */
  cites: string[];
  /** True when the line comes from the room's standup, false for small talk. */
  standup: boolean;
}

const SPEAKERS = new Set<string>(["one", "researcher", "builder", "lofi", "hippo"]);
const isAgent = (r: string | null): r is AgentId => r !== null && SPEAKERS.has(r);

const SMALL_TALK: BanterLine[] = BANTER.map((b) => ({ ...b, to: null, cites: [], standup: false }));

const fromTurns = (turns: StandupTurn[]): BanterLine[] =>
  turns.filter((t) => isAgent(t.agent)).map((t) => ({ speaker: t.agent as AgentId, text: t.text, to: isAgent(t.to) ? t.to : null, cites: t.cites, standup: true }));

// The current line, advanced on a timer: the room's latest standup when it has one, else small talk.
export function useBanter(roomId: string | null): BanterLine {
  const standup = useApi(roomId ? () => api.latestStandup(roomId) : null, [roomId]);
  const { reload } = standup;

  // A standup held while the office is open shows up at once.
  useEffect(() => {
    if (!roomId) return;
    return onEvents((e) => {
      if (e.type === "standup.created" && e.roomId === roomId) reload();
    });
  }, [roomId, reload]);

  const turns = standup.data ? fromTurns(standup.data.turns) : [];
  const lines = turns.length ? turns : SMALL_TALK;
  const every = turns.length ? STANDUP_EVERY_MS : BANTER_EVERY_MS;

  // The counter belongs to one script, so a new standup starts from its first line.
  const script = standup.data?.id ?? "small-talk";
  const [step, setStep] = useState({ script, n: 0 });
  useEffect(() => {
    const t = window.setInterval(() => setStep((s) => ({ script, n: s.script === script ? s.n + 1 : 1 })), every);
    return () => window.clearInterval(t);
  }, [every, script]);
  const index = step.script === script ? step.n : 0;
  return lines[index % lines.length];
}
