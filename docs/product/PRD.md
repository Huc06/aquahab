# Aquahab — Product Requirements Document (MVP, Phase 1)

| Field | Value |
|---|---|
| Status | Draft v1.4 (MVP decisions v2.2: Ask the Vault and Google sign-in are Phase 2; demo CEO session; Aquahab deep-sea UI with Geist; see `DECISIONS.md` §8, which overrides earlier drafts) |
| Date | 2026-10-26 |
| Scope | Phase 1: private Aquahab HQ only |
| Sources | `PRODUCT_CONCEPT`, `RESHADED_RE_SCAFFOLD_V1.md`, `RESHADED_RE_SCAFFOLD_V2.md` (S+: lifecycle, privacy, ownership), `RESEARCH.md` |
| Companion | `SYSTEM_DESIGN.md`, `DATA_MODEL.md`, `API_DESIGN.md`, `docs/features/` |

---

## 1. Summary

**Aquahab is a 3D habitat where a CEO runs a company of AI agents that remember every mission, preference, and decision.**

Aquahab = **Aqua** (shared memory ocean) + **Habitat** (a living 3D workplace for AI agents).

The MVP is one private HQ per CEO. A CEO assigns a mission. One, the Chief of Staff, routes it to role-based agents. Each agent recalls relevant memories before working. The CEO reviews the output and gives feedback. Preferences, outcomes, feedback, and decisions become memories on Walrus. The next similar mission produces a visibly better, more aligned result. The demo shows this with two missions of the same type.

## 2. Target User

**Primary: the CEO.** A founder or team lead who runs recurring work (content, research, operations, builds) through AI tools. They:

- Repeat the same preferences, constraints, and "we already tried that" context in every new session.
- Want agents to improve over time without writing long system prompts.
- Use a web app and do not need to understand Walrus or Sui to use it.

**Secondary: hackathon judges and viewers.** They need to see within a 2–3 minute video that memory changes agent behavior, and that the memory is real: stored on Walrus, with a verifiable reference on Sui.

## 3. Problem

AI agents lose context between sessions. The CEO has to:

1. Restate preferences and constraints ("concise", "no hype", "Vietnam first").
2. Restate outcomes of past work ("the last brief was too long").
3. Re-explain rejected options and the reasons for rejecting them.

The result is repeated corrections, inconsistent output, and lost decisions. No quantitative baseline exists yet. The demo's first mission is the baseline.

## 4. Solution

- **One 3D HQ scene** with five working agents at desks, a Chief of Staff, and a Walrus Keeper at the Memory Vault.
- **Core loop** (RESHADED §Core Loop): CEO assigns mission → One routes tasks → agents recall memory → agents complete tasks → CEO reviews and gives feedback → memories are stored → the next similar mission uses them.
- **Memory types and scopes** from RESHADED: types `preference`, `outcome`, `feedback`, `decision`; scopes `agent`, `project`, `company`.
- **Walrus Memory** stores and recalls memory through `remember`, `waitForRememberJob`, `recall`, `restore`, `health`, and the list methods `listMemories` and `listNamespaces`. `ask` is Phase 2 and not used in MVP (DECISIONS §8). `analyze` is not used for briefing (S+ v1.1).
- **Tatum** is the nervous system: AI capability for agents, and read-only Sui data for proof.

## 5. Goals

| ID | Goal | Measure |
|---|---|---|
| G1 | Memory changes the next mission | Mission 2 output uses at least 3 memories stored after Mission 1 feedback, and the output visibly reflects them |
| G2 | Memory is real and traceable | Every stored memory shows a Walrus blob id and a Sui proof reference |
| G3 | Demo is reliable | Full demo runs end to end 3 times in a row from a fresh company, without manual repair |
| G4 | Core flows are clear | Create mission, watch agents, review output, give feedback, open Vault, all reachable without help |
| G5 | Scope discipline | Zero MVP work on multiplayer, presence, or Aqua City |
| G6 | Responsive under the targets | Memory recall 3–5 s; mission completion 60–90 s |

