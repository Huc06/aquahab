"use client";

import { useEffect } from "react";
import { CREW } from "@/lib/api-types";
import { useCrew } from "@/lib/useCrew";
import { useHQ, type DrawerKind } from "@/lib/store";
import { RoomsPanel } from "@/components/rooms/RoomsPanel";
import { VaultPanel } from "@/components/memory/VaultPanel";
import { BriefingPanel } from "@/components/briefing/BriefingPanel";
import { BoardPanel } from "@/components/board/BoardPanel";
import { ReviewPanel } from "@/components/review/ReviewPanel";
import { MomentsPanel } from "@/components/moments/MomentsPanel";

const TITLE: Record<Exclude<DrawerKind, null>, string> = {
  rooms: "Rooms",
  board: "Board",
  vault: "Memory",
  briefing: "Morning brief",
  moments: "Rewind",
  agent: "Agent",
  review: "Evening debrief",
};

function AgentDetail() {
  const id = useHQ((s) => s.selectedAgent);
  const { byRole, loading } = useCrew();
  if (!id) return <p className="text-sm text-fg-3">Select an agent on the stage or in the top bar.</p>;
  const member = byRole.get(id);
  if (loading && !member) return <p className="text-sm text-fg-3">Loading crew…</p>;
  if (!member) return <p className="text-sm text-fg-3">{CREW[id].name} has no key on the crew right now.</p>;
  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold text-agent">{member.name}</p>
        <p className="text-sm text-fg-2">{member.title ?? CREW[id].title}</p>
      </div>
      <p className="font-mono text-[13px] text-fg-2">
        {member.memoryCount} memories filed
        {member.hiredAt ? ` · hired ${member.hiredAt.slice(0, 10)}` : ""}
      </p>
      <p className="text-sm text-fg-3">Agents own no memories. Access is enforced by Aquahab.</p>
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
        {drawer === "moments" && <MomentsPanel />}
        {drawer === "agent" && <AgentDetail />}
        {drawer === "review" && <ReviewPanel />}
      </div>
    </aside>
  );
}
