"use client";

import dynamic from "next/dynamic";

// The 3D scene needs WebGL and the browser, so it is loaded client-side only.
const HQScene = dynamic(() => import("./HQScene").then((m) => m.HQScene), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-fg-3" role="status">
      Opening HQ…
    </div>
  ),
});

export function HQStage() {
  return (
    <div className="absolute inset-0">
      <HQScene />
      <p className="pointer-events-none absolute left-4 top-3 font-mono text-[13px] text-fg-2">
        Routing: Researcher · Builder
      </p>
    </div>
  );
}