## 6. Non-Goals (MVP)

- **Aqua City, multiplayer, real-time presence, visitors.** Phase 2.
- Full open-world navigation, complex character animation, physics.
- Voice chat.
- Production auth, billing, teams, or permissions. Demo access is one session per company.
- Editing stored memories. Corrections are new memories that supersede old ones.
- Hard deletion of a Walrus blob. A CEO can "forget" a memory: it leaves the Vault and is not renewed. The blob persists until its paid epochs end (S+).
- Permanent memory. MVP uses a fixed storage duration with manual renewal. Automatic, funded renewal is not built (S+).
- Wallet connect and per-CEO Walrus accounts. MVP is custodial (plan D1). Self-custody per CEO is Phase 2 (S+ v1.1, DECISIONS §8).
- Ask the Vault. Phase 2 (DECISIONS §8).
- Google sign-in via Enoki zkLogin. Phase 2 (DECISIONS §8).
- Scheduled agents. Phase 2 (DECISIONS §8).
- Tatum brand palette and Poppins. Phase 2, only after written permission from Tatum (DECISIONS §8).
- Extending blobs in place (`extend_blob`). MVP renews by rewrite. Extension belongs to the self-host or scale path (S+ v1.1).
- Storing ephemeral state (player position, chat, camera, UI state) in Walrus Memory.
- Any on-chain write by the user. Sui is read-only for proof.
- Mobile support. The demo runs on a desktop browser.
- Horizontal scaling and dozens of agents or departments.
- Daily or weekly agent scheduling. MVP runs on mission only (`DECISIONS.md` §3).
- Arbitrary agent creation. MVP has five fixed roles and desks (`DECISIONS.md` §6).
- Bring-your-own LLM key (BYOK). MVP uses the Aquahab-managed key. BYOK is Phase 2 (`DECISIONS.md` §4).
- CEO-owned, self-custodial Walrus memory. Phase 2 (`DECISIONS.md` §1).

## 7. MVP Scope

### 7.1 Features

| # | Feature | In MVP | Spec |
|---|---|---|---|
| F1 | Mission Board | Yes | `docs/features/mission-board.md` |
| F2 | Agent Desk and HQ scene | Yes | `docs/features/agent-desk.md` |
| F3 | Memory Vault (with Walrus/Sui proof) | Yes | `docs/features/memory-vault.md` |
| F4 | Feedback Loop | Yes | `docs/features/feedback-loop.md` |
| F5 | Company Briefing | Yes, simple version | `docs/features/company-briefing.md` |
| F6 | Mission orchestration and task state machine | Yes | `SYSTEM_DESIGN.md` §4.2, §5 |

### 7.2 Agents

| Character | Role (`AgentRole`) | Type |
|---|---|---|
| One | `chief_of_staff` — routes missions, synthesizes briefings | Orchestrating agent |
| Researcher | `researcher` — market and insight | Worker |
| Builder | `builder` — engineering | Worker |
| Lofi | `creative` — content | Worker |
| Hippo | `operations` — operations and finance | Worker |
| Walrus Keeper | — guardian of the Memory Vault | UI character, not an agent |

Five agents plus the Keeper sits within the RESHADED target of 4–6 agents per company. Roles and desks are fixed. Agents are configured and funded by the CEO, not created (`DECISIONS.md` §6, `docs/features/agent-governance.md`).

### 7.3 Mission Templates (6)

Templates give the demo a repeatable shape. RESHADED requires 5–8.

| ID | Template | Lead | Supporting | Output |
|---|---|---|---|---|
| T1 | Content brief | Lofi | One | Angle, hook, drafts |
| T2 | Market scan | Researcher | — | Five findings with sources, three risks |
| T3 | Budget and ops review | Hippo | One | Costs, cuts, decision |
| T4 | Build plan | Builder | One | Milestones, tasks, open questions |
| T5 | Partner outreach draft | Lofi | Researcher | Draft message, target list |
| T6 | Launch checklist | One | Builder, Lofi | Checklist with owners |

