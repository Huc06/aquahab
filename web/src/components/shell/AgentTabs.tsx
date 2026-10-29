"use client";

import { AGENTS } from "@/lib/mock";
import { useHQ } from "@/lib/store";
import type { AgentStatus } from "@/lib/types";

const DOT: Record<AgentStatus, string> = {
  idle: "border border-idle bg-transparent",
  assigned: "bg-info-text",
  working: "bg-agent-dot",
  review: "bg-ok",
  blocked: "bg-bad",
  offline: "bg-idle",
};

const LABEL: Record<AgentStatus, string> = {
  idle: "Idle",
  assigned: "Assigned",
  working: "Working",
  review: "Ready for review",
  blocked: "Blocked",
  offline: "Offline",
};

// Top agent tabs: five fixed roles. Selecting a tab selects the desk in the scene.
export function AgentTabs() {
  const selected = useHQ((s) => s.selectedAgent);
  const selectAgent = useHQ((s) => s.selectAgent);
  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-20 flex -translate-x-1/2 gap-1.5 rounded-md border border-line bg-surface/90 p-1.5">
      {AGENTS.map((agent) => {
        const active = selected === agent.id;
        return (
          <button
            key={agent.id}
            type="button"
            aria-pressed={active}
            onClick={() => selectAgent(active ? null : agent.id)}
            className={`flex items-center gap-2 rounded-sm border px-3 py-1.5 text-sm focus-visible:outline-focus ${
              active ? "border-mem bg-raised text-fg" : "border-transparent text-fg-2 hover:border-line"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${DOT[agent.status]}`} aria-hidden="true" />
            <span className="font-medium">{agent.name}</span>
            <span className="sr-only">, {LABEL[agent.status]}</span>
          </button>
        );
      })}
    </div>
  );
}
