"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { useHQ } from "./store";
import type { MemoryJob, Room } from "./api-types";

// Loads one resource from the crew server. Reloads when `key` changes or when reload() is called.
// A null loader means "nothing to load yet".
// `loading` is derived from which request the state answers, so it is true while a request is in flight
// (including the first one after `load` stops being null), and data from an older key is never shown.
export function useApi<T>(load: (() => Promise<T>) | null, key: unknown[]) {
  const keySig = JSON.stringify(key);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<{ data: T | null; error: string | null; keySig: string | null; tick: number }>({
    data: null,
    error: null,
    keySig: null,
    tick: 0,
  });

  useEffect(() => {
    if (!load) return;
    let alive = true;
    load().then(
      (data) => alive && setState({ data, error: null, keySig, tick }),
      (e: unknown) => alive && setState({ data: null, error: e instanceof Error ? e.message : String(e), keySig, tick }),
    );
    return () => {
      alive = false;
    };
    // `load` is a new closure each render; the explicit `key` and `tick` drive the refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, keySig]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const sameKey = state.keySig === keySig;
  return {
    data: sameKey ? state.data : null,
    error: sameKey ? state.error : null,
    loading: load !== null && (!sameKey || state.tick !== tick),
    reload,
  };
}

// The active room: the one picked in Rooms, else the first room the server returns.
// Every caller refetches when `roomsVersion` changes, so the chat and the room card follow a new room.
export function useActiveRoom() {
  const version = useHQ((s) => s.roomsVersion);
  const rooms = useApi(() => api.rooms(), [version]);
  const picked = useHQ((s) => s.roomId);
  const list: Room[] = rooms.data ?? [];
  const room = list.find((r) => r.id === picked) ?? list[0] ?? null;
  return { rooms: list, room, loading: rooms.loading, error: rooms.error, reload: rooms.reload };
}

const TERMINAL = new Set<MemoryJob["status"]>(["stored", "failed"]);

// Polls a memory job until it reaches stored or failed. Returns a cancel function.
export function watchJob(jobId: string, onUpdate: (job: MemoryJob) => void): () => void {
  let alive = true;
  let timer: ReturnType<typeof setTimeout>;
  const poll = () => {
    api
      .job(jobId)
      .then((job) => {
        if (!alive) return;
        onUpdate(job);
        if (!TERMINAL.has(job.status)) timer = setTimeout(poll, 1500);
      })
      .catch(() => {
        if (alive) timer = setTimeout(poll, 3000);
      });
  };
  poll();
  return () => {
    alive = false;
    clearTimeout(timer);
  };
}
