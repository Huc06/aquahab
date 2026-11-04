"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Brief } from "@/lib/api-types";
import { CREW } from "@/lib/api-types";
import { useActiveRoom, useApi } from "@/lib/useApi";

const button = "rounded-md border border-line px-3 py-1 text-sm text-fg focus-visible:outline-focus disabled:opacity-40";

// The morning brief: one section per crew member. Every line lists the memories it was built from.
export function BriefingPanel() {
  const { room, loading: roomLoading } = useActiveRoom();
  const roomId = room?.id ?? null;
  const brief = useApi(roomId ? () => api.latestBrief(roomId) : null, [roomId]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
                    {line.cites.length > 0 && (
                      <span className="ml-1 font-mono text-[12px] text-fg-3">[{line.cites.length} memories]</span>
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
    </div>
  );
}
