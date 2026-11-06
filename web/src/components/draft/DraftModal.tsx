"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CAPTURE_PREFIX, CREW, type DraftResponse, type Role } from "@/lib/api-types";
import { BlobReceiptPopover } from "@/components/receipt/BlobReceiptPopover";

type Refine = "edgier" | "shorter" | "anecdote";

const REFINES: [Refine, string][] = [
  ["edgier", "More edge"],
  ["shorter", "Shorter"],
  ["anecdote", "Add anecdote"],
];

const button = "rounded-md border border-line px-3 py-1 text-sm text-fg focus-visible:outline-focus disabled:opacity-40";

// Draft Studio: the crew writes a draft in the room's voice, from its memories. Nothing is stored until the CEO accepts.
// Accepting files one line in the story lane (`s:`), not the whole draft.
export function DraftModal({ roomId, roomName, idea, agent, onClose }: { roomId: string; roomName: string; idea: string; agent: Role; onClose: () => void }) {
  const [result, setResult] = useState<DraftResponse | null>(null);
  const [loading, setLoading] = useState(true); // the first draft starts on open
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Refine | "first">("first");

  const run = async (refine?: Refine) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setLastRun(refine ?? "first");
    try {
      setResult(await api.draft(roomId, { idea, agent, refine, previous: refine ? result?.draft : undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The draft failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    api
      .draft(roomId, { idea, agent })
      .then((r) => alive && setResult(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "The draft failed."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [roomId, idea, agent]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const accept = async () => {
    if (!result) return;
    setError(null);
    try {
      const line = `Drafted "${idea.slice(0, 120)}" with ${CREW[agent].name}`;
      await api.capture(roomId, `${CAPTURE_PREFIX.story} ${line}`);
      setMessage("Sent to the crew to file. It appears in the Vault once stored.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not commit the draft.");
    }
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-deep/70 p-4">
      <section role="dialog" aria-modal="true" aria-label="Draft" className="flex max-h-full w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-md border border-line bg-surface p-4 text-sm text-fg-2">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-fg">Draft with {CREW[agent].name}</h2>
            <p className="font-mono text-[13px] text-fg-3">{roomName} · {CREW[agent].title}</p>
          </div>
          <button type="button" aria-label="Close draft" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-sm border border-line text-fg-2 focus-visible:outline-focus">
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <p className="text-fg-3">Idea: {idea}</p>

        {loading && <p className="text-fg-3">Recalling the room&apos;s voice and writing the draft…</p>}

        {error && (
          <div role="alert" className="space-y-2">
            <p className="text-bad">{error}</p>
            <button type="button" className={button} onClick={() => run(lastRun === "first" ? undefined : lastRun)}>
              Try again
            </button>
          </div>
        )}

        {result && (
          <>
            {result.source === "fallback" && <p className="text-warn">Written without the model today: these are the memories the draft would follow.</p>}
            <ul className="space-y-1">
              {result.rules.map((rule) => (
                <li key={rule.blobId} className="flex flex-wrap items-center gap-2">
                  <span className={rule.kind === "follow" ? "text-ok" : "text-bad"} aria-hidden="true">{rule.kind === "follow" ? "✓" : "✗"}</span>
                  <span className="text-fg">{rule.text}</span>
                  <BlobReceiptPopover blobId={rule.blobId} />
                </li>
              ))}
            </ul>
            <p className="rounded-md border border-line-decor bg-raised p-3 whitespace-pre-line text-fg">{result.draft}</p>
            <p className="font-mono text-[12px] text-fg-3">{result.recalled} memories recalled · {result.source === "llm" ? result.model : "fallback"}</p>
            <div className="flex flex-wrap gap-2">
              {REFINES.map(([value, label]) => (
                <button key={value} type="button" className={button} disabled={loading} onClick={() => run(value)}>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {message && <p role="status" className="text-ok">{message}</p>}

        <footer className="flex justify-end gap-2 border-t border-line-decor pt-3">
          <button type="button" className={button} onClick={onClose}>
            Close
          </button>
          <button type="button" className="rounded-md bg-action-fill px-3 py-1 text-sm font-medium text-on-accent focus-visible:outline-focus disabled:opacity-40" disabled={!result || loading} onClick={accept}>
            Accept &amp; commit
          </button>
        </footer>
      </section>
    </div>
  );
}
