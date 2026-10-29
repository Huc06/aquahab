# Feature Spec — HQ 3D Scene (F2b)

**Phase 1 (MVP).** The 3D stage of the HQ. It replaces the wireframe in the Mission Board mock-up with a low-poly diorama built in code.
Companion: `DESIGN.md` §2.5 (scene palette), §5.2 (layout), §6.3 (desk labels), §7.3 (motion), §7.5 (performance), §7.7 (3D accessibility). `PRD.md` §7.2, §11 (3D is Day 11; blockout starts Day 5–6). `docs/features/agent-desk.md`. `DATA_MODEL.md` §4.4.

## Purpose

Give the CEO one readable office on the seabed. Five fixed desks, One at the center, the Memory Vault at the front. Desk screens and routing lines show live state. Recall chips travel from the Vault to a desk. The scene is decoration plus state, never the only place where information lives. Every fact in the scene is also in a text panel.

## Build approach

- **Code, not a design tool.** The scene is written with React Three Fiber, Drei, and Zustand (RESHADED V1 stack). Design tools only produce reference images. The numbers in this spec are the source.
- **Primitives only in MVP.** Boxes, cylinders, capsules, spheres, lines, and points. No imported models. A GLB model may replace a primitive later only if it stays inside the §Budget.
- **Blockout first.** Build the layout with plain boxes on Day 5–6. Art polish comes after the state wiring is done.

## Layout map (units: meters, origin at room center)

Axes: **+x** right, **+y** up, **+z** toward the camera (front of the room). **−z** is the back.

```
            BACK (−z)
   +----------------------------------------+
   |   [Researcher]           [Builder]     |   z = −2.0
   |  (−3.0, 0, −2.0)       (3.0, 0, −2.0)  |
   |           \                /           |
   |             \            /             |
   |                [ One ]                  |   z = −1.5
   |               (0, 0, −1.5)              |
   |                                        |
   |   [Lofi]                    [Hippo]     |   z = +1.5
   |  (−3.0, 0, 1.5)           (3.0, 0, 1.5) |
   |                                        |
   |                ( Vault )               |   z = +3.3
   |              (0, 0, 3.3)               |
   +----------------------------------------+
            FRONT (+z), camera side
```

### Objects

| Object | Position (x, y, z) | Size (w × h × d) | Notes |
|---|---|---|---|
| Room slab | (0, −0.1, 0) | 12.0 × 0.2 × 8.0, corner radius 1.0 | Rounded base. Color `--scene-floor`. |
| Researcher desk | (−3.0, 0, −2.0) | 1.6 × 0.1 × 0.8 top | `--scene-desk`. Desk top at y = 0.75. |
| Builder desk | (3.0, 0, −2.0) | 1.6 × 0.1 × 0.8 top | Same as Researcher |
| Lofi desk | (−3.0, 0, 1.5) | 1.6 × 0.1 × 0.8 top | Same |
| Hippo desk | (3.0, 0, 1.5) | 1.6 × 0.1 × 0.8 top | Same |
| One desk | (0, 0, −1.5) | 2.0 × 0.1 × 1.0 top | Larger. Centre of the room. |
| Desk screen (each) | desk x, 0.95, desk z − 0.3 | 1.1 × 0.6 plane, tilted back 15° | Shows status color (§Desk screen states). |
| Agent figure (each) | desk x, 0.75, desk z + 0.3 | capsule r 0.18, length 0.5 | Seated. Color `--color-agent-text` at rest. |
| One figure | (0, 0.75, −1.5 + 0.4) | capsule r 0.2, length 0.55 | Slightly larger. |
| Vault arch | (0, 0, 3.3) | half cylinder r 0.9, depth 0.6, opening faces +z | Outline rim in `--color-memory`. |
| Walrus Keeper | (1.4, 0, 3.3) | capsule r 0.16, length 0.45 | Stands beside the Vault. Glows on store. |
| Routing lines | One top (0, 0.9, −1.5) to each desk top | line, width 1 px | `--color-memory`, 60% opacity while routing. |
| Particles | box x ±5.5, y 0.2–2.8, z −3.5 to 3.5 | Points, 60 max, size 2 px | `--scene-particle`. Drift 0.02 m/s. |

