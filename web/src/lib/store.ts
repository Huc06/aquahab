"use client";

import { create } from "zustand";
import type { AgentId } from "./types";

// View state only. Business state comes from the API (RESHADED V1 stack, DESIGN.md §5.2).
interface HQState {
  selectedAgent: AgentId | null;
  selectAgent: (id: AgentId | null) => void;
}

export const useHQ = create<HQState>((set) => ({
  selectedAgent: null,
  selectAgent: (id) => set({ selectedAgent: id }),
}));
