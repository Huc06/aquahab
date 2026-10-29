"use client";

import { useState } from "react";
import { AGENTS } from "@/lib/mock";
import { resolveIntent } from "@/lib/intent";
import { useHQ } from "@/lib/store";
import type { AgentId } from "@/lib/types";

type Message =
  | { id: number; from: "ceo"; text: string }
  | { id: number; from: "system"; text: string }
  | { id: number; from: "preview"; objective: string; resolved: false | "confirmed" | "cancelled" };

// Chat panel for assigning missions and asking for status. Nothing is created until the CEO confirms.
export function ChatPanel() {
  const open = useHQ((s) => s.chatOpen);
  const setOpen = useHQ((s) => s.setChatOpen);
  const [target, setTarget] = useState<AgentId>("one");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, from: "system", text: "Pick an agent and tell it what to do. Try: \"Plan a launch for Vietnam\" or \"status\"." },
  ]);
  const [nextId, setNextId] = useState(1);

  type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

  const add = (m: DistOmit<Message, "id">) => {
    setMessages((prev) => [...prev, { ...m, id: nextId } as Message]);
    setNextId((n) => n + 1);
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    add({ from: "ceo", text });
    const intent = resolveIntent(text);
    const agentName = AGENTS.find((a) => a.id === target)?.name ?? "Agent";

    if (intent.kind === "assign") {
      add({ from: "preview", objective: intent.objective, resolved: false });
    } else if (intent.kind === "status") {
      const lines = AGENTS.map((a) => `${a.name}: ${a.status}${a.currentTask ? ` (${a.currentTask})` : ""}`).join(" · ");
      add({ from: "system", text: `${agentName} reports: ${lines}` });
    } else {
      add({ from: "system", text: `${agentName} can assign a mission or report status. Try "Plan a launch for Vietnam" or "status".` });
    }
  };

  const resolvePreview = (index: number, outcome: "confirmed" | "cancelled") => {
    setMessages((prev) => prev.map((m, i) => (i === index && m.from === "preview" ? { ...m, resolved: outcome } : m)));
    add({
      from: "system",
      text:
        outcome === "confirmed"
          ? "Mission confirmed. Backend routing is not connected yet, so nothing was created."
          : "Cancelled. No mission was created.",
    });
  };

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="pointer-events-auto absolute bottom-12 right-3 z-30 rounded-md border border-line bg-surface/95 px-4 py-2 text-sm font-medium text-fg focus-visible:outline-focus"
      >
        Chat
      </button>

      {open && (
        <section
          aria-label="Chat with agents"
          className="pointer-events-auto absolute bottom-24 right-3 z-30 flex h-[420px] w-[420px] flex-col rounded-md border border-line bg-surface/95"
        >
          <header className="flex items-center justify-between border-b border-line-decor px-4 py-3">
            <h2 className="text-base font-semibold text-fg">Chat</h2>
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-sm border border-line text-fg-2 focus-visible:outline-focus"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>

          <div role="group" aria-label="Send to" className="flex gap-1.5 border-b border-line-decor px-3 py-2">
            {AGENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={target === a.id}
                onClick={() => setTarget(a.id)}
                className={`rounded-sm border px-2 py-1 text-xs focus-visible:outline-focus ${
                  target === a.id ? "border-mem text-fg" : "border-line text-fg-2"
                }`}
              >
                {a.name}
              </button>
            ))}
          </div>

          <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-sm" aria-live="polite">
            {messages.map((m, i) => {
              if (m.from === "preview") {
                return (
                  <li key={m.id} className="rounded-md border border-line bg-raised p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-fg-3">Mission preview</p>
                    <p className="mt-1 text-fg">{m.objective}</p>
                    <p className="mt-1 text-fg-2">Routed by One. Budget: 100¢ (default).</p>
                    {m.resolved === false ? (
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => resolvePreview(i, "confirmed")} className="rounded-sm bg-action-fill px-3 py-1 text-xs font-medium text-on-accent focus-visible:outline-focus">
                          Confirm
                        </button>
                        <button type="button" onClick={() => resolvePreview(i, "cancelled")} className="rounded-sm border border-line px-3 py-1 text-xs text-fg-2 focus-visible:outline-focus">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-fg-3">{m.resolved === "confirmed" ? "Confirmed" : "Cancelled"}</p>
                    )}
                  </li>
                );
              }
              return (
                <li key={m.id} className={m.from === "ceo" ? "ml-10 rounded-md bg-raised px-3 py-2 text-fg" : "mr-10 px-3 py-2 text-fg-2"}>
                  {m.text}
                </li>
              );
            })}
          </ol>

          <form
            className="flex gap-2 border-t border-line-decor p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label className="sr-only" htmlFor="chat-input">Message</label>
            <input
              id="chat-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message an agent"
              className="h-10 min-w-0 flex-1 rounded-md border border-line bg-raised px-3 text-sm text-fg placeholder:text-fg-3 focus-visible:outline-focus"
            />
            <button type="submit" className="h-10 rounded-md bg-action-fill px-4 text-sm font-medium text-on-accent focus-visible:outline-focus">
              Send
            </button>
          </form>
        </section>
      )}
    </>
  );
}
