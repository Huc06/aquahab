"use client";

import { CREW } from "@/lib/api-types";
import { DESK_SPOTS } from "@/lib/hq-layout";
import { useCrew } from "@/lib/useCrew";
import { useHQ } from "@/lib/store";

// Top agent tabs: one per desk. A filled dot is someone on the crew; a hollow dot is a vacant desk.
export function AgentTabs() {
  const selected = useHQ((s) => s.selectedAgent);
  const selectAgent = useHQ((s) => s.selectAgent);
  const { byRole, data, error } = useCrew();
  // Until the crew loads, or when it cannot be read, no desk is shown as vacant.
  const known = data !== undefined && !error;
  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-20 flex -translate-x-1/2 gap-1.5 rounded-md border border-line bg-surface/90 p-1.5">
      {DESK_SPOTS.map((spot) => {
        const active = selected === spot.id;
        const onCrew = byRole.has(spot.id);
        return (
          <button
            key={spot.id}
            type="button"
            aria-pressed={active}
            onClick={() => selectAgent(active ? null : spot.id)}
            className={`flex items-center gap-2 rounded-sm border px-3 py-1.5 text-sm focus-visible:outline-focus ${
              active ? "border-mem bg-raised text-fg" : "border-transparent text-fg-2 hover:border-line"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${!known ? "bg-idle" : onCrew ? "bg-agent-dot" : "border border-idle bg-transparent"}`}
              aria-hidden="true"
            />
            <span className="font-medium">{CREW[spot.id].name}</span>
            <span className="sr-only">{!known ? ", crew unavailable" : onCrew ? ", on the crew" : ", vacant"}</span>
          </button>
        );
      })}
    </div>
  );
}
