// Mock data for the UI scaffold only. Replace with API data (docs/architecture/API_DESIGN.md).
import type { Agent, Mission } from "./types";

export const AGENTS: Agent[] = [
  { id: "one", name: "One", role: "Chief of staff", status: "idle", budgetCents: 150, spentCents: 0 },
  {
    id: "researcher",
    name: "Researcher",
    role: "Market brief",
    status: "working",
    currentTask: "Market brief",
    budgetCents: 150,
    spentCents: 92,
  },
  {
    id: "builder",
    name: "Builder",
    role: "Launch plan",
    status: "working",
    currentTask: "Launch plan",
    budgetCents: 150,
    spentCents: 116,
  },
  { id: "lofi", name: "Lofi", role: "Creative", status: "idle", budgetCents: 150, spentCents: 0 },
  {
    id: "hippo",
    name: "Hippo",
    role: "Operations",
    status: "assigned",
    currentTask: "Quality review",
    budgetCents: 150,
    spentCents: 0,
  },
];

export const MISSIONS: Mission[] = [
  {
    id: "m-001",
    title: "Vietnam wallet launch",
    objective: "Plan a Sui wallet launch for Vietnam.",
    status: "active",
    taskCount: 3,
    budgetCents: 500,
    spentCents: 286,
  },
  {
    id: "m-002",
    title: "Source review",
    objective: "Check citations for the market brief.",
    status: "review",
    taskCount: 1,
    budgetCents: 100,
    spentCents: 86,
  },
  {
    id: "m-003",
    title: "First memory",
    objective: "Prepare the first CEO preference.",
    status: "draft",
    taskCount: 0,
    budgetCents: 100,
    spentCents: 0,
  },
];

export const COMPANY_BUDGET = { budgetCents: 500, spentCents: 286 };
