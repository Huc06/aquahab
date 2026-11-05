"use client";

import { api } from "@/lib/api";
import { useActiveRoom, useApi } from "@/lib/useApi";

// The room board. Every card is a memory the crew filed; nothing here is typed by hand.
export function BoardPanel() {
  const { room, loading: roomLoading } = useActiveRoom();
  const roomId = room?.id ?? null;
  const board = useApi(roomId ? () => api.board(roomId) : null, [roomId]);

  if (roomLoading) return <p className="text-sm text-fg-3">Loading…</p>;
  if (!room) return <p className="text-sm text-fg-3">Create a room first.</p>;
  if (board.loading) return <p className="text-sm text-fg-3">Loading board…</p>;
  if (board.error) return <p className="text-sm text-bad">{board.error}</p>;

  return (
    <div className="space-y-5 text-sm text-fg-2">
      <p className="font-mono text-[13px] text-fg-3">{room.name} · cards come from filed memories</p>
      {board.data?.columns.map((col) => (
        <section key={col.column} aria-label={col.title} className="space-y-2">
          <h3 className="font-semibold text-fg">
            {col.title} <span className="font-mono text-[13px] text-fg-3">{col.cards.length}</span>
          </h3>
          {col.cards.length === 0 && <p className="text-fg-3">Nothing here yet.</p>}
          <ul className="space-y-2">
            {col.cards.map((card) => (
              <li key={card.jobId} className="rounded-md border border-line bg-raised p-3">
                <p className="text-fg">{card.text}</p>
                <p className="mt-1 font-mono text-[12px] text-fg-3">
                  {card.agent} · {new Date(card.createdAt).toLocaleDateString()}
                  {card.blobId ? ` · ${card.blobId.slice(0, 10)}…` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