The demo uses the **Market scan (T2)** or **Content brief (T1)** template, since RESHADED's demo is a research brief for a Sui wallet launch. The choice is confirmed on Day 5.

**Cut order if time runs short:** T5, then T6, then animated desk states, then the 3D scene (fall back to 2D desk grid). The Vault, Feedback Loop, and the two-mission demo are never cut.

### 7.4 Capacity (RESHADED §E)

| Metric | MVP target |
|---|---|
| Concurrent CEOs | 1–10 (each with one company) |
| Agents per company | 4–6 |
| Tasks per mission | 3–6 |
| Memories per mission | 3–10 |
| Recall results per task | 3–5 |
| Mission completion | 60–90 seconds |
| Demo missions | 2 |
| Demo video | 2–3 minutes |

### 7.5 Lifecycle, Cost, Privacy, Ownership (MVP rules, from S+)

| Area | MVP rule |
|---|---|
| Lifecycle | The relayer chooses the epoch count (default 3 on mainnet, 5 on testnet; to be measured, A12). No epochs option on `remember`. Expiry is a visible state (`active`, `expiring_soon`, `renewal_required`, `expired`), read from `listMemories` (`end_epoch`, `expires_at`). Expired memories are never silently hidden. |
| Renewal | Rewrite strategy (plan D2): re-store the recalled text with `renewedFromId`, then supersede the old memory. Batch renewal from the Vault and a sign-in reminder. Extend-blob renewal is post-MVP and needs the self-host path. |
| Quota | Replaces the WAL cost estimate. The hosted relayer's price is not published, so track memory count and bytes per namespace from `listNamespaces`, and rate-limit points per delegate key. Each CEO has a per-session memory cap. Hosted quota is unconfirmed (A13). |
| Privacy | Memory is stored as ciphertext on Walrus. The relayer processes plaintext during writes and recalls (default path), so the product discloses that. Every blob ID is treated as public metadata. The Vault separates encrypted content, public blob metadata, and public proof links. |
| Redaction | Removes API keys, private keys, seed phrases, and obvious personal identifiers unless the CEO explicitly chooses to keep them. |
| Custody | Custodial (plan D1). One operator `MemWalAccount` and one delegate key are held by Aquahab's server. CEOs sign in to the app and hold no Walrus keys. Each company gets namespace prefix `aquahab:{companyId}`. Namespaces are not a security boundary, so the app checks `companyId` on every request. |
| CEO controls | View all company memories and expiry dates, export metadata, forget a memory. Agent revoke is app-level only. |
| Recovery | Company access follows app sign-in. Operator key loss is handled by the operator (remove and add delegate keys). No CEO-side wallet recovery, because no CEO wallet exists in MVP. |
| Disclosure | Shown before any data is written: Aquahab runs the operator account, the relayer sees plaintext, and forgetting does not erase blobs before their epochs end. |

## 8. User Stories and Acceptance Criteria

**US-01 — Create a mission.**
As the CEO, I create a mission with title, objective, constraints, and priority, so One can route it.
- AC1: The form requires title (3–80 chars), objective (10–1000 chars), priority (low / normal / high). Constraints are optional (0–10 items).
- AC2: Submit is disabled until the form validates, and the reason is shown.
- AC3: The mission is created and routed; status becomes `active`.

**US-02 — One routes the mission using memory.**
As the CEO, I want the Chief of Staff to route tasks to the right agents using what the company knows.
- AC1: Routing calls `recall` with the mission objective and constraints.
- AC2: The routing decision shows which memories (if any) were used.
- AC3: The mission has 3–6 tasks, each with exactly one agent and one status.

**US-03 — Watch agents work.**
As the CEO, I see which agent is doing what, live.
- AC1: Each desk shows its status: `assigned`, `working`, `review`, `blocked`, or `idle`.
- AC2: Status changes appear within 2 seconds, via polling, without a page reload.
- AC3: Clicking a desk opens its Desk panel.

