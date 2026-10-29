import { HQStage } from "@/components/hq/HQStage";
import { HQOverlays } from "@/components/shell/HQOverlays";
import { BottomBar } from "@/components/shell/BottomBar";
import { ViewSwitch } from "@/components/shell/ViewSwitch";

// Full-bleed 3D stage with overlay controls (docs/product/DECISIONS.md §9).
// Overlays are pointer-events-none by default, so the scene stays draggable behind them.
export default function Page() {
  return (
    <main className="pointer-events-none relative h-screen overflow-hidden bg-deep bg-[url(/backgrounds/seabed.webp)] bg-cover bg-center">
      <HQStage />
      <HQOverlays />
      <ViewSwitch />
      <BottomBar />
    </main>
  );
}