Clearance check (computed from the table):
- Researcher spans x −3.8 to −2.2. One spans x −1.0 to 1.0 (width 2.0). Gap: 1.2 m.
- One spans z −2.0 to −1.0. Lofi spans z 1.1 to 1.9. Gap: 2.1 m.
- The Vault spans x −0.9 to 0.9 and z 3.0 to 3.6. Lofi and Hippo end at z 1.9, so the gap is 1.1 m.
- The Keeper (x 1.4) clears the Vault edge (x 0.9) by 0.5 m.

AC-HQ-02 uses these numbers as the minimum clearance (≥ 0.8 m).

### Camera

| Parameter | Value |
|---|---|
| Type | Perspective |
| Position | (0, 7.0, 9.5) |
| Look-at | (0, 0, −0.5) |
| Vertical FOV | 35° |
| Elevation | about 37° above the floor |
| Controls | No free orbit. Azimuth may move ±15° and zoom 0.85×–1.15× from default. Polar angle fixed. |
| Focus on desk | Ease to a point 2.2 m from the desk, looking at the desk top, 600ms (`--motion-camera`). Reset with Escape or the room button. |
| Reduced motion | Camera cuts instantly. No zoom easing. |

### Lighting

| Light | Type | Position or setting | Color | Intensity |
|---|---|---|---|---|
| Key | Directional | (−4, 8, 6) aimed at (0, 0, 0) | `--scene-light-key` `#CFEFF5` | 1.2 |
| Fill | Hemisphere | sky `#CFEFF5`, ground `#0C1D33` | — | 0.6 |

No shadows in MVP. No point lights except the Vault glow (point light r 2.0 at the Vault, intensity 0.4, aqua).

## Desk screen states

The desk screen is the only part of the scene that shows agent status in color. The label carries the same status in text (§Accessibility).

| `AgentStatus` | Screen color | Screen content | Motion |
|---|---|---|---|
| `idle` | `#7F95AD` at 40% | Dim, no content | none |
| `assigned` | `#A9BCD0` at 60% | One-line task title | none |
| `working` | `#A8F0F5` | Pulsing scan line | pulse, 1.6s loop; none under reduced motion |
| `review` | `#6BE3A0` | Check mark | none |
| `blocked` | `#FF6B6B` | Warning triangle | none |
| paused (flag) | `#7F95AD` | Pause bars | none |
| disabled (flag) | `#7F95AD` at 20%, dashed outline | Empty | none |

Colors are DESIGN.md Appendix A tokens. They are never the only signal: the desk label always names the status.

## Recall and routing motion

- **Routing.** When a mission is assigned, the lines from One to the assigned desks fade in (200ms), stay for the routing time, then fade to 0 over 400ms. Lines never block clicks.
- **Recall.** Up to 5 small chips (0.12 m cubes, `--color-memory`) leave the Vault front at (0, 0.6, 3.0). Each follows a `CatmullRomCurve3` to the desk top. Travel: 720ms plus 80ms stagger (`--motion-travel`). On arrival the chip fades out and the desk's recall count updates in the text panel.
- **Store.** The Keeper's glow lifts from 0 to 0.4 intensity and back over 200ms when a memory reaches `stored`.
- **Reduced motion.** Chips fade in at the desk over 120ms with no path. Routing lines appear and disappear with no fade. The Keeper glow is a text change only.

## Data Requirements

- **Reads (through the API, polled):** `GET /api/agents` for status and desk positions, `GET /api/missions/:missionId` for routing and recall events, `GET /api/memory/vault` for Keeper state.
- **Store:** Zustand holds view state only: selected desk, camera mode, reduced-motion flag, scene mode (3D or 2D fallback). Business state comes from the API.
- **Entities:** `Agent` (`deskPosition`, `status`), `Task`, `RecallEvent` (`memoryIds`, `skipped`), `AquahabMemory` (`writeStatus`).
- Desk positions are read from the layout table above, not from the database. The `deskPosition` values in `DATA_MODEL.md` §4.4 are superseded by this table.

## Walrus Memory Usage

None inside the scene. The scene never calls Walrus. It shows what the API already returned: recall events for chips, and `writeStatus` for the Keeper. Only stored memories can appear as recalled (DATA_MODEL §5).

## Interaction