**US-04 — Agent recalls memory before working.**
As the CEO, I want each agent to use what it and the company remember before it starts.
- AC1: Before each task, the runtime calls `recall` with the mission objective, task input, role, and constraints.
- AC2: Results are limited to 3–5 memories, injected into the prompt under a labeled "Known from memory" section.
- AC3: The Desk panel shows "Recalled N memories" and plays a visible recall animation when N > 0.
- AC4: If recall returns nothing or fails, the task still completes and shows "Ran without memory" with the reason.

**US-05 — Review the output.**
As the CEO, I read the agent's output, next to the memories that shaped it.
- AC1: Output renders as markdown with the template's sections.
- AC2: The recalled memories are listed beside the output.

**US-06 — Give feedback.**
As the CEO, I rate the output and explain what to do differently.
- AC1: Rating is `positive`, `neutral`, or `negative`.
- AC2: A `negative` or `neutral` rating requires a comment. `correctiveInstruction` is optional.
- AC3: Feedback is saved to the mission and task.

**US-07 — Confirm memory candidates.**
As the CEO, I choose which lessons from my feedback become company memory.
- AC1: The system proposes 1–5 candidates, each with type, scope, and owner.
- AC2: Preference, feedback, and decision candidates are sent to Walrus only after the CEO confirms. Each can be edited or dropped first. Outcome memories follow the automatic validation rule in `DECISIONS.md` §3.1 and are marked "Auto-saved".
- AC3: Dropped candidates are never sent to Walrus and never appear in the Vault.

**US-08 — See that a memory is stored.**
As the CEO, I know when a memory is really saved, not just queued.
- AC1: A confirmed memory shows `queued` after `remember` returns a job reference.
- AC2: It shows `pending` while `waitForRememberJob` runs.
- AC3: It shows `stored` with the blob id only after `waitForRememberJob` resolves.
- AC4: On failure it shows "Memory not saved" with Retry. Retry settles the same job and never creates a duplicate.

**US-09 — Browse the Memory Vault.**
As the CEO, I see everything the company remembers, with its source and proof.
- AC1: Memories are grouped by company, project, and agent, with counts.
- AC2: Each row shows content, type, confidence, created time, source mission and task, status, and blob id when stored.
- AC3: Superseded memories are marked and collapsed by default.
- AC4: The Vault shows the Walrus status light from `health`.

**US-10 — Ask the Vault. (Phase 2, not in MVP. DECISIONS §8.)**
As the CEO, I ask in plain language what the company decided.
- AC1: The question is answered through `ask`, with source memories listed.
- AC2: If the Vault has no relevant memory, the answer says so. It does not guess.

**US-11 — Read the company briefing.**
As the CEO, I read where the company stands.
- AC1: Four sections: active missions, recent decisions, open risks, memory added this week.
- AC2: Generated by LLM over `recall` results from the company's namespaces, sorted by recent. `analyze` is not used (it writes memory).
- AC3: Each decision and risk links to its memory.

**US-12 — Compare with memory off.** (Optional control)
As the CEO, I can run the same template with recall disabled to show the difference in one company.
- AC1: A mission has `runMode`: `memory_on` (default) or `memory_off`.
- AC2: `memory_off` makes no `recall` call and records a skipped recall event.
- AC3: Two outputs can be shown side by side, linked to the same objective.

**US-13 — Verify a memory on Sui.**
As a judge or the CEO, I see proof that a memory is on Walrus and reachable from Sui.
- AC1: Each stored memory has a Proof action.
- AC2: The proof shows the blob id, the Sui reference read through Tatum, and the Walrus job id.
- AC3: If the Sui lookup fails, the blob id and the error are shown. The panel is never empty.

**US-14 — Redact before storing.**
As the CEO, I want credentials kept out of company memory.
- AC1: Every candidate is scanned for credential patterns before `remember`.
- AC2: A match is blocked. The CEO sees that a line was removed, not the secret.
- AC3: The secret never appears in the UI, logs, database, or Walrus.

