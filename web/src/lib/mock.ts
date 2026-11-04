// Mock data for the UI scaffold only. Replace with API data (docs/architecture/API_DESIGN.md).
import type { Agent } from "./types";

export const AGENTS: Agent[] = [
  { id: "one", name: "One", role: "Chief of Staff", status: "idle", budgetCents: 150, spentCents: 0 },
  {
    id: "researcher",
    name: "Researcher",
    role: "Head of Research",
    status: "working",
    currentTask: "Market brief",
    budgetCents: 150,
    spentCents: 92,
  },
  {
    id: "builder",
    name: "Builder",
    role: "Head of Engineering",
    status: "working",
    currentTask: "Launch plan",
    budgetCents: 150,
    spentCents: 116,
  },
  { id: "lofi", name: "Lofi", role: "Head of Growth", status: "idle", budgetCents: 150, spentCents: 0 },
  {
    id: "hippo",
    name: "Hippo",
    role: "Head of Finance & Ops",
    status: "assigned",
    currentTask: "Quality review",
    budgetCents: 150,
    spentCents: 0,
  },
];

export const COMPANY_BUDGET = { budgetCents: 500, spentCents: 286 };
