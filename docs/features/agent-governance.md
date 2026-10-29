# Feature Spec — Agent Governance: Configure, Fund, Permissions, Skills (F8)

**Phase 1 (MVP).** Source: `DECISIONS.md` §4–§7, `RESHADED_RE_SCAFFOLD_V3.md` (funding and permissions, superseded where noted).
Companion: `PRD.md` §7.2, §8 (US-23 to US-25), `SYSTEM_DESIGN.md` §4.7, `DATA_MODEL.md` §4.4–§4.7, `API_DESIGN.md` §6.

## Purpose

The CEO runs a company of five fixed agents. For each agent, the CEO sets its strategy, funds it, sets what it may do, and can pause or disable it. The agent never acts outside that profile, and every spend is recorded.

## Scope

- Five fixed roles, fixed desks: One, Researcher, Builder, Lofi, Hippo.
- No arbitrary agent creation.
- Runs on mission only. No scheduler.

## User Flow: Configure an agent

1. CEO opens an agent's desk and presses **Configure**.
2. **Identity** (read-only): name, role, desk.
3. **Strategy:** a text field, and optionally an uploaded `skills.md` (see §Skills).
4. **Funding:** LLM budget in USD cents, memory quota (count and bytes), task quota (count), tool quota (count), per-task LLM cap in USD cents.
5. **Permissions:** read company memory (yes or no), propose memory candidates (yes or no), call external tools (yes or no), recall results per task (1–5).
6. Press **Save**. The change is written as a new version of the agent profile.
7. The agent's status shows `enabled` or `disabled`, and `active` or `paused`.

The CEO can also **Pause** (keeps configuration, stops new tasks), **Resume**, **Disable** (removes from routing), and **Enable**.

## Budget Model

| Field | Unit | Enforced where |
|---|---|---|
| `llmBudgetCents` | USD cents, per agent, for the demo period | Before each LLM call |
| `perTaskLlmCapCents` | USD cents per task | Before each LLM call; the call is refused if the estimate exceeds the cap |
| `memoryQuotaCount` | memories | Before each `remember` call (candidate or auto-outcome) |
| `memoryQuotaBytes` | bytes of encrypted payload | Before each `remember` call |
| `taskQuotaCount` | tasks | When the orchestrator routes a task |
| `toolQuotaCount` | external tool calls | Before each tool call |

Rules:

- The sum of agent memory quotas for a company must not exceed the company's operator quota. The config screen blocks a save that breaks this rule.
- A budget ledger records every debit: `llm`, `memory`, `task`, `tool`, with amount, task ID, and timestamp.
- Budget exhausted: the task is **blocked** with reason "Budget exhausted: {type}". Other tasks in the mission continue. No partial output is stored as outcome.
- "Refund" is a ledger entry (`adjustment`) written by the CEO. No money moves.
- Demo default budgets are proposals in config, to be confirmed before the demo.

## Permissions Model

| Permission | Effect |
|---|---|
| `canReadCompanyMemory` | If false, recall scopes drop `company`. |
| `canProposeMemory` | If false, the agent's tasks produce no memory candidates and no outcome auto-store. |
| `canCallExternalTools` | If false, tool quota is ignored and tool calls are refused. |
| `maxRecallResults` | Cap per task, 1–5. |

Hard rules (not configurable):

- Agents **cannot call Walrus `remember()`**. Only the orchestrator does.
- Agents cannot read another company's memory. The server checks company ID on every call.
- Agents cannot spend beyond budget. Checks happen in the orchestrator before the call.
- The delegate key is server-side only. Agents never see it.
- Walrus has no per-agent permissions. The delegate key is account-wide, so these rules are enforced in Aquahab (`DECISIONS.md` §5).

## Skills (skills.md)

- The CEO may upload a `skills.md` as part of the strategy. It is **untrusted configuration input**.
- Limits: 16 KB, Markdown only. Larger files are rejected with "Skills file is too large (max 16 KB)".
- Redaction runs on upload. A credential-like line is blocked, and the CEO sees which line.
- Each save creates a version: `skillsVersion` (integer) plus `skillsHash` (SHA-256 of the redacted text).
- Skills text is placed in the agent prompt inside a fenced, labeled block, with the instruction that it is configuration, not an order to bypass rules.
- Skills are **never automatically stored as memory**. They are configuration, not memory (`DECISIONS.md` §7).
- An agent's task records which `skillsVersion` it used, so a result can be traced to a version.

## UI States

| State | What the CEO sees |
|---|---|
| Enabled, active | Green status. Budget bar shows remaining amounts. |
| Enabled, paused | Amber status: "Paused. Resume to take new tasks." |
| Disabled | Grey status: "Removed from routing. Configuration kept." |
| Budget low | Amber chip when any amount is under 20% |
| Budget exhausted | Red chip, "Budget exhausted: {type}" |
| Save blocked | Inline reason, such as "Memory quotas exceed company quota by 40 items" |
| Skills rejected | "Skills file is too large (max 16 KB)" or the redacted line |
| Skills version | "Version 3 · saved 14:02 · used by 4 tasks" |

## Data Requirements

- **Entities:** `Agent` (`enabled`, `paused`, `role`, `deskId`), `AgentStrategy` (versioned), `AgentBudget`, `AgentPermissions`, `BudgetLedgerEntry`, `SkillsVersion`. See `DATA_MODEL.md` §4.4–§4.7.
- **Reads:** `GET /api/agents/:agentId`, `GET /api/agents/:agentId/ledger`.
- **Writes:** `PUT /api/agents/:agentId/config` (strategy, budget, permissions), `POST /api/agents/:agentId/skills`, `POST /api/agents/:agentId/pause|resume|enable|disable`.

## Acceptance Criteria

- [ ] AC-GV-01: Only the five fixed roles exist. There is no create-agent action anywhere in the UI or API (test: route list has no create endpoint).
- [ ] AC-GV-02: Desks are fixed. An agent keeps its desk after pause, disable, or re-enable.
- [ ] AC-GV-03: A config save that makes the sum of memory quotas exceed the company quota is refused with the exact shortfall.
- [ ] AC-GV-04: Each LLM call debits the ledger with its cost estimate. A call estimated above `perTaskLlmCapCents` is not made.
- [ ] AC-GV-05: When `llmBudgetCents` is exhausted, the next task is blocked with "Budget exhausted: llm". Other agents' tasks continue.
- [ ] AC-GV-06: `canProposeMemory = false` produces zero memory candidates and zero auto-outcomes for that agent (fixture test).
- [ ] AC-GV-07: `canReadCompanyMemory = false` removes `company` from recall scopes (checked in the recall request log).
- [ ] AC-GV-08: No code path lets an agent call `remember()`. A static check fails the build if any agent module imports the Walrus client.
- [ ] AC-GV-09: A paused agent receives no new tasks. Its in-flight task finishes or is blocked, and the state is shown.
- [ ] AC-GV-10: `skills.md` over 16 KB is rejected. A credential-like line is blocked and reported by line number, never by value.
- [ ] AC-GV-11: Each `skills.md` save creates a new `skillsVersion`. Older tasks still show the version they used.
- [ ] AC-GV-12: `skills.md` content never appears in the memory index, the Vault, or a `remember` payload (test).
- [ ] AC-GV-13: The budget ledger balances: the sum of debits minus adjustments equals the amount spent shown in the UI.
