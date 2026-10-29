# Aquahab — Research &amp; References

## Product Concept

Aquahab is a 3D habitat where a CEO runs a company of AI agents

that remember every mission, preference, and decision.

Aquahab = Aqua (shared digital ocean / memory ocean)

        + Habitat (a living 3D workplace for AI agents).

## Core Loop

1. CEO assigns a mission.

2. Chief of Staff routes tasks to role-based agents.

3. Agents collaborate, complete tasks, and return outputs.

4. CEO reviews and gives feedback.

5. Preferences, outcomes, decisions, and feedback become memories.

6. Walrus Memory stores and recalls those memories.

7. On the next mission, agents behave better because they remember.

## World Definitions

- Aqua: shared digital ocean; the flowing data and memory environment.

- Habitat: a 3D office/company where agents have desks, roles, tasks, and memories.

- Aqua Memory Vault: Walrus-powered deep-sea archive for company and agent memory.

- Tatum: the habitat’s nervous system; connects agents to Sui infrastructure,

  RPC, blockchain data, and AI capabilities.

## Characters

- CEO: human user; assigns missions, approves results, gives feedback.

- One: Chief of Staff; receives missions, routes tasks, synthesizes briefings.

- Walrus Keeper: guardian of the Aqua Memory Vault; represents Walrus Memory.

- Lofi: creative/content agent.

- Hippo: operations/finance agent.

- Researcher: market/insight agent.

- Builder: engineering agent.

## MVP Scope

- One private Aquahab HQ.

- 4–6 AI agents.

- 5–8 mission templates.

- Agent memory, project memory, and company memory.

- Walrus Memory store/recall.

- Tatum-powered AI workflow.

- Memory Vault UI with Walrus/Sui proof.

- Before/after memory demo.

## Non-Goals for Hackathon

- Full open-world game.

- Multiplayer real-time city.

- Complex character animation or physics.

- Voice chat.

- Production-grade auth/billing.

- Long-term persistent world editing.

## Phase 2 — Aqua City

Aqua City is a shared public 3D space where CEOs can meet, showcase their

AI companies, chat, and visit public Memory Vaults.

It must not block the MVP. Player position and chat are ephemeral multiplayer

state; only meaningful company/agent memories belong in Walrus Memory.

## Official Documentation

- Walrus Memory overview:

  [https://docs.wal.app/walrus-memory](https://docs.wal.app/walrus-memory)

- Walrus Memory product page:

  [https://walrus.xyz/products/walrus-memory/](https://walrus.xyz/products/walrus-memory/)

- Walrus Memory TypeScript SDK usage:

  [https://docs.wal.app/walrus-memory/sdk/usage/memwal](https://docs.wal.app/walrus-memory/sdk/usage/memwal)

- Walrus Memory API reference:

  [https://docs.wal.app/walrus-memory/sdk/api-reference](https://docs.wal.app/walrus-memory/sdk/api-reference)

- Tatum API reference:

  [https://docs.tatum.io/reference/welcome-to-the-tatum-api-reference](https://docs.tatum.io/reference/welcome-to-the-tatum-api-reference)

- Tatum Data APIs:

  [https://docs.tatum.io/docs/blockchain-data](https://docs.tatum.io/docs/blockchain-data)

- Tatum Sui gRPC guide:

  [https://docs.tatum.io/reference/sui-grpc](https://docs.tatum.io/reference/sui-grpc)

- Tatum brand guidelines:

  [https://tatum.io/about/brand-guidelines](https://tatum.io/about/brand-guidelines)

## Reference Projects

- Agents Office v3 — 3D isometric office, departments, task routing:

  [https://github.com/ajsahni/agents-office](https://github.com/ajsahni/agents-office)

- CrewSpace — hire/manage AI agents as virtual employees:

  [https://github.com/priyansh19/CrewSpace](https://github.com/priyansh19/CrewSpace)

- Hermes3D — 3D office for AI agent fleets:

  [https://github.com/iamlukethedev/Hermes3D](https://github.com/iamlukethedev/Hermes3D)

- Hermes Virtual Office — divisions, meetings, Kanban:

  [https://github.com/JuniorXcoder/hermes-virtual-office](https://github.com/JuniorXcoder/hermes-virtual-office)

- DeskRPG — AI employees, desks, meetings, Kanban, cron jobs:

  [https://github.com/dandacompany/deskrpg](https://github.com/dandacompany/deskrpg)

- AI Office — isometric 3D office with working agents:

  [https://github.com/Gaurav2693/ai-office](https://github.com/Gaurav2693/ai-office)

- Claw3D — 3D workspace for AI agents:

  [https://www.claw3d.ai/](https://www.claw3d.ai/)

## Multiplayer Reference — Phase 2 Only

- Colyseus documentation:

  [https://docs.colyseus.io/learn](https://docs.colyseus.io/learn)

- Colyseus React integration:

  [https://docs.colyseus.io/getting-started/react](https://docs.colyseus.io/getting-started/react)

- Three.js + Colyseus multiplayer example:

  [https://github.com/j1yang/Three.js-Colyseus-Communication](https://github.com/j1yang/Three.js-Colyseus-Communication)

- React Three Fiber + Colyseus racing example:

  [https://github.com/colyseus/react-racing-game](https://github.com/colyseus/react-racing-game)

## Implementation Guardrails

- Do not invent Walrus Memory APIs; use the official SDK methods:

  remember, waitForRememberJob, recall, analyze, ask.

- Do not store ephemeral player positions or chat in Walrus Memory.

- Memory must affect the next mission; a memory that is never recalled is out of scope.

- The demo must show a before/after comparison using the same task type.

- Prefer one polished HQ scene over a large unfinished open world.