**US-15 — Trace memory to output.**
As the CEO, I trace an output to the memories that shaped it.
- AC1: Each task has a recall event: query, memory ids, latency, timestamp.
- AC2: Clicking a memory in the recall event opens it in the Vault.

**US-16 — Correct a memory.**
As the CEO, I correct a memory without deleting history.
- AC1: A correction creates a new memory with `supersedesId` set to the old one.
- AC2: Recall and the Vault prefer the newest memory in a supersession chain.

**US-17 — Survive a refresh.**
As the CEO, my missions, tasks, feedback, and memories are still there after I reload.
- AC1: All state comes from the backend. The browser holds only view state.
- AC2: Reloading mid-mission resumes polling and shows current statuses.

**US-18 — Fail visibly.**
As the CEO, when AI or Walrus fails, I see what failed and what I can do.
- AC1: AI failure sets the task to `blocked` with a reason and a Retry action.
- AC2: Walrus write failure shows "Memory not saved" with Retry.
- AC3: Walrus recall failure shows "Ran without memory" and the mission continues.
- AC4: No failure path crashes the page or shows an empty screen.

**US-19 — See memory lifecycle.**
As the CEO, I know when a memory will expire and can renew it.
- AC1: Each memory shows one of `active`, `expiring_soon`, `renewal_required`, `expired`, with its expiry date from `listMemories` (`expires_at`).
- AC2: An expired memory stays visible with the message "This memory expired because its Walrus storage epoch ended." Renewal is offered only for memories that have not expired, since expired blobs cannot be restored.
- AC3: Expired and `renewal_required` memories are never returned by recall.
- AC4: Renewal (rewrite) is one click per memory or a batch from the Vault. The old memory is marked superseded only after the new one is `stored`.

**US-20 — Understand quota and custody.**
As the CEO, I see how much memory my company uses and what the custody model means.
- AC1: The Vault shows memory count and bytes used for the company, read from `listNamespaces`. It does not show a WAL price, because none is published for the hosted relayer.
- AC2: Creating memories stops with a clear message when the demo session cap or the operator quota is reached.
- AC3: The Vault labels each item as encrypted content, public blob metadata, or public proof link.
- AC4: The CEO can export memory metadata and forget a memory. The UI says that forgetting stops renewal and does not erase the blob. The disclosure at sign-in explains that Aquahab runs the operator account.

**US-22 — Get warned before memory expires.**
As the CEO, I hear about expiring memory before it is lost.
- AC1: A banner in the app lists memories that are `expiring_soon` or `renewal_required` (`GET /api/memory/expiring`).
- AC2: The next sign-in shows the same reminder if it is still unresolved.
- AC3: The banner links to the batch renewal. Email alerts are post-MVP.

**US-21 — Get to a memory-aware result quickly.**
As a new CEO, I reach my first stored memory and my first memory-aware repeat mission in minutes.
- AC1: Onboarding runs company setup, starter agents, first mission, feedback, first stored memory, and repeat mission (`docs/features/onboarding.md`).
- AC2: Targets: first mission under 60 seconds, first stored memory under 2 minutes, first memory-aware repeat mission under 5 minutes.
- AC3: The guided demo mission is "Plan a Sui wallet launch for Vietnam."

**US-23 — Configure and fund an agent.**
As the CEO, I set an agent's strategy, budget, and permissions before it works.
- AC1: The agent's config has strategy text, LLM budget in USD cents, per-task LLM cap in USD cents, memory quota (count and bytes), task quota (count), tool quota (count), and permissions.
- AC2: A save that makes memory quotas exceed the company quota is refused, and the message names the shortfall.
- AC3: Budget remaining is shown from the ledger, and the ledger balances (`docs/features/agent-governance.md`).

**US-24 — Pause, disable, or revoke an agent.**
As the CEO, I can stop an agent without losing its configuration.
- AC1: Pause stops new tasks. The in-flight task finishes or is blocked, and the desk says so.
- AC2: Disable removes the agent from routing. Enable restores it. The desk and seat do not change.
- AC3: Agent permissions can be revoked in the app. The UI says "App-only: this agent's recall is disabled", since Walrus has no per-agent keys.

