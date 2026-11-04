"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useActiveRoom } from "@/lib/useApi";
import { useHQ } from "@/lib/store";

const button = "rounded-md border border-line px-3 py-1 text-sm text-fg focus-visible:outline-focus disabled:opacity-40";

// Rooms are real projects. Each room is one Walrus Memory namespace on the crew server.
export function RoomsPanel() {
  const { rooms, room, loading, error, reload } = useActiveRoom();
  const setRoomId = useHQ((s) => s.setRoomId);
  const setDrawer = useHQ((s) => s.setDrawer);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setMessage(null);
    try {
      const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const created = await api.createRoom({ slug, name: trimmed });
      setName("");
      setRoomId(created.id);
      reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not create the room.");
    } finally {
      setBusy(false);
    }
  };

  const runBrief = async () => {
    if (!room) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.runBrief(room.id);
      setDrawer("briefing");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "The brief failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 text-sm text-fg-2">
      {loading && <p className="text-fg-3">Loading rooms…</p>}
      {error && <p className="text-bad">Crew server unreachable: {error}</p>}
      {!loading && !error && rooms.length === 0 && <p className="text-fg-3">No rooms yet. Create one for a real project.</p>}

      <ul className="space-y-2">
        {rooms.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              aria-pressed={room?.id === r.id}
              onClick={() => setRoomId(r.id)}
              className={`w-full rounded-md border bg-raised p-3 text-left focus-visible:outline-focus ${
                room?.id === r.id ? "border-mem" : "border-line"
              }`}
            >
              <span className="block font-semibold text-fg">{r.name}</span>
              <span className="block font-mono text-[13px] text-fg-3">
                day {r.dayIndex} · {r.memoryCount} memories · brief {r.briefAt}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {room && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} onClick={runBrief} disabled={busy}>
            Run brief now
          </button>
          <button type="button" className={button} onClick={() => setDrawer("review")} disabled={busy}>
            Evening debrief
          </button>
          <button type="button" className={button} onClick={() => setDrawer("vault")}>
            Memory
          </button>
        </div>
      )}

      <form
        className="space-y-2 border-t border-line-decor pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label className="block space-y-1">
          <span>New room</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="w-full rounded-md border border-line bg-deep p-2 text-fg focus-visible:outline-focus"
          />
        </label>
        <button type="submit" className={button} disabled={busy || !name.trim()}>
          Create room
        </button>
      </form>

      {message && <p role="alert" className="text-bad">{message}</p>}
    </div>
  );
}
