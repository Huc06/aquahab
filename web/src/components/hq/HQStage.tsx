"use client";

import dynamic from "next/dynamic";
import { useHQ } from "@/lib/store";

// The 3D scenes need WebGL and the browser, so they are loaded client-side only.
const HQScene = dynamic(() => import("./HQScene").then((m) => m.HQScene), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-fg-3" role="status">
      Opening HQ…
    </div>
  ),
});

const CityStage = dynamic(() => import("../city/CityStage").then((m) => m.CityStage), { ssr: false });

// Full-bleed stage. Shows the HQ or the city, depending on the view state.
export function HQStage() {
  const view = useHQ((s) => s.view);
  return view === "city" ? <CityStage /> : (
    <div className="absolute inset-0">
      <HQScene />
    </div>
  );
}
