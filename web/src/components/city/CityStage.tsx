"use client";

import dynamic from "next/dynamic";

const CityScene = dynamic(() => import("./CityScene").then((m) => m.CityScene), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-fg-3" role="status">
      Loading Aqua City…
    </div>
  ),
});

export function CityStage() {
  return (
    <div className="absolute inset-0">
      <CityScene />
    </div>
  );
}
