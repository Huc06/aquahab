// Shared types. Names follow docs/architecture/DATA_MODEL.md (§2 enums, §4.4 AgentProfile).

export type AgentId = "one" | "researcher" | "builder" | "lofi" | "hippo";

export type AgentStatus = "idle" | "assigned" | "working" | "review" | "blocked" | "offline";

export type MissionStatus = "draft" | "active" | "review" | "completed" | "failed";

export interface Agent {
  id: AgentId;
  name: string;
  role: string;
  status: AgentStatus;
  currentTask?: string;
  budgetCents: number; // LLM budget for the demo period, USD cents
  spentCents: number;
}

export interface Mission {
  id: string;
  title: string;
  objective: string;
  status: MissionStatus;
  taskCount: number;
  budgetCents: number;
  spentCents: number;
}
