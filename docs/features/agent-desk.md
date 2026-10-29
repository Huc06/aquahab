# Feature Spec — Agent Desk and HQ Scene (F2)

**Phase 1 (MVP).** v1.0 aligned to RESHADED §D (Agent Runtime, Memory Recall), §E, and the "visible recall animation" requirement in §Aqua Memory Vault.
Companion: `PRD.md` §7.2, §8 (US-03, US-04), `SYSTEM_DESIGN.md` §4.1, §4.3, §7.b.

## Purpose

Make the company feel like a place. The HQ is one 3D scene: One at the center, a desk for each worker agent, and the Walrus Keeper at the Memory Vault. The Desk panel shows what an agent is doing, which memories it recalled before working, and what it produced. This is where "the agent remembered" becomes visible.

## User Flow

1. CEO lands on the HQ. The camera frames the office: One at the center, four worker desks, the Walrus Keeper at the Vault door.
2. Each desk shows the agent's name, role, and status light.
3. CEO clicks a desk. The camera moves to it and the **Desk panel** opens.
4. Desk panel shows, for the agent's current or latest task:
   - Status and attempt number.
   - **Recalled N memories** chip. Expanding it lists each memory's text, type, scope, and confidence.
   - Output (markdown, following the template's sections).
   - **Review** button, which opens the Feedback Loop.
5. When a task starts with memory on, the recall animation plays: memory cards flow from the Vault door to the desk. The chip then updates with the count.
6. With `memory_off`, the chip reads **Memory off, no recall**, and no animation plays.
7. Clicking the Walrus Keeper opens the Memory Vault.

## UI States

| Agent status (`AgentStatus`) | Scene | Desk panel |
|---|---|---|
| `idle` | Grey status light | "No task yet" |
| `assigned` | Blue-grey light; a routed task card appears at the desk | "Assigned: <task title>" |
| `working` | Amber light; slow idle motion at the desk | "Working…"; recall chip fills in as results arrive |
| `review` | Green light | Output shown; Review button active |
| `blocked` | Red light | Reason, **Retry** action |
| `offline` | Dim light | Not used in demo |

Task-level states on the desk: `retrying` is shown when a `working` task has `attempt > 1`.

Recall chip states:

| State | Chip |
|---|---|
| Recall in progress | "Recalling…" with animation |
| `memoryIds` non-empty | "Recalled N memories" (expandable) |
| Recall returned nothing | "Recalled 0 memories" |
| Recall failed | "Ran without memory" with reason |
| `memory_off` | "Memory off, no recall" |

Walrus Keeper states (driven by polling `GET /api/memory/vault` and `GET /api/memory/health`):

| State | Keeper |
|---|---|
| `resting` | Idle at the Vault door |
| `receiving` | A memory is `queued` or `pending` |
| `filed` | A memory reached `stored`; short glow for 3 seconds |
| `offline` | `health` is not ok; Keeper dimmed, Vault shows the status light red |

3D unavailable: the 2D desk grid shows the same statuses and the same panels.

## Data Requirements

- **Reads:** `GET /api/agents` (polled every 1.5 s while any task is active), `GET /api/missions/:missionId` (tasks, recall events, memories), `GET /api/memory/health` (every 30 s).
- **Entities:** `Agent` (`role`, `status`, `deskPosition`, `currentTaskId`), `Task` (`output`, `attempt`, `blockerReason`), `RecallEvent` (`memoryIds`, `skipped`, `skipReason`, `latencyMs`), `AquahabMemory` (`type`, `scope`, `confidence`, `content`).
- **Scene assets:** one room, five desk slots, one central desk for One, one Vault door. Low-poly. Idle motion is a simple bob or light pulse. No rigged characters.
- **Performance:** 60 FPS on a mid-range laptop with the scene alone. Panels render over it.

## Walrus Memory Usage

- **Read-only.** The Desk panel displays memories that the runtime recalled with `recall` before the task (`SYSTEM_DESIGN.md` §7.b).
- The panel never calls Walrus. It reads `RecallEvent` and the memory index through the API.
- Only memories with `writeStatus = stored` can appear as recalled in the demo, since only stored memories are eligible for recall (`DATA_MODEL.md` §5, invariant 4).
- The recall inspector ("what would this agent recall now?") calls `POST /api/memory/recall` and shows the result without starting a task. It is a debugging aid, not part of the demo flow.

## Acceptance Criteria

- [ ] AC-AD-01: All five worker desks and the Walrus Keeper are present with name and role.
- [ ] AC-AD-02: Clicking a desk opens its Desk panel within 1 second.
- [ ] AC-AD-03: Status light colors match the `AgentStatus` table above.
- [ ] AC-AD-04: The recall chip count matches the `RecallEvent.memoryIds` length.
- [ ] AC-AD-05: The recall animation plays when a task with `memory_on` starts and recall returns 1 or more memories. It does not play for `memory_off` or for 0 results.
- [ ] AC-AD-06: Expanding the chip shows each memory's text, type, scope, and confidence in full. No text is truncated without a way to read it.
- [ ] AC-AD-07: A `memory_off` task shows "Memory off, no recall" and never shows a count.
- [ ] AC-AD-08: Recall that fails shows "Ran without memory" with the reason, and the task still completes.
- [ ] AC-AD-09: The Keeper's `receiving` state appears while any memory is `queued` or `pending`, and `filed` appears when one becomes `stored`.
- [ ] AC-AD-10: Switching to the 2D fallback keeps every panel and status working with no data change.
- [ ] AC-AD-11: The scene loads in under 4 seconds on the demo laptop. Otherwise the 2D fallback is used.
- [ ] AC-AD-12: No camera, click, or hover interaction in the scene triggers a backend write.
- [ ] AC-AD-13 (S+): An agent's recall never includes `expired` or `renewal_required` memories. If the only matches are excluded, the chip reads "Recalled 0 memories" and does not hint at what was excluded.
- [ ] AC-AD-14 (S+): The Desk panel shows the agent as a namespace inside the company's memory space, not as an owner. The text "Agents own no memories" appears in the agent's detail.
- [ ] AC-AD-16 (DECISIONS §6): Each desk keeps its fixed position through pause, disable, and enable. Paused shows amber "Paused", disabled shows grey "Removed from routing". Neither changes the desk.
- [ ] AC-AD-15 (S+): If an agent's access was revoked in the app (app-only), its desk shows "Recall disabled" and its task runs with `memory_off` semantics, recorded as `skipReason: "revoked"`.
