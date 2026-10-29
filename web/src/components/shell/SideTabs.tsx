"use client";

import { useHQ, type DrawerKind } from "@/lib/store";

// Vertical tab column on the right edge. Opens the matching drawer.
const TABS: { kind: Exclude<DrawerKind, "agent" | "missions" | null>; label: string }[] = [
  { kind: "vault", label: "VAULT" },
  { kind: "briefing", label: "BRIEFING" },
];

export function SideTabs() {
  const drawer = useHQ((s) => s.drawer);
  const setDrawer = useHQ((s) => s.setDrawer);
  return (
    <div className="pointer-events-auto absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2">
      {TABS.map((tab) => {
        const active = drawer === tab.kind;
        return (
          <button
            key={tab.kind}
            type="button"
            aria-pressed={active}
            onClick={() => setDrawer(active ? null : tab.kind)}
            className={`w-10 rounded-md border bg-surface/90 py-4 text-[11px] font-semibold tracking-[0.2em] [writing-mode:vertical-rl] focus-visible:outline-focus ${
              active ? "border-mem text-mem" : "border-line text-fg-2"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
