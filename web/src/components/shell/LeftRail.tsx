"use client";

import { useHQ, type DrawerKind } from "@/lib/store";

const ITEMS: { kind: Exclude<DrawerKind, "agent" | null>; label: string; glyph: string }[] = [
  { kind: "missions", label: "Missions", glyph: "▤" },
  { kind: "vault", label: "Memory Vault", glyph: "◈" },
  { kind: "briefing", label: "Briefing", glyph: "≡" },
];

// Left icon rail. Icon and label both present; the label is the accessible name.
export function LeftRail() {
  const drawer = useHQ((s) => s.drawer);
  const setDrawer = useHQ((s) => s.setDrawer);
  return (
    <nav
      aria-label="Main"
      className="pointer-events-auto absolute left-3 top-16 z-20 flex flex-col gap-2 rounded-md border border-line bg-surface/90 p-1.5"
    >
      {ITEMS.map((item) => {
        const active = drawer === item.kind;
        return (
          <button
            key={item.kind}
            type="button"
            aria-label={item.label}
            aria-pressed={active}
            title={item.label}
            onClick={() => setDrawer(active ? null : item.kind)}
            className={`grid h-9 w-9 place-items-center rounded-sm border text-base focus-visible:outline-focus ${
              active ? "border-mem bg-raised text-mem" : "border-transparent text-fg-2 hover:border-line"
            }`}
          >
            <span aria-hidden="true">{item.glyph}</span>
          </button>
        );
      })}
    </nav>
  );
}
