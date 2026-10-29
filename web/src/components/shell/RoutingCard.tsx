import { MISSIONS } from "@/lib/mock";

// Top-right status card: progress of the mission that is routing now.
export function RoutingCard() {
  const mission = MISSIONS.find((m) => m.status === "active") ?? MISSIONS[0];
  return (
    <section
      aria-label="Routing status"
      className="pointer-events-auto absolute right-16 top-3 z-20 w-64 rounded-md border border-line bg-surface/90 p-3"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-fg-3">Routing</p>
      <p className="mt-1 text-sm font-semibold text-fg">{mission.title}</p>
      <p className="mt-1 font-mono text-[13px] text-fg-2">
        {mission.taskCount} tasks · {mission.spentCents}¢ of {mission.budgetCents}¢
      </p>
    </section>
  );
}
