import { COMPANY_BUDGET, MISSIONS } from "@/lib/mock";
import type { Mission, MissionStatus } from "@/lib/types";

const STATUS_STYLE: Record<MissionStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "text-idle border-line" },
  active: { label: "Active", className: "text-agent border-line" },
  review: { label: "Review", className: "text-warn border-line" },
  completed: { label: "Completed", className: "text-ok border-line" },
  failed: { label: "Failed", className: "text-bad border-line" },
};

function MissionCard({ mission }: { mission: Mission }) {
  const status = STATUS_STYLE[mission.status];
  const edge =
    mission.status === "active"
      ? "border-l-[3px] border-l-mem"
      : mission.status === "review"
        ? "border-l-[3px] border-l-warn"
        : "";
  return (
    <article
      className={`mb-2 rounded-md border border-line bg-raised p-3 ${edge} ${
        mission.status === "draft" ? "border-dashed" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">{mission.title}</h3>
        <span className={`shrink-0 rounded-sm border px-2 py-0.5 text-xs ${status.className}`}>
          {status.label}
        </span>
      </div>
      <p className="mt-1 text-sm text-fg-2">{mission.objective}</p>
      <p className="mt-2 font-mono text-[13px] text-fg-3">
        {mission.taskCount} tasks · {mission.spentCents}¢ of {mission.budgetCents}¢
      </p>
    </article>
  );
}

export function MissionRail() {
  const left = COMPANY_BUDGET.budgetCents - COMPANY_BUDGET.spentCents;
  const pct = Math.round((COMPANY_BUDGET.spentCents / COMPANY_BUDGET.budgetCents) * 100);
  return (
    <aside className="overflow-y-auto border-r border-line-decor bg-surface p-4" aria-label="Missions">
      <h2 className="text-xl font-semibold tracking-tight text-fg">Mission Board</h2>
      <p className="mb-4 mt-1 text-sm text-fg-2">Route work. Inspect the real state.</p>

      <button
        type="button"
        className="h-9 w-full rounded-md bg-action-fill text-sm font-medium text-on-accent focus-visible:outline-focus"
      >
        Assign mission
      </button>

      <div className="mt-4">
        {MISSIONS.map((m) => (
          <MissionCard key={m.id} mission={m} />
        ))}
      </div>

      <div className="mt-6 border-t border-line-decor pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-fg-2">Company budget</p>
        <div className="mt-2 flex justify-between text-sm text-fg">
          <span>LLM</span>
          <span className="font-mono text-[13px]">
            {COMPANY_BUDGET.spentCents}¢ of {COMPANY_BUDGET.budgetCents}¢
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-sm bg-deep" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="LLM budget used">
          <div className="h-full bg-mem" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 font-mono text-[13px] text-fg-3">
          {Math.round((left / COMPANY_BUDGET.budgetCents) * 100)}% left · normal
        </p>
      </div>
    </aside>
  );
}
