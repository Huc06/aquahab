"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Brief, Role } from "@/lib/api-types";
import { CREW } from "@/lib/api-types";
import { useActiveRoom, useApi } from "@/lib/useApi";
import { BlobReceiptPopover } from "@/components/receipt/BlobReceiptPopover";
import { DraftModal } from "@/components/draft/DraftModal";

// Members whose lines can be turned into a draft (the voice, the plan and the research lanes).
const DRAFTABLE: Role[] = ["one", "lofi", "researcher"];

const button = "rounded-md border border-line px-3 py-1 text-sm text-fg focus-visible:outline-focus disabled:opacity-40";
// A rating already sent: still a button in the same place, but done.
const sentButton = "rounded-md border border-mem px-3 py-1 text-sm text-fg-2";

// The server files the reason as one line of a memory: one line, at most 200 characters.
const REASON_MAX = 200;

type Rating = "up" | "down";

// The morning brief: one section per crew member. Every line lists the memories it was built from.
export function BriefingPanel() {
  const { room, loading: roomLoading } = useActiveRoom();
  const roomId = room?.id ?? null;
  const brief = useApi(roomId ? () => api.latestBrief(roomId) : null, [roomId]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [drafting, setDrafting] = useState<{ idea: string; agent: Role } | null>(null);
  // Rating state belongs to one brief, so a new brief starts unrated.
  const [sent, setSent] = useState<{ briefId: string; rating: Rating } | null>(null);
  const [asking, setAsking] = useState<string | null>(null); // the brief whose "Not useful" reason box is open
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  if (roomLoading) return <p className="text-sm text-fg-3">Loading…</p>;
  if (!room) return <p className="text-sm text-fg-3">Create a room first.</p>;

  const run = async () => {
    setBusy(true);
    setMessage(null);
    setRateError(null);
    try {
      await api.runBrief(room.id);
      brief.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "The brief failed.");
    } finally {
      setBusy(false);
    }
  };

  const rate = async (b: Brief, value: Rating, why?: string) => {
    const clean = why?.replace(/[\r\n]+/g, " ").trim().slice(0, REASON_MAX);
    setSending(true);
    setRateError(null);
    try {
      await api.rateBrief(b.id, clean ? { rating: value, reason: clean } : { rating: value });
      setSent({ briefId: b.id, rating: value });
      setAsking(null);
      setReason("");
      brief.reload();
    } catch (e) {
      setRateError(e instanceof Error ? e.message : "Could not save the rating.");
    } finally {
      setSending(false);
    }
  };

  const b = brief.data;
  const rated: Rating | null = b ? (sent?.briefId === b.id ? sent.rating : b.feedback) : null;
  const askingReason = !!b && asking === b.id && !rated;

  return (
    <div className="space-y-4 text-sm text-fg-2">
      {brief.loading && <p className="text-fg-3">Loading brief…</p>}
      {!brief.loading && !b && <p className="text-fg-3">No brief yet for {room.name}.</p>}

      {b && (
        <>
          <p className="font-mono text-[13px] text-fg-3">
            day {b.dayIndex} · {b.kind} · {b.recalled} memories recalled · {b.source}
            {b.degraded ? " · degraded: recall came back empty" : ""}
          </p>
          {b.sections.map((s) => (
            <section key={s.agent} className="space-y-1">
              <h3 className="font-semibold text-fg">{CREW[s.agent].name}: {s.title}</h3>
              <ul className="space-y-1">
                {s.lines.map((line, i) => (
                  <li key={i}>
                    {line.text}
                    {line.cites.map((blobId) => (
                      <span key={blobId} className="ml-1">
                        <BlobReceiptPopover blobId={blobId} />
                      </span>
                    ))}
                    {DRAFTABLE.includes(s.agent) && (
                      <button
                        type="button"
                        className="ml-2 rounded-sm border border-line px-1.5 py-0.5 text-[12px] text-fg-2 focus-visible:outline-focus"
                        onClick={() => setDrafting({ idea: line.text, agent: s.agent })}
                      >
                        ✍ Draft
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div className="space-y-2" aria-live="polite">
            {rated ? (
              <div className="flex gap-2">
                <button type="button" className={sentButton} aria-pressed="true" disabled>
                  {rated === "up" ? "Sent: useful" : "Sent: not useful"}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button type="button" className={button} disabled={sending} onClick={() => void rate(b, "up")}>
                  Useful
                </button>
                <button
                  type="button"
                  className={`${button} ${askingReason ? "border-mem" : ""}`}
                  aria-expanded={askingReason}
                  aria-controls="brief-reason-form"
                  disabled={sending}
                  onClick={() => {
                    setRateError(null);
                    setAsking(askingReason ? null : b.id);
                  }}
                >
                  Not useful
                </button>
              </div>
            )}
            {askingReason && (
              <form
                id="brief-reason-form"
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (reason.trim()) void rate(b, "down", reason);
                }}
              >
                <label className="sr-only" htmlFor="brief-reason">
                  What should change in the brief
                </label>
                <input
                  id="brief-reason"
                  type="text"
                  value={reason}
                  maxLength={REASON_MAX}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="What should change? One sentence."
                  autoFocus
                  className="min-w-0 flex-1 rounded-md border border-line bg-deep px-3 py-1 text-fg focus-visible:outline-focus"
                />
                <button type="submit" className={button} disabled={sending || !reason.trim()}>
                  {sending ? "Sending…" : "Send"}
                </button>
                <button type="button" className={button} disabled={sending} onClick={() => void rate(b, "down")}>
                  Skip
                </button>
              </form>
            )}
            {rateError && <p role="alert" className="text-bad">{rateError}</p>}
          </div>
        </>
      )}

      <button type="button" className={button} onClick={run} disabled={busy}>
        {busy ? "Writing brief…" : "Run brief now"}
      </button>
      {message && <p role="alert" className="text-bad">{message}</p>}
      {drafting && (
        <DraftModal roomId={room.id} roomName={room.name} idea={drafting.idea} agent={drafting.agent} onClose={() => setDrafting(null)} />
      )}
    </div>
  );
}
