"use client";

import { useEffect, useState } from "react";
import type { AgentId } from "./types";

// Small talk for the whole crew. It is flavour only: no line states a fact about a room, a decision or a memory.
// The line shows under the speaker's name, next to the status, whether or not the speaker has a task.
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

// The current line of the script, advanced on a timer.
export function useBanter(): { speaker: AgentId; text: string } {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setIndex((n) => n + 1), BANTER_EVERY_MS);
    return () => window.clearInterval(t);
  }, []);
  return BANTER[index % BANTER.length];
}
