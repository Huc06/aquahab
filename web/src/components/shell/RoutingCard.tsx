"use client";

import { useActiveRoom } from "@/lib/useApi";

// Top-right status card: the room in view and when the crew next briefs it.
export function RoutingCard() {
  const { room, loading, error } = useActiveRoom();
  return (
    <section
      aria-label="Room status"
      className="pointer-events-auto absolute right-16 top-3 z-20 w-64 rounded-md border border-line bg-surface/90 p-3"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-fg-3">Room</p>
      {loading && <p className="mt-1 text-sm text-fg-3">Loading…</p>}
      {!loading && error && <p className="mt-1 text-sm text-bad">Crew server offline</p>}
      {!loading && !error && !room && <p className="mt-1 text-sm text-fg-3">No room yet</p>}
      {room && (
        <>
          <p className="mt-1 text-sm font-semibold text-fg">{room.name}</p>
          <p className="mt-1 font-mono text-[13px] text-fg-2">
            day {room.dayIndex} · {room.memoryCount} memories · brief {room.briefAt}
          </p>
        </>
      )}
    </section>
  );
}
