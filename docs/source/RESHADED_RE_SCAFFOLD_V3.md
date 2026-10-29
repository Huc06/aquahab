# Agent Funding &amp; Permissions

## Principle

Aquahab agents are funded with work budgets, not trading capital.

A CEO funds an agent with:

- compute credits for AI/task execution

- memory allowance for Walrus Memory creation and renewal

- task allowance

- tool/API allowance

- optional spending cap

The CEO wallet remains the owner of the company and Walrus Memory space.

Agents use delegated, scoped access through the Aquahab backend.

## Agent Funding Model

\`\`\`ts

interface AgentBudget {

  agentId: string;

  companyId: string;

  computeCredits: number;

  memoryAllowance: number;

  memoryStorageEpochs: number;

  taskAllowance: number;

  toolCallAllowance: number;

  spendingCapUsd: number;

  renewalPolicy: "manual" | "auto";

}

\`\`\`

## Agent Permissions

\`\`\`ts

interface AgentPermissions {

  canReadCompanyMemory: boolean;

  canWriteAgentMemory: boolean;

  canWriteCompanyMemory: boolean;

  canCreateTasks: boolean;

  canCallExternalTools: boolean;

  maxMemoryRecallResults: number;

  maxComputeCreditsPerTask: number;

}

\`\`\`

## Create Agent UX

1. Name the agent.

2. Select role.

3. Describe its strategy or upload [`skills.md`](http://skills.md).

4. Choose frequency: on mission, daily, weekly.

5. Fund compute and memory budget.

6. Set permissions and spending cap.

7. Deploy agent to its desk.

## MVP Rule

For the hackathon MVP:

- One backend delegate key serves all agents.

- Each agent has a budget and permission profile.

- Agent cannot access another company’s memory.

- Agent cannot spend beyond its compute/memory allowance.

- CEO can pause, refund remaining budget conceptually, or revoke access.