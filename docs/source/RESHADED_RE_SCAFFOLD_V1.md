# Aquahab — RESHADED Re-Scaffold v1

## Mission

Upgrade the existing Aquahab scaffold from v0 to v1.

Do not discard the current scaffold. Treat it as the baseline.

Refactor and extend it into a working hackathon MVP.

Aquahab is a 3D habitat where a CEO runs a company of AI agents that

remember every mission, preference, and decision.

Aquahab = Aqua (shared digital ocean / memory ocean)

        + Habitat (a living 3D workplace for AI agents).

## Core Loop

1. CEO assigns a mission.

2. One / Chief of Staff routes tasks to role-based agents.

3. Each agent recalls relevant memories before working.

4. Agents complete tasks and return outputs.

5. CEO reviews and gives feedback.

6. Preferences, outcomes, feedback, and decisions become memories.

7. Walrus Memory stores and recalls those memories.

8. The next similar mission produces a better, more aligned result.

## Hard Rules

- MVP is Phase 1 only: private Aquahab HQ.

- Aqua City multiplayer is Phase 2 and must not enter MVP.

- Memory must affect the next mission.

- Do not invent Walrus Memory or Tatum APIs.

- Use official Walrus Memory methods:

  `remember`, `waitForRememberJob`, `recall`, `analyze`, `ask`,

  `restore`, `health`.

- Do not store player position or chat in Walrus Memory.

- The main demo is the same mission type before and after memory exists.

---

# R — Requirements

## Functional

- CEO creates a mission with title, objective, constraints, and priority.

- Chief of Staff routes the mission into tasks.

- Tasks are assigned to role-based agents.

- Agents recall relevant memories before starting a task.

- Agents complete tasks and submit outputs.

- CEO approves or gives feedback.

- Feedback, preferences, outcomes, and decisions become memories.

- Memory Vault displays memories and Walrus/Sui proof.

- Page refresh preserves memory context.

- Same mission type produces a visibly better result after feedback.

## Non-Functional

- Memory recall target: 3–5 seconds.

- Mission completion target: 60–90 seconds.

- MVP supports 1–10 CEOs and 4–6 agents per company.

- MVP includes 5–8 mission templates.

- AI or Walrus failure must show `blocked` or `retrying`, not crash.

- No production auth, billing, mobile support, or horizontal scaling.

- No real-time multiplayer in MVP.

---

# E — Estimation

| Metric | MVP target |

|---|---:|

| Concurrent CEOs | 1–10 |

| Agents per company | 4–6 |

| Tasks per mission | 3–6 |

| Memories per mission | 3–10 |

| Recall results per task | 3–5 |

| Mission completion | 60–90 seconds |

| Demo missions | 2 |

| Demo video | 2–3 minutes |

Implication: use a simple backend, polling or lightweight async updates,

one HQ scene, and no distributed queue or multiplayer server.

---

# S — Storage Schema / Walrus Memory

## Entities