**US-25 — Upload a skills.md safely.**
As the CEO, I can give an agent a skills file without risking the company's memory.
- AC1: The file is limited to 16 KB, Markdown only. Larger files are refused.
- AC2: Credential-like lines are blocked on upload. The UI reports line numbers only.
- AC3: Each save creates a new version. Tasks record the version they used.
- AC4: Skills content is never stored as memory.

## 9. Demo Success Criteria

The demo is two missions of the same template, with feedback between them. The video is 2–3 minutes. RESHADED §D demo script:

**Mission 1 — before.** In a fresh company (empty memory), the CEO assigns: "Plan a Sui wallet launch for Vietnam." The Researcher returns a long, hype-heavy brief. The Vault is empty.

**Feedback.** The CEO gives negative feedback: "Too long. Focus on Vietnam. Use a concise technical tone with citations." Candidates appear. The CEO confirms them. The Vault shows each one as `queued`, `pending`, then `stored` with a blob id. The Walrus Keeper reacts when each is stored.

**Mission 2 — after.** In the same company, the CEO assigns: "Write a launch brief for the Sui wallet." The Researcher's desk shows "Recalled N memories", and the recall animation plays. The output is shorter, Vietnam-focused, and technical.

**The CEO asks the Vault** "what tone do we use?" and gets a sourced answer. The Proof panel shows a blob id and a Sui reference.

**Demo passes when all of the following are true:**

- [ ] Mission 1 and Mission 2 use the same template and the same agent, with similar briefs.
- [ ] Mission 2 output reflects at least 3 memories stored after Mission 1 feedback, and each can be pointed to in the output.
- [ ] The recall event for Mission 2 lists the memory ids and is visible in the Desk panel.
- [ ] No memory shows `stored` before `waitForRememberJob` returns a blob id.
- [ ] At least one stored memory opens a Proof panel with a Walrus blob id and a Sui reference from Tatum.
- [ ] A credential pasted into feedback is blocked and absent from the database and Vault (scripted test).
- [ ] Recall for Mission 2 completes in 3–5 seconds. Mission completion is within 60–90 seconds.
- [ ] Reloading the page mid-demo keeps the state.
- [ ] The full demo runs 3 times in a row from a fresh company, without manual repair.
- [ ] Memory metrics are visible for the demo company: recall rate and influence rate ≥ 80% on the repeat mission, storage success ≥ 95%, feedback-to-memory 100%, recall latency within 3–5 seconds (S+ metrics).
- [ ] No memory in the demo is expired, and any `expiring_soon` memory is labeled.
- [ ] A before/after quality rating for the demo mission is recorded and positive (S+ mission improvement signal).
- [ ] The video is 2–3 minutes. Walrus write waits are covered by the visible `queued` and `pending` states, not by silence.

## 10. Assumptions and Open Questions

