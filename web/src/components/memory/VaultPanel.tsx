"use client";

import { api } from "@/lib/api";
import { useApi, useActiveRoom } from "@/lib/useApi";

// The room's memory as the relayer lists it, with the on-chain check from Sui through Tatum.
export function VaultPanel() {
  const { room, loading: roomLoading } = useActiveRoom();
  const roomId = room?.id ?? null;
  const memories = useApi(roomId ? () => api.memories(roomId) : null, [roomId]);

  if (roomLoading) return <p className="text-sm text-fg-3">Loading…</p>;
  if (!room) return <p className="text-sm text-fg-3">Create a room first.</p>;
  if (memories.loading) return <p className="text-sm text-fg-3">Loading memory…</p>;
  if (memories.error) return <p className="text-sm text-bad">{memories.error}</p>;

  const data = memories.data;
  const list = data?.memories ?? [];

  return (
    <div className="space-y-3 text-sm text-fg-2">
      <p className="font-mono text-[13px] text-fg-3">
        {room.name} · {list.length} memories · {data?.verifiedCount ?? 0} verified on Sui
      </p>
      {list.length === 0 && <p className="text-fg-3">Nothing stored in this room yet.</p>}
      <ul className="space-y-2">
        {list.map((m) => (
          <li key={m.blobId} className="rounded-md border border-line bg-raised p-3">
            <p className="font-mono text-[13px] text-mem">
              {m.type ?? "memory"} · {m.agentLabel ?? m.agent ?? "unknown"}
            </p>
            <p className="mt-1 text-fg">{m.text ?? "(text not recalled yet)"}</p>
            <p className="mt-1 font-mono text-[12px] text-fg-3">
              {m.verified ? "verified on Sui" : "not yet verified"}
              {m.expiresAt ? ` · expires ${new Date(m.expiresAt).toLocaleDateString()}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