| Input | Result |
|---|---|
| Click or Enter on a desk | Camera focuses the desk. Inspector opens Agent Detail. |
| Click the Vault | Camera focuses the Vault. Inspector opens the Memory Vault. |
| Escape | Camera resets to the default view. Focus returns to the control that opened the inspector. |
| Pointer drag | Azimuth ±15° only. No pan, no free orbit. |
| Wheel | Zoom within 0.85×–1.15× |
| Tab | Moves through desks in order: Researcher, One, Builder, Lofi, Hippo, Vault. Canvas is not focusable. |

Every interaction above also works from the Agents list in the inspector (DESIGN §7.7).

## Accessibility

- The canvas is `aria-hidden="true"`. It is never the only place where information lives.
- Each desk label has an accessible name in this form: "Researcher, status working, current task: Market brief." If idle: "Researcher, status idle, no current task."
- Desk labels are rendered with Drei `Html`. Their text is also present in the Agents list in the inspector, with the same name and actions.
- A polite live region announces, without stealing focus:
  - "Researcher started working"
  - "Recalled 3 memories"
  - "Memory stored"
  - "Task blocked: model call failed"
- Reduced motion is respected as described in Recall and routing motion.

## UI States

| State | What the CEO sees |
|---|---|
| Loading | Room slab and desks fade in over 200ms. Label text "Opening HQ…" in the top bar. |
| Ready | Full scene, camera at default, labels visible on hover or focus. |
| Working | Desk screen pulses. Recall chips may travel. |
| Blocked | Desk screen red, warning icon on the label. |
| Camera focused | Inspector open. The desk is centered. |
| Fallback (2D) | The same desks as a grid of cards (same names, same states, same actions). No canvas is rendered. |
| Scene error | "The 3D view could not load. Using the list view." Switches to the 2D fallback. |

## Performance Budget

| Metric | Limit |
|---|---|
| Frame rate on a mid-range laptop | 60 FPS with the scene alone |
| Frame time over 20ms for 3 seconds | Drop to one particle layer. If still over 20ms for 3 seconds, switch to 2D fallback. |
| Draw calls | ≤ 100 |
| Triangles | ≤ 30,000 |
| Lights | 2 + 1 point light |
| Shadows | None |
| Particles | ≤ 60 |
| Textures | None. Flat colors from DESIGN §2.5. |
| Scene load | ≤ 4 seconds on the demo laptop. Otherwise fallback. |
| Post-processing | None in MVP |

## Acceptance Criteria

- [ ] AC-HQ-01: All five desks, the One desk, the Vault arch, and the Keeper appear at the positions in the layout table, within 0.05 m.
- [ ] AC-HQ-02: No two objects overlap. A test asserts the clearance values in the layout section.
- [ ] AC-HQ-03: The camera position and look-at match the Camera table. Free orbit is not possible (test: drag beyond ±15° has no effect).
- [ ] AC-HQ-04: A desk screen color matches its `AgentStatus` in the table above.
- [ ] AC-HQ-05: A `blocked` desk shows the warning icon in its label and in the Agents list.
- [ ] AC-HQ-06: Recall chips equal the count in `RecallEvent.memoryIds`, up to 5. Zero chips for `memory_off` runs.
- [ ] AC-HQ-07: Reduced motion removes path travel and pulse. Every state change still happens.
- [ ] AC-HQ-08: Every desk can be selected from the keyboard and from the Agents list, with the same result.
- [ ] AC-HQ-09: The canvas has `aria-hidden="true"`. Its information is also in text.
- [ ] AC-HQ-10: Frame time stays under 20ms on the demo laptop during a 2-mission run. If not, the fallback is used automatically.
- [ ] AC-HQ-11: Draw calls ≤ 100 and triangles ≤ 30,000, read from the renderer info in a dev build.
- [ ] AC-HQ-12: The 2D fallback shows the same five agents, the same names, statuses, and actions.
- [ ] AC-HQ-13: Opening the scene makes no Walrus call. Only the polled API calls listed in Data Requirements.

## Build Order

1. Room slab, camera, lights, and five desks at the layout positions. Check AC-HQ-01 and AC-HQ-02.
2. Desk screens and labels bound to a static fixture of agent states. Check AC-HQ-04.
3. Routing lines bound to a fixture mission. Check the routing motion.
4. Recall chips and Keeper glow. Check AC-HQ-06 and AC-HQ-07.
5. Keyboard, list twin, and live region. Check AC-HQ-08 and AC-HQ-09.
6. Performance gate and 2D fallback. Check AC-HQ-10 to AC-HQ-12.
7. Art pass (only after 1–6 pass). Stay inside the budget.
