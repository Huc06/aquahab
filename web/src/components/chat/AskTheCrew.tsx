"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { CREW, type ChatResponse, type Role } from "@/lib/api-types";
import { BlobReceiptPopover } from "@/components/receipt/BlobReceiptPopover";

// The five desks, in the order the tabs show them. The Keeper has no desk and does not answer questions.
const DESKS: Role[] = ["one", "researcher", "builder", "lofi", "hippo"];

const button = "rounded-md border border-line px-2 py-1 text-xs text-fg-2 focus-visible:outline-focus disabled:opacity-40";

// Ask the Crew: the CEO asks a question, the members answer from their memories and cite the blobs.
// Nothing is stored. A suggested memory can be committed with its capture line.
export function AskTheCrew({ roomId, roomName }: { roomId: string; roomName: string }) {
  const [agent, setAgent] = useState<Role | "all">("all");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<ChatResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const ask = async () => {
    const message = question.trim();
    if (!message) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setAnswer(await api.chat(roomId, { message, agent }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The crew did not answer.");
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!answer?.proposal) return;
    setError(null);
    try {
      await api.capture(roomId, answer.proposal.capture);
      setNotice("Sent to the crew to file. It appears in the Vault once stored.");
      setAnswer({ ...answer, proposal: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not commit.");
    }
  };

  const options: (Role | "all")[] = ["all", ...DESKS];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 text-sm">
      <div role="radiogroup" aria-label="Who answers" className="flex flex-wrap gap-1.5">
        {options.map((id) => (
          <button key={id} type="button" aria-pressed={agent === id} onClick={() => setAgent(id)} className={`${button} ${agent === id ? "border-mem text-fg" : ""}`}>
            {id === "all" ? "All" : CREW[id].name}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <label className="sr-only" htmlFor="ask-input">
          Ask {roomName}&apos;s crew
        </label>
        <input
          id="ask-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What should I write about this week?"
          className="min-w-0 flex-1 rounded-md border border-line bg-deep px-3 py-2 text-fg focus-visible:outline-focus"
        />
        <button type="submit" disabled={busy || !question.trim()} className="rounded-md bg-action-fill px-3 py-2 text-sm font-medium text-on-accent focus-visible:outline-focus disabled:opacity-40">
          {busy ? "Asking…" : "Ask"}
        </button>
      </form>

      {error && (
        <div role="alert" className="space-y-2">
          <p className="text-bad">{error}</p>
          <button type="button" className={button} onClick={() => void ask()} disabled={busy}>
            Try again
          </button>
        </div>
      )}

      {notice && <p role="status" className="text-ok">{notice}</p>}

      {answer && (
        <>
          {answer.source === "fallback" && <p className="text-warn">Answered without the model today: lines are the memories the crew recalled.</p>}
          {answer.replies.length === 0 && <p className="text-fg-3">Nobody in {roomName} has a memory on this yet.</p>}
          <ul className="space-y-2">
            {answer.replies.map((r, i) => (
              <li key={i} className="rounded-md bg-raised px-3 py-2">
                <p className="font-semibold text-agent">{CREW[r.agent].name}</p>
                <p className="text-fg">{r.text}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.cites.map((blobId) => (
                    <BlobReceiptPopover key={blobId} blobId={blobId} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {answer.proposal && (
            <div className="space-y-2 rounded-md border border-line p-3">
              <p className="text-xs uppercase tracking-wide text-fg-3">Proposal to commit · {answer.proposal.type} · signed by {CREW[answer.proposal.agent].name}</p>
              <p className="text-fg">{answer.proposal.text}</p>
              <button type="button" className={button} onClick={commit}>
                Commit to Walrus
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
