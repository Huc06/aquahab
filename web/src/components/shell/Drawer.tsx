"use client";

import { useEffect } from "react";
import { AGENTS, COMPANY_BUDGET } from "@/lib/mock";
import { useHQ, type DrawerKind } from "@/lib/store";
import { RoomsPanel } from "@/components/rooms/RoomsPanel";
import { VaultPanel } from "@/components/memory/VaultPanel";
import { BriefingPanel } from "@/components/briefing/BriefingPanel";
import { BoardPanel } from "@/components/board/BoardPanel";
import { ReviewPanel } from "@/components/review/ReviewPanel";

const TITLE: Record<Exclude<DrawerKind, null>, string> = {
  rooms: "Rooms",
  board: "Board",
  vault: "Memory",
  briefing: "Morning brief",
  agent: "Agent",
  review: "Evening debrief",
};

function AgentDetail() {
  const id = useHQ((s) => s.selectedAgent);
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) return <p className="text-sm text-fg-3">Select an agent on the stage or in the top bar.</p>;
  const pct = Math.round((agent.spentCents / agent.budgetCents) * 100);
  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold text-agent">{agent.name}</p>
        <p className="text-sm text-fg-2">{agent.role}</p>
      </div>
      <p className="text-sm text-fg-2">{agent.currentTask ? `Current task: ${agent.currentTask}` : "No current task."}</p>
      <div>
        <div className="flex justify-between font-mono text-[13px] text-fg-2">
          <span className="font-sans">LLM</span>
          <span>
            {agent.spentCents}¢ of {agent.budgetCents}¢
          </span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-sm bg-deep" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${agent.name} LLM budget used`}>
          <div className="h-full bg-mem" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <p className="text-sm text-fg-3">Agents own no memories. Access is enforced by Aquahab.</p>
      <p className="font-mono text-[13px] text-fg-3">Company budget: {COMPANY_BUDGET.spentCents}¢ of {COMPANY_BUDGET.budgetCents}¢</p>
    </div>
  );
}

// Right-side drawer. Opened by rail, side tabs, or selecting an agent.
// Escape closes it and focus returns to the control that opened it.
export function Drawer() {
  const drawer = useHQ((s) => s.drawer);
  const setDrawer = useHQ((s) => s.setDrawer);
  const selectAgent = useHQ((s) => s.selectAgent);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer, setDrawer]);

  if (!drawer) return null;

  const close = () => {
    setDrawer(null);
    selectAgent(null);
  };

  return (
    <aside
      role="dialog"
      aria-label={TITLE[drawer]}
      className="pointer-events-auto absolute bottom-14 right-16 top-16 z-30 flex w-[360px] flex-col rounded-md border border-line bg-surface/95"
    >
      <header className="flex items-center justify-between border-b border-line-decor px-4 py-3">
        <h2 className="text-base font-semibold text-fg">{TITLE[drawer]}</h2>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="grid h-8 w-8 place-items-center rounded-sm border border-line text-fg-2 focus-visible:outline-focus"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {drawer === "rooms" && <RoomsPanel />}
        {drawer === "board" && <BoardPanel />}
        {drawer === "vault" && <VaultPanel />}
        {drawer === "briefing" && <BriefingPanel />}
        {drawer === "agent" && <AgentDetail />}
        {drawer === "review" && <ReviewPanel />}
      </div>
    </aside>
  );
}
