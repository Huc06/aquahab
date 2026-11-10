"use client";

import { useEffect } from "react";
import { api, onEvents } from "@/lib/api";
import { useApi, useActiveRoom } from "@/lib/useApi";
import { BlobReceiptPopover } from "@/components/receipt/BlobReceiptPopover";

// The server keeps a room's memory list for 20 s (server/src/views.ts memoriesView), so a refetch right after
// `memory.stored` can still get the old list. Look once more after that copy has expired.
const SERVER_CACHE_MS = 21_000;

// The room's memory as the relayer lists it, with the on-chain check from Sui through Tatum.
export function VaultPanel() {
  const { room, loading: roomLoading } = useActiveRoom();
  const roomId = room?.id ?? null;
  const namespace = room?.namespace ?? null;
  const memories = useApi(roomId ? () => api.memories(roomId) : null, [roomId]);
  const { reload } = memories;

  // A memory stored in this room while the Vault is open shows up without a reload.
  useEffect(() => {
    if (!roomId) return;
    let again: ReturnType<typeof setTimeout> | undefined;
    const off = onEvents((e) => {
      if (e.type !== "memory.stored") return;
      if (e.job.roomId !== roomId && e.job.namespace !== namespace) return;
      reload();
      clearTimeout(again);
      again = setTimeout(reload, SERVER_CACHE_MS);
    });
    return () => {
      off();
      clearTimeout(again);
    };
  }, [roomId, namespace, reload]);

  if (roomLoading) return <p className="text-sm text-fg-3">Loading…</p>;
  if (!room) return <p className="text-sm text-fg-3">Create a room first.</p>;
  // Only the first load shows this; a refetch keeps the current list on screen until the new one arrives.
  if (memories.loading && !memories.data) return <p className="text-sm text-fg-3">Loading memory…</p>;
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
            <div className="mt-2">
              <BlobReceiptPopover blobId={m.blobId} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
