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

// The morning brief: one section per crew member. Every line lists the memories it was built from.
export function BriefingPanel() {
  const { room, loading: roomLoading } = useActiveRoom();
  const roomId = room?.id ?? null;
  const brief = useApi(roomId ? () => api.latestBrief(roomId) : null, [roomId]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [drafting, setDrafting] = useState<{ idea: string; agent: Role } | null>(null);

  if (roomLoading) return <p className="text-sm text-fg-3">Loading…</p>;
  if (!room) return <p className="text-sm text-fg-3">Create a room first.</p>;

  const run = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await api.runBrief(room.id);
      brief.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "The brief failed.");
    } finally {
      setBusy(false);
    }
  };

  const rate = async (b: Brief, rating: "up" | "down") => {
    try {
      await api.rateBrief(b.id, { rating });
      brief.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save the rating.");
    }
  };

  const b = brief.data;

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
          <div className="flex gap-2">
            <button type="button" className={button} aria-pressed={b.feedback === "up"} onClick={() => rate(b, "up")}>
              Useful
            </button>
            <button type="button" className={button} aria-pressed={b.feedback === "down"} onClick={() => rate(b, "down")}>
              Not useful
            </button>
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
