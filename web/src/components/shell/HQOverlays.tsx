"use client";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { useHQ } from "@/lib/store";
import { AgentTabs } from "./AgentTabs";
import { Drawer } from "./Drawer";
import { LeftRail } from "./LeftRail";
import { RoutingCard } from "./RoutingCard";
import { SideTabs } from "./SideTabs";

// HQ-only controls. They are hidden while the city view is shown.
export function HQOverlays() {
  const view = useHQ((s) => s.view);
  if (view !== "hq") return null;
  return (
    <>
      <AgentTabs />
      <LeftRail />
      <RoutingCard />
      <SideTabs />
      <Drawer />
      <ChatPanel />
    </>
  );
}
