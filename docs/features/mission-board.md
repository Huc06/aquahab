# Feature Spec — Mission Board (F1)

**Phase 1 (MVP).** v1.0 aligned to RESHADED §R, §A, §D.
Companion: `PRD.md` §7.3, §8 (US-01, US-12), `SYSTEM_DESIGN.md` §4.2, §5, `API_DESIGN.md` §2–§3, `DATA_MODEL.md` §3.

## Purpose

Let the CEO create a mission (title, objective, constraints, priority), route it through One, and watch its tasks move through the state machine. This is where the demo starts: Mission 1 (before) and Mission 2 (after).

## User Flow

1. CEO opens the Mission Board from the HQ (desk-side terminal or top bar).
2. Board lists the mission templates (T1–T6) with one-line descriptions and lead agents, plus a **New mission** button. Picking a template pre-fills the form. Starting from blank is also allowed.
3. CEO fills in:
   - **Title** (3–80 characters)
   - **Objective** (10–1000 characters)
   - **Constraints** (0–10 short items)
   - **Priority** (`low`, `normal`, `high`)
4. Press **Assign**. The mission is created (`POST /api/missions`) and routed. Status shows `active`.
5. Board shows the task list: agent, status chip, attempt number, and "Recalled N memories" per task.
6. When every task is `review` or `done`, the mission shows `review`. The CEO opens each task in the Feedback Loop.
7. A mission is `completed` once the CEO has approved its tasks, or `failed` if the CEO rejects it.
8. Optional control: **Memory off** toggle at creation sets `runMode = memory_off` (US-12). It is off by default.

## UI States

| State | What the CEO sees |
|---|---|
| Empty | "No missions yet. Pick a template to assign your first mission." |
| Drafting | Form with inline validation; Assign disabled until valid |
| Assigning | Button shows "One is routing…"; template card dimmed |
| Active | Task list with status chips: `assigned`, `working`, `review`, `done`, `blocked` |
| Working, retrying | Task chip reads "Retrying (attempt 2)" when `attempt > 1` and status is `working` |
| Blocked | Task shows reason ("AI request failed") and a **Retry** action. Other tasks keep going. |
| Review | Banner: "All tasks are ready. Review outputs." |
| Completed | Read-only. Shows the approval and links to memories created from this mission. |
| Failed | Shows the rejection reason and links to the Feedback Loop |
| Memory off run | Badge "Memory off" beside the mission title |
| Offline or error | Global banner with Retry; last known state stays visible |

## Data Requirements

- **Reads:** `GET /api/missions` (list on load), `GET /api/missions/:missionId` (polled every 1.5 s while the mission is `active`), `GET /api/agents` (chips).
- **Writes:** `POST /api/missions`, `POST /api/tasks/:taskId/retry`, `POST /api/missions/:missionId/compare` (demo only).
- **Entities:** `Mission` (`title`, `objective`, `constraints`, `priority`, `runMode`, `status`), `Task` (`status`, `attempt`, `blockerReason`), `Agent` (`role`, `status`).
- **Validation:** `title` 3–80; `objective` 10–1000; `constraints` 0–10 items; `priority` in enum; `templateId` must exist when given.
- **Polling:** stops when the mission is `completed` or `failed`, and when the page is hidden.

## Walrus Memory Usage

- **Indirect.** Creating a mission triggers One's routing `recall` (objective and constraints as query). The result appears as "Routing used N memories" with a link to the recall event.
- No `remember` call starts here. Memory writes start only from the Feedback Loop.

## Acceptance Criteria

- [ ] AC-MB-01: All six templates are listed with name, description, and lead agent.
- [ ] AC-MB-02: Assign is disabled until title, objective, and priority validate; the reason is shown next to the field.
- [ ] AC-MB-03: A mission creates 3–6 tasks, each with exactly one agent and one status.
- [ ] AC-MB-04: With `runMode = memory_on`, routing records one recall event. With `memory_off`, it records a skipped event and makes no recall call.
- [ ] AC-MB-05: A status change from the backend appears on the board within 2 seconds, with no page reload.
- [ ] AC-MB-06: A blocked task does not stop other tasks. Retry re-runs only that task and increments `attempt`.
- [ ] AC-MB-07: Mission status follows the state machine in `SYSTEM_DESIGN.md` §5.2. Illegal transitions are rejected by the server.
- [ ] AC-MB-08: After a page reload, the mission list and each mission's status match the backend (US-17).
- [ ] AC-MB-09: The board is usable at 1280×800 without horizontal scroll.
- [ ] AC-MB-10 (S+): Assign is blocked with "Demo memory cap reached for this session" when the session cap is hit. The mission is not created, and the CEO can still review existing missions.
- [ ] AC-MB-11 (S+): The guided demo template "Plan a Sui wallet launch for Vietnam" is pre-filled from onboarding and can be assigned in one click.
- [ ] AC-MB-13 (DECISIONS §3–§4): Assign runs only on mission. No task is created on a schedule. Assign is refused with the agent's name and the exhausted quota if any routed agent has no task quota or LLM budget left.
- [ ] AC-MB-12 (S+ v1.1): Assign checks the per-session memory cap and the operator quota before routing. When either is reached, the message names the limit ("Memory quota reached for this company") and no mission or task is created.
