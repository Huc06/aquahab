"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { MemoryJob } from "@/lib/api-types";
import { AskTheCrew } from "@/components/chat/AskTheCrew";
import { useHQ } from "@/lib/store";
import { useActiveRoom, watchJob } from "@/lib/useApi";

type Message = { id: number; from: "ceo" | "crew"; text: string };

const HINT = "Capture with d: decision, f: failure, n: next, done:, l: learned, due: deadline, s: story, p: preference.";

// CEO console: quick capture into the active room. Each line becomes a memory after the crew files it.
export function ChatPanel() {
  const open = useHQ((s) => s.chatOpen);
  const setOpen = useHQ((s) => s.setChatOpen);
  const { room } = useActiveRoom();
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"capture" | "ask">("capture");
  const [messages, setMessages] = useState<Message[]>([{ id: 0, from: "crew", text: HINT }]);
  const nextId = useRef(1);
  const cancels = useRef<(() => void)[]>([]);

  useEffect(() => () => cancels.current.forEach((c) => c()), []);

  const add = (from: Message["from"], text: string) => {
    const id = nextId.current++;
    setMessages((prev) => [...prev, { id, from, text }]);
    return id;
  };

  const describe = (job: MemoryJob) => {
    if (job.status === "stored") return `Stored as ${job.type}${job.blobId ? ` · ${job.blobId.slice(0, 10)}…` : ""}`;
    if (job.status === "failed") return `Not saved: ${job.error ?? "failed"}`;
    return `${job.type} · ${job.status}`;
  };

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    add("ceo", text);
    if (!room) {
      add("crew", "Create a room in Rooms first.");
      return;
    }
    try {
      const job = await api.capture(room.id, text);
      const id = add("crew", describe(job));
      cancels.current.push(
        watchJob(job.jobId, (j) => setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: describe(j) } : m)))),
      );
    } catch (e) {
      add("crew", e instanceof Error ? e.message : "Capture failed.");
    }
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
          aria-label="Chat with the crew"
          className="pointer-events-auto absolute bottom-24 right-3 z-30 flex h-[420px] w-[420px] flex-col rounded-md border border-line bg-surface/95"
        >
          <header className="flex items-center justify-between border-b border-line-decor px-4 py-3">
            <h2 className="text-base font-semibold text-fg">{room ? `Capture · ${room.name}` : "Capture"}</h2>
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-sm border border-line text-fg-2 focus-visible:outline-focus"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>

          <div role="tablist" aria-label="Chat mode" className="flex gap-1.5 border-b border-line-decor px-3 py-2 text-sm">
            {(["capture", "ask"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-sm border px-3 py-1 focus-visible:outline-focus ${mode === m ? "border-mem bg-raised text-fg" : "border-transparent text-fg-2 hover:border-line"}`}
              >
                {m === "capture" ? "Quick Capture" : "Ask the Crew"}
              </button>
            ))}
          </div>

          {mode === "ask" && room ? (
            <AskTheCrew roomId={room.id} roomName={room.name} />
          ) : (
          <>
          <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-sm" aria-live="polite">
            {messages.map((m) => (
              <li key={m.id} className={m.from === "ceo" ? "ml-10 rounded-md bg-raised px-3 py-2 text-fg" : "mr-10 px-3 py-2 text-fg-2"}>
                {m.text}
              </li>
            ))}
          </ol>

          <form
            className="flex gap-2 border-t border-line-decor p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label className="sr-only" htmlFor="chat-input">
              Capture a note
            </label>
            <input
              id="chat-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="d: Use Tatum GraphQL for events"
              className="min-w-0 flex-1 rounded-md border border-line bg-deep px-3 py-2 text-fg focus-visible:outline-focus"
            />
            <button type="submit" disabled={!draft.trim()} className="rounded-md bg-action-fill px-3 py-2 text-sm font-medium text-on-accent focus-visible:outline-focus disabled:opacity-40">
              Send
            </button>
          </form>
          </>
          )}
        </section>
      )}
    </>
  );
}
