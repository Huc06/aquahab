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

// Full-bleed stage. Overlays are rendered by the page on top of it.
export function HQStage() {
  return (
    <div className="absolute inset-0">
      <HQScene />
    </div>
  );
}
