"use client";

import { AGENTS } from "@/lib/mock";
import { useHQ } from "@/lib/store";
import type { Agent, AgentStatus } from "@/lib/types";

// Status pill: icon and label, never color alone (DESIGN.md §6.4).
const PILL: Record<AgentStatus, { label: string; className: string; icon: string }> = {
  idle: { label: "Idle", className: "text-idle", icon: "○" },
  assigned: { label: "Assigned", className: "text-info-text", icon: "→" },
  working: { label: "Working", className: "text-agent", icon: "●" },
  review: { label: "Ready for review", className: "text-ok", icon: "✓" },
  blocked: { label: "Blocked", className: "text-fg", icon: "▲" },
  offline: { label: "Offline", className: "text-idle", icon: "–" },
};

function StatusPill({ status }: { status: AgentStatus }) {
  const p = PILL[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border border-line px-2 py-0.5 text-xs ${p.className}`}>
      <span aria-hidden="true">{p.icon}</span>
      {p.label}
    </span>
  );
}

function BudgetBar({ agent }: { agent: Agent }) {
  const pct = Math.round((agent.spentCents / agent.budgetCents) * 100);
  const low = 100 - pct < 20;
  return (
    <div className="mt-2">
      <div className="flex justify-between font-mono text-[13px] text-fg-2">
        <span className="font-sans">LLM</span>
        <span>
          {agent.spentCents}¢ of {agent.budgetCents}¢
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-sm bg-deep" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${agent.name} LLM budget used`}>
        <div className={`h-full ${low ? "bg-warn" : "bg-mem"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Inspector() {
  const selectedId = useHQ((s) => s.selectedAgent);
  const selectAgent = useHQ((s) => s.selectAgent);
  const selected = AGENTS.find((a) => a.id === selectedId) ?? null;

  return (
    <aside className="overflow-y-auto border-l border-line-decor bg-surface p-4" aria-label="Agents">
      <h2 className="text-xl font-semibold tracking-tight text-fg">Agents</h2>
      <p className="mb-4 mt-1 text-sm text-fg-2">Five fixed roles. Desks never move.</p>

      <ul className="space-y-2">
        {AGENTS.map((agent) => {
          const isSelected = agent.id === selectedId;
          return (
            <li key={agent.id}>
              <button
                type="button"
                onClick={() => selectAgent(isSelected ? null : agent.id)}
                aria-pressed={isSelected}
                className={`w-full rounded-md border bg-raised p-3 text-left focus-visible:outline-focus ${
                  isSelected ? "border-mem" : "border-line"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-agent">{agent.name}</p>
                    <p className="text-sm text-fg-2">{agent.role}</p>
                  </div>
                  <StatusPill status={agent.status} />
                </div>
                <BudgetBar agent={agent} />
              </button>
            </li>
          );
        })}
      </ul>

      {selected && (
        <section className="mt-6 border-t border-line-decor pt-4" aria-live="polite">
          <h3 className="text-base font-semibold text-fg">{selected.name}</h3>
          <p className="mt-1 text-sm text-fg-2">
            {selected.currentTask ? `Current task: ${selected.currentTask}` : "No current task"}
          </p>
          <p className="mt-2 text-sm text-fg-3">Agents own no memories. Access is enforced by Aquahab.</p>
        </section>
      )}
    </aside>
  );
}
