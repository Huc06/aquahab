import { HQStage } from "@/components/hq/HQStage";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { AgentTabs } from "@/components/shell/AgentTabs";
import { BottomBar } from "@/components/shell/BottomBar";
import { Drawer } from "@/components/shell/Drawer";
import { LeftRail } from "@/components/shell/LeftRail";
import { RoutingCard } from "@/components/shell/RoutingCard";
import { SideTabs } from "@/components/shell/SideTabs";

// HQ overview: full-bleed 3D scene with overlay controls (docs/product/DECISIONS.md §9).
// Overlays are pointer-events-none by default, so the scene stays draggable behind them.
export default function Page() {
  return (
    <main className="pointer-events-none relative h-screen overflow-hidden bg-deep">
      <HQStage />
      <AgentTabs />
      <LeftRail />
      <RoutingCard />
      <SideTabs />
      <Drawer />
      <ChatPanel />
      <BottomBar />
    </main>
  );
}
