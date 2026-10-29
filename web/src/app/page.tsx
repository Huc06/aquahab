import { HQStage } from "@/components/hq/HQStage";
import { Inspector } from "@/components/shell/Inspector";
import { MissionRail } from "@/components/shell/MissionRail";
import { TopBar } from "@/components/shell/TopBar";

// HQ overview: three-column shell (docs/design/ui-layout-map.md §1, DESIGN.md §5.2).
export default function Page() {
  return (
    <div className="grid h-screen grid-rows-[56px_minmax(0,1fr)]">
      <TopBar />
      <div className="grid min-h-0 grid-cols-[280px_minmax(560px,1fr)_360px]">
        <MissionRail />
        <main className="relative min-h-0 overflow-hidden bg-deep">
          <HQStage />
        </main>
        <Inspector />
      </div>
    </div>
  );
}
