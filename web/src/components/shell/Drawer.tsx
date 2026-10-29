"use client";

import { useEffect } from "react";
import { AGENTS, COMPANY_BUDGET, MISSIONS } from "@/lib/mock";
import { useHQ, type DrawerKind } from "@/lib/store";

const TITLE: Record<Exclude<DrawerKind, null>, string> = {
  missions: "Missions",
  vault: "Memory Vault",
  briefing: "Briefing",
  agent: "Agent",
};

function Missions() {
  return (
    <ul className="space-y-2">
      {MISSIONS.map((m) => (
        <li key={m.id} className="rounded-md border border-line bg-raised p-3">
          <p className="text-sm font-semibold text-fg">{m.title}</p>
          <p className="text-sm text-fg-2">{m.objective}</p>
          <p className="mt-1 font-mono text-[13px] text-fg-3">
            {m.status} · {m.taskCount} tasks · {m.spentCents}¢ of {m.budgetCents}¢
          </p>
        </li>
      ))}
    </ul>
  );
}

function Vault() {
  return (
    <div className="space-y-3 text-sm text-fg-2">
      <p>
        Company memory: <span className="font-mono text-fg">14 memories · 48 KB</span>
      </p>
      <p className="text-fg-3">Stored until a date. Expired memory stays visible.</p>
      <p className="text-fg-3">Memory items load from Walrus once the backend is connected.</p>
    </div>
  );
}

function Briefing() {
  const sections = ["Active missions", "Recent decisions", "Open risks", "Memory added this week"];
  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <section key={s}>
          <h3 className="text-sm font-semibold text-fg">{s}</h3>
          <p className="text-sm text-fg-3">Nothing recorded yet.</p>
        </section>
      ))}
    </div>
  );
}

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
        {drawer === "missions" && <Missions />}
        {drawer === "vault" && <Vault />}
        {drawer === "briefing" && <Briefing />}
        {drawer === "agent" && <AgentDetail />}
      </div>
    </aside>
  );
}
