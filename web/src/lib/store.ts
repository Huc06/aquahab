"use client";

import { create } from "zustand";
import type { MemoryMoment } from "./moments";
import type { AgentId } from "./types";

export type DrawerKind = "rooms" | "board" | "vault" | "briefing" | "moments" | "agent" | "review" | null;
export type ViewKind = "hq" | "city";

// View state only. Business state comes from the crew server (see lib/api.ts).
interface HQState {
  selectedAgent: AgentId | null;
  selectAgent: (id: AgentId | null) => void;
  drawer: DrawerKind;
  setDrawer: (kind: DrawerKind) => void;
  /** The room the CEO is looking at. null means "the first room". */
  roomId: string | null;
  setRoomId: (id: string | null) => void;
  /** Bumped when the room list changes, so every useActiveRoom() refetches. */
  roomsVersion: number;
  roomsChanged: () => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  /** The stored memory currently playing in the full-screen REWIND sequence. */
  replayMoment: MemoryMoment | null;
  setReplayMoment: (moment: MemoryMoment | null) => void;
  musicOn: boolean;
  setMusicOn: (on: boolean) => void;
  view: ViewKind;
  setView: (view: ViewKind) => void;
}

export const useHQ = create<HQState>((set) => ({
  selectedAgent: null,
  selectAgent: (id) => set({ selectedAgent: id, drawer: id ? "agent" : null }),
  drawer: null,
  setDrawer: (kind) => set({ drawer: kind }),
  roomId: null,
  setRoomId: (id) => set({ roomId: id }),
  roomsVersion: 0,
  roomsChanged: () => set((s) => ({ roomsVersion: s.roomsVersion + 1 })),
  chatOpen: false,
  setChatOpen: (open) => set({ chatOpen: open }),
  replayMoment: null,
  setReplayMoment: (moment) => set({ replayMoment: moment }),
  musicOn: false,
  setMusicOn: (on) => set({ musicOn: on }),
  view: "hq",
  setView: (view) => set({ view, drawer: null, chatOpen: false, replayMoment: null }),
}));
