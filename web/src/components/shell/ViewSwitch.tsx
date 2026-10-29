"use client";

import { useHQ } from "@/lib/store";

// Jumps between the HQ and the Aqua City preview.
export function ViewSwitch() {
  const view = useHQ((s) => s.view);
  const setView = useHQ((s) => s.setView);
  const toCity = view === "hq";
  return (
    <button
      type="button"
      onClick={() => setView(toCity ? "city" : "hq")}
      className="pointer-events-auto absolute bottom-12 left-3 z-30 rounded-md border border-line bg-surface/95 px-4 py-2 text-sm font-medium text-fg focus-visible:outline-focus"
    >
      {toCity ? "Aqua City" : "Back to HQ"}
    </button>
  );
}