\`\`\`ts

type MemoryScope = "agent" | "project" | "company";

type MemoryType = "preference" | "outcome" | "feedback" | "decision";

interface User {

  id: string;

  walletAddress?: string;

  displayName: string;

  companyId: string;

}

interface Company {

  id: string;

  ownerId: string;

  name: string;

  memoryNamespace: string;

}

interface Agent {

  id: string;

  companyId: string;

  name: string;

  role: "chief\_of\_staff" | "researcher" | "builder" | "creative" | "operations";

  status: "idle" | "assigned" | "working" | "review" | "blocked" | "offline";

  currentTaskId?: string;

  deskPosition: { x: number; y: number; z: number };

  memoryNamespace: string;

}

interface Mission {

  id: string;

  companyId: string;

  ceoId: string;

  title: string;

  objective: string;

  constraints: string[];

  status: "draft" | "active" | "review" | "completed" | "failed";

}

interface Task {

  id: string;

  missionId: string;

  agentId: string;

  title: string;

  input: string;

  output?: string;

  status: "assigned" | "working" | "review" | "done" | "blocked";

  blockerReason?: string;

}

interface Feedback {

  id: string;

  missionId: string;

  taskId: string;

  ceoId: string;

  rating: "positive" | "neutral" | "negative";

  comment: string;

  correctiveInstruction?: string;

}

interface AquahabMemory {

  id: string;

  companyId: string;

  ownerType: "agent" | "company";

  ownerId: string;

  scope: MemoryScope;

  type: MemoryType;

  content: string;

  sourceMissionId?: string;

  sourceTaskId?: string;

  confidence: number;

  walrusJobId?: string;

  walrusBlobId?: string;

}

\`\`\`

## Memory Rules

| Event | Memory type | Scope |

|---|---|---|

| CEO gives a preference | `preference` | `agent` or `company` |

| Agent completes a task | `outcome` | `agent` or `project` |

| CEO gives corrective feedback | `feedback` | `agent` |

| CEO approves a strategic direction | `decision` | `company` |

Example:

\`\`\`json

{

  "scope": "agent",

  "type": "feedback",

  "ownerId": "researcher\_01",

  "content": "CEO wants concise, cited market briefs with no hype.",

  "confidence": 0.9

}

\`\`\`

---

# H — High-Level Design

\`\`\`text

[Aquahab 3D HQ UI]

        |

[Client State / API Layer]

        |

[Mission Orchestrator / Task Router]

        |

+----------------------+----------------------+

|                      |                      |

[Agent Runtime]   [Aqua Memory Vault]   [Tatum / Sui Layer]

|                      |                      |

[LLM / Tatum AI]  [Walrus Memory]       [RPC / Data / AI]

\`\`\`

## Responsibilities

- 3D HQ UI: office, desks, agents, mission board, memory vault.

- Client state: current user, company, agents, missions, tasks.

- Orchestrator: create tasks, route work, update task status.

- Agent Runtime: build prompt, call AI, return output.

- Memory Vault: store, recall, display, and prove memories.

- Walrus Memory: persistent portable memory.

- Tatum Layer: Sui infrastructure, RPC/data, AI capability.

## Main Flow

\`\`\`text

CEO -&gt; create mission

Orchestrator -&gt; create and route tasks

Agent -&gt; recall memories

Walrus -&gt; return relevant memories

Agent -&gt; generate output using memories

CEO -&gt; give feedback

Memory Vault -&gt; store feedback/outcome/preference

Walrus -&gt; return job\_id / blob\_id

Next mission -&gt; agent recalls memory and improves

\`\`\`

---

# A — APIs

Internal APIs only.

\`\`\`ts

POST /api/missions

Create a mission.

GET /api/missions/:missionId

Get mission, tasks, agents, outputs, and status.

POST /api/tasks/:taskId/start

Mark task as working and trigger memory recall.

POST /api/tasks/:taskId/complete

Submit agent output.

POST /api/tasks/:taskId/feedback

Submit CEO feedback and create memory.

POST /api/memory/recall

Recall relevant memories for an agent and mission.

POST /api/memory/remember

Store a new memory.

GET /api/memory/vault

List memories by company, scope, and owner.

GET /api/memory/:memoryId/proof

Return Walrus job/blob proof.

GET /api/agents

List agents, roles, statuses, desks, and current tasks.

\`\`\`

---

# D — Detailed Design

## Task State Machine

\`\`\`text

assigned → working → review → done

                 ↘ blocked

\`\`\`

- `assigned`: task created.

- `working`: agent started and recalled memory.

- `review`: output submitted.

- `done`: CEO approved.

- `blocked`: AI, Walrus, or orchestration failed.

## Agent Runtime

\`\`\`text

1. Receive task.

2. Set status = working.

3. Build recall query from mission, task, role, and constraints.

4. Call Walrus recall.

5. Build AI prompt with role, mission, task, and recalled memories.

6. Call Tatum AI / LLM.

7. Return structured output.

8. Set status = review.

\`\`\`

## Memory Recall

- Recall before task execution.

- Use mission objective, task input, and agent role as query.

- Return 3–5 memories.

- Prefer relevance, recency, confidence, and company constraints.

- Inject memories explicitly into the AI prompt.

## Error Handling

| Failure | UI behavior | Recovery |

|---|---|---|

| AI fails | Task = blocked | Retry |

| Walrus remember fails | “Memory not saved” | Retry write |

| Walrus recall fails | Continue with empty context | Show warning |

| Network fails | Global error banner | Retry |

---

# E — Evaluation

| Decision | Choice | Trade-off |

|---|---|---|

| Memory | Walrus Memory | Persistent and verifiable, but adds latency |

| Orchestration | Simple state machine | Easy to ship, less autonomous |

| 3D | One HQ diorama | Focused and achievable, no open world |

| Multiplayer | Phase 2 | Protects MVP deadline |

| AI | Tatum AI + structured prompts | Reliable, less free-form |

| Demo | Repeat one mission type | Clearly proves memory value |

Do not build in v1:

- Aqua City multiplayer.

- Real-time presence.

- Voice chat.

- Complex animation.

- Open-world navigation.

- Production auth or billing.

- Dozens of agents or departments.

---

# D — Distinctive Component

## Aqua Memory Vault

The Aqua Memory Vault is Aquahab’s distinctive component.

It is not chat history or a game save. It is the company’s persistent,

verifiable memory layer.

It must show:

- Company, project, and agent memories.

- Memory type: preference, outcome, feedback, decision.

- Source mission/task.

- Confidence and created time.

- Walrus job/blob proof.

- A visible recall animation when an agent uses memory.

## Demo Script

\`\`\`text

Mission 1:

CEO: “Plan a Sui wallet launch for Vietnam.”

Researcher returns a long, hype-heavy brief.

CEO feedback:

“Too long. Focus on Vietnam. Use a concise technical tone with citations.”

Aquahab stores:

- preference: concise technical tone

- decision: Vietnam-first launch

- feedback: avoid hype-heavy copy

Mission 2:

CEO: “Write a launch brief for the Sui wallet.”

Researcher recalls prior memories and returns:

A shorter, Vietnam-focused, technical brief.

\`\`\`

---

# Scaffold v1 Plan

## Stack

- Next.js

- React + TypeScript

- React Three Fiber + Drei

- Zustand

- Tailwind CSS

- Walrus Memory SDK

- Tatum APIs / Tatum AI Builder integration

## Milestones

1. **Contracts:** types, mock API, data model, requirements docs.

2. **Mission flow:** mission creation, routing, task state machine.

3. **Memory Vault:** memory model, store/recall service, vault UI.

4. **Integrations:** Walrus Memory and Tatum AI/data.

5. **Demo polish:** before/after mission, proof links, README, video.

## Definition of Done

- CEO can create a mission.

- Tasks route to agents.

- Agents recall memory before working.

- CEO feedback creates memory.

- A repeated mission uses recalled memory.

- Memory Vault shows records and Walrus/Sui proof.

- App survives refresh.

- Aqua City remains out of MVP.