| # | Item | Impact | How we resolve it |
|---|---|---|---|
| A1 | Exact arguments and returns of the seven SDK methods | All Walrus code | Walrus Memory SDK reference, Day 1 |
| A2 | Native scope or namespace option | How scopes are separated | Reference; fall back to payload fields |
| A3 | Write latency, `remember` to blob id | Demo pacing | Day 2 spike |
| A4 | Account or auth setup for the Walrus client | Judge setup | Official setup; README |
| A5 | LLM provider and model (Tatum is not an LLM) | Agent output quality | Tatum reference, Day 3; wrap in `LLMClient` |
| A6 | Sui read path for a blob through Tatum | Proof panel | Tatum Sui gRPC guide, Day 3; fallback shows blob id and the Walrus link |
| A7 | Template for the demo (T1 or T2) | Demo script | Decide on Day 5 by checking output quality in a dry run |
| A8 | Network (Testnet or Mainnet) and epoch length (about 1 day on Testnet, about 2 weeks on Mainnet) | Retention window | Decide on Day 1. On Testnet the default relayer retention is about 5 days, so the demo should either renew by rewrite before recording or use Mainnet. |
| A9 | Who funds the operator account's WAL and SUI | Quota, renewal budget | Product/infra owner sets the budget on Day 1 |
| A10 | Seal encrypted memory flow in the Walrus Memory SDK, and whether recall and ask work on ciphertext or need decrypted content | Privacy design, Vault display | Confirm in the SDK reference on Day 1 (blocks Vault and Ask design) |
| A11 | Renewal and delegate methods in the SDK. Confirmed: no TS renew or extend. Add and remove delegate exist (owner only). | Renewal action, agent revoke | `rewrite` strategy for MVP (plan D2); `extend_blob` post-MVP |
| A12 | Epoch default in practice. The repo says 3 mainnet and 5 testnet; other docs say 50 and 2. | Retention window | Measure with `listMemories` after one `remember` on Day 2 |
| A13 | Hosted relayer quota and rate limits (self-host defaults: 60 points/min, 500/hour, 1 GB per account) | Quota meter, batch sizing | Read 429 responses and `listNamespaces` on Day 2 |
| A14 | `ask` availability. The TS SDK has no `ask`; the relayer has `POST /api/ask`; the Python SDK has `ask`. | Phase 2 Ask the Vault only (DECISIONS §8) | Resolve before Phase 2 planning. No MVP impact. |

## 11. Two-Week Plan

| Days | Work | Exit check |
|---|---|---|
| 1 | Repo setup per RESHADED stack (Next.js, R3F, Zustand, Tailwind). Read Walrus Memory API reference and Tatum docs. Confirm A1, A8 (network and epochs), A9 (storage budget), A10 (Seal flow), A11 (renewal and delegate). | Spike plan written; decisions recorded; project boots |
| 2 | **Walrus spike:** `health` → `remember` → `waitForRememberJob` → `recall` from a second process; measure latency (A3); try `restore` | Recall returns the stored memory in the second process |
| 3 | Data model (`DATA_MODEL.md`), SQLite, mission and task state machine, mock API (`API_DESIGN.md`) | One mission runs end to end with a stub AI and stub memory |
| 4 | the LLM provider via `LLMClient`; Agent Runtime with recall and prompt; redaction | Memory ON vs OFF prompt diff visible in logs |
| 5 | Mission Board (F1) and Desk panel (F2) with polling; 2D fallback; choose demo template (A7) | Creating a mission shows agent status changing |
| 6 | Feedback Loop (F4): rating, candidates, confirm, `remember`, settle, retry | Confirmed memory reaches `stored` with blob id |
| 7 | Memory Vault (F3): list, status, supersession, `health` light, Proof panel | Proof shows blob id and Sui reference |
| 8 | Company Briefing (F5) from `recall` + LLM; Vault filters and proof polish (Ask is Phase 2) | Briefing links every item to a memory; proof panel works on the demo network |
| 9 | Recall animation; recall event trace; failure states (`blocked`, retry, "Ran without memory") | Each failure in §8 US-18 reproduces and recovers |
| 10 | 3D HQ scene: One, four desks, Walrus Keeper, camera framing | HQ is clickable and readable |
| 11 | Demo flow end to end; fresh-company reset; preflight with `health` | Two-mission demo runs once cleanly |
| 12 | Polish, README, `restore` recovery path, performance check against 3–5 s recall | Three clean runs in a row |
| 13 | Freeze. Bug fixes only. Cut order applied if needed | No new features |
| 14 | Record 2–3 minute video, slides, submission | Submitted |

