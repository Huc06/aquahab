# UI Layout Map (MVP)

> **Superseded (2026-10-29).** The three-column shell below is replaced by a full-bleed scene with overlay controls. See docs/product/DECISIONS.md §9.

| Field | Value |
|---|---|
| Status | Draft v1. Layout only. No visual styling, no full screens. |
| Date | 2026-10-29 |
| Sources | `DESIGN.md` §5 (layout), §6 (components); `docs/features/`; `docs/product/DECISIONS.md` §8 |
| Scope | Regions, where components sit, how the user moves between them. Excludes the six screen mockups. |

Dark UI only. Desktop first (minimum 1280 × 800). Colors, type, and motion are in `DESIGN.md`, not here.

---

## 1. App shell

One shell wraps every signed-in page. It has four regions.

```
+----------------------------------------------------------------------------+
| TOP BAR (56px)  wordmark · operator status · demo CEO · nav                |
+-----------------+-------------------------------------+--------------------+
| LEFT RAIL       | CENTER STAGE                        | RIGHT INSPECTOR    |
| 280px           | fluid, min 560px                    | 360px              |
|                 |                                     |                    |
| missions list   | 3D HQ scene (or the stage view      | one panel at a     |
| new mission     | for the current route)              | time, in tabs      |
| company budget  |                                     |                    |
+-----------------+-------------------------------------+--------------------+
```

Rules:

- The inspector can collapse to 0px with a visible toggle. The stage then takes the full width.
- Below 1280px the operator status collapses to icons. Below 1024px the rail and inspector stack into one scrolling column over the stage. The page itself never scrolls horizontally.
- Scrolling happens inside each region, never on the page.

---

## 2. Top bar

| Slot | Content | Notes |
|---|---|---|
| Left | Wordmark "Aquahab" | Returns to HQ overview |
| Center | Operator status line | Walrus status, agent counts, quota, network |
| Right | Session (demo CEO), nav link to HQ, collapse-inspector toggle | |

The operator status line is the only place that shows system health. Its states are defined in `DESIGN.md` §6.12.

---

## 3. Left rail: missions

Always visible on signed-in routes except onboarding.

| Order | Slot | Component | Empty state |
|---|---|---|---|
| 1 | Heading "Mission Board" and one-line hint | text | never empty |
| 2 | Primary action "Assign mission" | Button (primary) | always enabled, validates on press |
| 3 | Mission list | MissionCard × n | "No missions yet. Pick a template to assign the first one." |
| 4 | Company budget | BudgetMeter (LLM) | Shows 0 of the budget, not hidden |

Selecting a MissionCard sets the selected mission for the stage and the inspector. It does not navigate away.

---

## 4. Center stage

The stage shows one of four views. Only one is active at a time.

| View | Route | Contents |
|---|---|---|
| HQ scene | `/hq` (default) | 3D office: five fixed desks, One at center, Vault door at front. Desk labels and routing lines are overlays. |
| Routing view | `/missions/:id` | Same HQ scene with routing lines from One to the selected mission's assigned desks |
| Result compare | `/missions/:id/result` | Two columns: "Without memory" (left), "With memory" (right). Both columns use the same agent, template, and input. |
| Onboarding | `/onboarding/*` | Full-screen flow over the HQ scene dimmed to 30%. Rail and inspector are hidden. |

Overlay layers on the HQ scene, from back to front: scene labels, recall and proof overlays (pointer-events none), then panels in the inspector.

The HQ scene has a 2D fallback with the same regions and the same components, used when the 3D view is unavailable (`docs/features/hq-scene.md`).

---

## 5. Right inspector

One panel at a time. Tabs or a mode switch chooses the panel. The inspector is never empty: it has a default panel.

| Mode | Opened by | Contents | Default |
|---|---|---|---|
| Agents | Default on HQ | AgentDeskLabel list (all five), each with AgentStatusPill and budget bar | Yes |
| Agent detail | Click or Enter on a desk | Tabs: Overview, Recall, Output, Budget, Configure. Each tab shows its own empty state. | |
| Mission detail | Selecting a mission | TaskCard list, routing summary, mission budget | |
| Memory Vault | Clicking the Vault door or the Keeper | Quota header, expiring section, grouped lists (company, project, agent), filters, MemoryChip rows, ProofLink | |
| Feedback | "Review" on a task in review | Output (read-only), recalled MemoryChip list, FeedbackComposer, candidate list | |
| Mission result | "Compare" on a mission | Diff summary, CEO verdict (three choices), decision candidate | |
| Briefing | Top bar or One desk | Four sections: active missions, recent decisions, open risks, memory added this week. Each item links to a memory. | |

Rules:

- Opening a mode does not change the stage view, except Memory Vault, which dims the scene to 40% and keeps it visible.
- Closing a mode returns to the Agents list, and focus returns to the control that opened it (`DESIGN.md` §7.6).
- Ask the Vault is not a mode and not a control in MVP (Phase 2).

---

## 6. Navigation map

```
Onboarding (first run only)
  /onboarding/session → /onboarding/company → /onboarding/agents
    → /onboarding/mission → /onboarding/feedback → /onboarding/memory
    → opens the Memory Vault (/vault) with the first memory highlighted

HQ (default after onboarding)            /hq
  ├── select mission ─────────────────→ /missions/:id          (routing view)
  │     ├── Review task ──────────────→ Feedback mode
  │     └── Compare ──────────────────→ /missions/:id/result   (result compare)
  ├── select desk ────────────────────→ Agent detail mode (stage stays on HQ)
  ├── click Vault door ───────────────→ Memory Vault mode (stage dims)
  └── top bar Briefing ───────────────→ Briefing mode
```

Every route can be reached from the top bar or the left rail. No route requires a modal to be closed first, except Feedback, which must be submitted or cancelled before a new task is reviewed.

---

## 7. States per region

| Region | Loading | Empty | Error |
|---|---|---|---|
| Top bar status | Dots grey, "Checking Walrus Memory…" | n/a | Shows the failing capability (for example "Memory operations unavailable") |
| Left rail list | Three placeholder cards | "No missions yet" | "Missions could not load." with Retry |
| Stage | Scene fades in over 200ms; text "Opening HQ…" | Scene always renders; empty only means no routing | "The 3D view could not load. Using the list view." Switches to 2D |
| Inspector | Skeleton of the active mode | Each mode has its own empty text (see §5) | Inline message with Retry, never a blank panel |

---

## 8. Layering

| Layer | z-index | Contents |
|---|---|---|
| Stage canvas | 0 | 3D scene |
| Scene labels | 1 | Desk labels |
| Stage overlays | 2 | Stage notes, recall and proof animation layer |
| Panels | 3 | Left rail, inspector |
| Popovers | 4 | Proof details, memory detail |
| Modals | 5 | Confirm forget, confirm budget save |
| Toasts | 6 | Short status messages |

---

## 9. Open items

| # | Item | Blocks |
|---|---|---|
| L1 | Whether the Briefing mode uses the inspector or the stage. Default here: inspector. | Briefing layout |
| L2 | Whether mission compare needs its own route or can open in the stage without a route change. Default here: own route, so it can be linked. | Result compare routing |
| L3 | Whether the left rail stays visible on the result route. Default here: yes. | Result compare layout |
