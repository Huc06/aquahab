"use client";

import { create } from "zustand";
import type { AgentId } from "./types";

export type DrawerKind = "missions" | "vault" | "briefing" | "agent" | null;
export type ViewKind = "hq" | "city";

// View state only. Business state comes from the API (RESHADED V1 stack, DESIGN.md §5.2).
interface HQState {
  selectedAgent: AgentId | null;
  selectAgent: (id: AgentId | null) => void;
  drawer: DrawerKind;
  setDrawer: (kind: DrawerKind) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
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
  chatOpen: false,
  setChatOpen: (open) => set({ chatOpen: open }),
  musicOn: false,
  setMusicOn: (on) => set({ musicOn: on }),
  view: "hq",
  setView: (view) => set({ view, drawer: null, chatOpen: false }),
}));