## 12. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Walrus write latency makes the demo slow | High | High | Visible `queued`/`pending` states; run Mission 1 and feedback before the recording; rehearse timing |
| Recall exceeds the 3–5 s target | Medium | Medium | Limit 5; cache company-scope results per mission; measure on Day 2 |
| Recall quality is inconsistent | Medium | High | Strict output contract; same brief in rehearsal; memory ids shown so reviewers can check |
| `analyze` is a write, not a summary tool | High | Medium | `analyze` kept out of MVP routes. Ask the Vault is Phase 2, so the missing `ask` in the TS SDK does not block MVP. |
| LLM or Sui lookup unavailable on demo day | Low | High | `LLMClient` with a recorded-output fallback for the demo only, labeled in the UI |
| Memory pollution (wrong memories stored) | Medium | High | CEO approves preference, feedback, and decision candidates; outcomes follow the validation rule; corrections supersede |
| 3D scope creep | High | Medium | One scene; cut order in §7.3; Phase 2 excluded |
| Credentials leak into memory | Low | Critical | Redaction before `remember`; scripted test; no secrets in feedback fields |
| Plaintext memory reaches Walrus | Low | Critical | Seal-encrypted flow only; test that the upload payload is ciphertext |
| Memory expires during the demo or judging window | Medium | High | Fixed duration covering the window; `expiring_soon` label; renew before recording |
| Storage cost overruns the demo budget | Medium | Medium | Spending cap per demo account; per-session memory cap; cost shown in Vault |
| Auto-saved outcome memories fill the Vault with low-value entries | Medium | Medium | Validation rule in `DECISIONS.md` §3.1; "Auto-saved" badge; CEO can forget or supersede; quota cap |
| Demo budget values are guesses and run out mid-demo | Medium | Medium | Mark as proposals; pre-run the demo to set values; show remaining budget on the desk |
| Operator key compromise exposes every company's memory | Low | Critical | Owner key offline; delegate key in secret manager; `removeDelegateKey` runbook; disclosure at sign-in |
| Shared operator quota is exhausted by many CEOs | Medium | High | Per-session cap; quota meter; batch renewal limits; raise quota before scale |
| Namespace isolation fails at the app layer | Low | Critical | Server checks `companyId` against the session on every route; cross-company test in CI |
| Seal or SDK flow adds latency to recall | Medium | Medium | Measure in Day 2 spike; keep recall at 5 results |

## 13. Deviations from RESHADED V2 (for approval)

`RESHADED_RE_SCAFFOLD_V2.md` is the source of truth and is not edited. These points differ from it because the SDK research (MemWal repo and docs.wal.app) shows different behavior:

1. **Owner of memory is the operator account, not the CEO's wallet.** V2 §Ownership says the CEO's Sui address is the owner. MVP is custodial (plan D1). Self-custody per CEO is the post-MVP path.
2. **"53 epochs" is not reachable through `remember`.** The relayer picks the epochs (default 3 on mainnet, 5 on testnet, cap 15 when self-hosted). Renewal is by rewrite (plan D2), not by extending the blob.
3. **"Delete unwanted memories" is Forget at the app level.** True deletion needs the owner wallet's signature (Security Delete API), so it is outside MVP.
4. **Cost model changes from WAL estimates to quota.** The hosted relayer's price is unpublished, so the Vault shows memory count and bytes per namespace.
5. **Company Briefing uses `recall` and LLM, not `analyze`.** The SDK's `analyze` extracts and stores facts; it is not a summary tool.

## 14. Positioning for Judges

- **Problem first:** agents forget, and the CEO pays for it in repeated context.
- **Proof, not claims:** the two-mission demo, the recall trace, and the Proof panel.
- **Walrus is the memory:** memories are stored, recalled, used in the next mission, and verifiable.
- **Scoped honestly:** one HQ per CEO, Phase 2 named and not built.

## Appendix: MVP scope update (v2.3, 2026-10-29)

Added to MVP (see `docs/product/DECISIONS.md` §9):
- Full-bleed HQ scene with overlay controls (left icon rail, agent tab strip, status card, right tab column, bottom status bar, CHAT button).
- Chat panel for assigning missions and asking for status, with a confirm step before any mission is created.
- Background music with a toggle, default off.

Still Phase 2: walking agents, standup, marketplace, analytics dashboard, layout editor, real-time agent conversation, runtime gateway.
