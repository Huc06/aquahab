# Aquahab — API Design (MVP, Phase 1)

| Field | Value |
|---|---|
| Status | Draft v1.0 (aligned to `RESHADED_RE_SCAFFOLD_V1.md` §A) |
| Date | 2026-10-26 |
| Related | `DATA_MODEL.md`, `SYSTEM_DESIGN.md` |

Internal APIs only. Base path `/api`. JSON in and out. No auth in MVP beyond a demo session cookie scoped to one company (PRD non-goal: production auth).

**Realtime:** polling, not SSE or WebSockets. RESHADED §E says "polling or lightweight async updates". The client polls `GET /api/missions/:missionId` and `GET /api/agents` every 1.5 seconds while a mission is active, and `GET /api/memory/vault` every 2 seconds while a write is `queued` or `pending`. Polling stops when nothing is in flight.

Only these Walrus Memory SDK methods are used by the backend: `remember`, `waitForRememberJob`, `recall`, `restore`, `health`, `listMemories`, `listNamespaces`. `ask` is Phase 2 only and not called in MVP (DECISIONS §8). `analyze` is not used by any MVP route: it writes extracted facts to memory and is not a summary tool (S+ v1.1). All calls are made by the server, never by the browser. Argument shapes are confirmed in `SYSTEM_DESIGN.md` §8 before implementation.

---

## 1. Conventions

### 1.1 Error shape

```json
{
  "error": {
    "code": "MEMORY_WRITE_FAILED",
    "message": "Memory not saved. You can retry.",
    "retryable": true
  }
}
```

| HTTP | When |
|---|---|
| 400 | Validation failed (missing title, objective too short, unknown enum) |
| 404 | Unknown id |
| 409 | Conflict (e.g. retry on a memory that is already `stored`) |
| 422 | Redaction blocked a candidate; body lists the removed line position, never the secret |
| 429 | `DEMO_CAP_REACHED`: demo spending cap or per-session memory cap reached; nothing was written (S+) |
| 502 | Walrus or Tatum upstream failure; the caller shows `blocked` or `retrying` |
| 500 | Unexpected; the UI shows the global error banner with Retry |

### 1.2 Failure behavior (RESHADED §D)

| Failure | Backend behavior | UI |
|---|---|---|
| AI fails | Task → `blocked`, `blockerReason` set | Task card "Blocked" with Retry |
| Walrus `remember` fails | Memory `writeStatus = failed` | "Memory not saved" + Retry |
| Walrus `recall` fails | `RecallEvent.skipped = true`, `skipReason = recall_failed`; agent continues with empty context | Warning "Ran without memory" |
| Network fails | Client keeps last state | Global error banner with Retry |
| Retry of a blocked task | Task → `working`, `attempt += 1` | "Retrying…" |

---

## 2. Missions

### `POST /api/missions`

Create a mission and route it. Routing is synchronous for the recall and asynchronous for task execution.

Request:

```json
{
  "companyId": "co_aquahab_hq",
  "title": "Plan a Sui wallet launch for Vietnam",
  "objective": "Draft a launch brief for the Sui wallet in Vietnam.",
  "constraints": ["Vietnam first", "Technical tone", "Cite sources"],
  "priority": "high",
  "templateId": "T1",
  "runMode": "memory_on"
}
```

Validation: `title` 3–80 chars; `objective` 10–1000 chars; `constraints` 0–10 items; `priority` in enum; `runMode` defaults to `memory_on`.

Response `201`: the `Mission` (status `active`) with its `Task` list (3–6 tasks, status `assigned`).

Side effects: One performs a routing `recall` (recorded as a `RecallEvent` with `taskId` null and `agentId` = One), then creates tasks and sets each agent's status to `assigned`.

### `GET /api/missions/:missionId`

Mission, tasks, assigned agents, outputs, recall events, and memories created from this mission. This is the main polling endpoint.

Response `200`:

```json
{
  "mission": { "id": "m_001", "status": "active", "runMode": "memory_on", "...": "..." },
  "tasks": [{ "id": "t_004", "agentId": "researcher_01", "status": "review", "attempt": 1, "...": "..." }],
  "recallEvents": [{ "taskId": "t_004", "memoryIds": ["mem_014"], "latencyMs": 2140, "skipped": false }],
  "memories": [{ "id": "mem_014", "writeStatus": "stored", "walrusBlobId": "blob_9c71" }]
}
```

### `GET /api/missions`

List missions for the company, newest first. Used by the Mission Board on refresh. Query: `companyId` (required), `status` (optional), `limit` (default 20).

---

## 3. Tasks

### `POST /api/tasks/:taskId/start`

Mark the task `working`, run the recall, build the prompt, and call the AI. This is the endpoint that triggers memory recall (RESHADED §A: "Mark task as working and trigger memory recall").

Request: empty body.

Order of operations (RESHADED §D Agent Runtime):

1. Set `status = working`, `agent.status = working`.
2. If `mission.runMode = memory_on`: call `recall` with query built from mission objective, task input, agent role, and constraints. Limit 5. Record `RecallEvent`. If `recall` fails or times out, record `skipped` and continue.
3. Build the prompt with role, mission, task input, constraints, and a `Known from memory` section when memories exist.
4. Call the AI (the LLM provider via `LLMClient`).
5. On success: write the output to the task via `POST /api/tasks/:taskId/complete` semantics (see §3.2). On failure: `status = blocked`.

Response `202` with the task (status `working`). The actual steps run in the background; the client polls.

Target: recall within 3–5 seconds; end-to-end task within the mission target of 60–90 seconds for the full mission.

### `POST /api/tasks/:taskId/complete`

Submit agent output. Called by the runtime after the AI returns; exposed for the demo mock and for tests.

Request:

```json
{ "output": "## Brief\n..." }
```

Response `200`: the task with `status = review` and `agent.status = review`.

### `POST /api/tasks/:taskId/retry`  **[added]**

Re-run a `blocked` task. Sets `attempt += 1`, status `working`, and starts the runtime again. Returns `409` if the task is not `blocked`.

---

## 4. Feedback

### `POST /api/tasks/:taskId/feedback`

Submit CEO feedback and create memory candidates (RESHADED §A: "Submit CEO feedback and create memory"). Candidates are proposed, not stored. Nothing reaches Walrus here.

Request:

```json
{
  "rating": "negative",
  "comment": "Too long. Focus on Vietnam. Use a concise technical tone with citations.",
  "correctiveInstruction": "Keep the brief under 300 words, focus on Vietnam, cite sources."
}
```

Response `201`:

```json
{
  "feedback": { "id": "fb_01", "rating": "negative", "...": "..." },
  "candidates": [
    { "tempId": "c1", "scope": "agent", "type": "preference", "ownerId": "researcher_01", "content": "CEO prefers a concise technical tone with citations.", "confidence": 0.9 },
    { "tempId": "c2", "scope": "company", "type": "decision", "ownerId": "co_aquahab_hq", "content": "Vietnam-first launch.", "confidence": 0.9 },
    { "tempId": "c3", "scope": "agent", "type": "feedback", "ownerId": "researcher_01", "content": "Avoid hype-heavy copy.", "confidence": 0.9 }
  ]
}
```

Rules: 1–5 candidates. Each candidate's `scope`, `type`, and `ownerId` follow the mapping in `DATA_MODEL.md` §3.1. A candidate that matches a credential pattern is returned with `"blocked": true` and `"content": "[removed]"`. The secret is never in the response or logs.

---

## 5. Memory

### `POST /api/memory/remember`

Store a new memory. Only called after the CEO confirms candidates. Returns immediately with a job reference. The write is not finished yet.

Request:

```json
{
  "companyId": "co_aquahab_hq",
  "scope": "agent",
  "type": "feedback",
  "ownerType": "agent",
  "ownerId": "researcher_01",
  "content": "CEO wants concise, cited market briefs with no hype.",
  "confidence": 0.9,
  "sourceMissionId": "m_001",
  "sourceTaskId": "t_004",
  "supersedesId": null
}
```

Response `202`:

```json
{ "memory": { "id": "mem_014", "writeStatus": "queued", "walrusJobId": "job_8f2a" } }
```

Redaction runs first. A blocked content returns `422`. Duplicate protection: the same `(companyId, scope, ownerId, content)` within the last 10 minutes returns `409` with the existing memory id.

Walrus calls: `remember` (sets `queued` then `pending`), then a background `waitForRememberJob` sets `stored` with the blob id or `failed` with the error.

### `POST /api/memory/:memoryId/retry`  **[added]**

Re-settle a `failed` memory. Calls `waitForRememberJob` with the existing `walrusJobId`. Never calls `remember`. Returns `409` if the memory is already `stored`.

### `POST /api/memory/recall`

Recall relevant memories for an agent and mission (RESHADED §A). Used by the runtime and by the Desk panel's "what would this agent recall now?" inspector.

Request:

```json
{
  "companyId": "co_aquahab_hq",
  "agentId": "researcher_01",
  "missionId": "m_002",
  "query": "Write a launch brief for the Sui wallet. Vietnam. Researcher.",
  "limit": 5
}
```

Response `200`:

```json
{
  "memories": [
    { "id": "mem_014", "scope": "agent", "type": "feedback", "content": "CEO wants concise, cited market briefs with no hype.", "confidence": 0.9, "writeStatus": "stored" }
  ],
  "latencyMs": 2140
}
```

Only `writeStatus = "stored"` memories are returned. Results are ranked by relevance, then recency, then confidence (RESHADED §D: "Prefer relevance, recency, confidence, and company constraints"). Returns 3–5 items when available.

Walrus call: `recall`. Failure returns `502` with `retryable: true`; the caller continues with an empty list.

### `GET /api/memory/vault`

List memories by company, scope, and owner (RESHADED §A).

Query parameters:

| Param | Required | Values |
|---|---|---|
| `companyId` | yes | id |
| `scope` | no | `agent`, `project`, `company` |
| `ownerId` | no | agent or project or company id |
| `type` | no | `preference`, `outcome`, `feedback`, `decision` |
| `writeStatus` | no | `queued`, `pending`, `stored`, `failed` |
| `includeSuperseded` | no | `false` (default) or `true` |

Response `200`:

```json
{
  "memories": [{ "id": "mem_014", "type": "feedback", "lifecycle": "expiring_soon", "isEncrypted": true, "endEpoch": 412, "expiresAt": "2026-12-01T00:00:00Z", "renewalState": "not_needed", "...": "..." }],
  "counts": { "company": 4, "project": 2, "agent": 7 },
  "quota": { "memoryCount": 14, "bytesUsed": 48213, "bytesLimit": 1073741824, "source": "listNamespaces", "renewalDue": 2, "network": "testnet" },
  "health": { "ok": true, "checkedAt": "2026-10-26T09:10:00Z" }
}
```

Each memory includes `sourceMissionId`, `sourceTaskId`, `confidence`, `createdAt`, `writeStatus`, `lifecycle`, `isEncrypted`, `endEpoch`, `expiresAt`, `renewalState`, `renewedFromId`, and `walrusBlobId` when stored. `quota` comes from `listNamespaces` and `listMemories` (S+ v1.1), not from a WAL cost estimate. Forgotten memories are excluded unless `includeForgotten=true`. Expired memories are included, never hidden (S+).

### `POST /api/memory/renew`  **[added, S+ v1.1]**

Renew one or many memories. Body: `{ "companyId": "...", "ids": ["mem_014", "mem_015"] }`. Batch limit 20 (the `rememberBulk` cap).

- Strategy is `rewrite` (plan D2): the server recalls each memory's text, then calls `remember` with `renewedFromId` set. The response returns the new memory IDs with `writeStatus: "queued"`. The old memory moves to `superseded` only after the new one is `stored`.
- Returns `409` for `forgotten` memories. Returns `422` if the memory's text was redacted at its original write and cannot be rewritten as-is.
- Idempotency key per memory (`renew:{memoryId}:{endEpoch}`), so a repeat click cannot write twice.
- Counts against the quota and the rate-limit points (remember 5 per write).

### `POST /api/memory/:memoryId/forget`  **[added, S+]**

Set `forgottenAt`. Lifecycle is unchanged (`DECISIONS.md` §2: forgetting is not a lifecycle state). The memory leaves the Vault list and is not renewed. The response says the blob persists until its paid epochs end.

### `GET /api/memory/export`  **[added, S+]**

### `GET /api/memory/expiring`  **[added, S+ v1.1]**

List memories with `lifecycle` `expiring_soon` or `renewal_required`, sorted by `expiresAt`. Query: `companyId` (required), `withinDays` (default 14). Used by the banner, the sign-in reminder, and the renewal batch.

Export metadata for the company as JSON: ids, types, scopes, owners, dates, sizes, endEpoch, expiresAt, renewalState, and `forgottenAt`. No plaintext content unless the query sets `includeContent=true`, which is owner-only and logged as an export event.

### `POST /api/agents/:agentId/revoke`  **[added, S+]**

Revoke the agent's delegate access where the SDK supports it (A11). If the SDK does not support it, the endpoint disables that agent's recall in our app and returns `"scope": "app_only"` so the UI can say so.

### `POST /api/companies`  **[added, S+]**

Onboarding steps 2 and 3 (company name and starter agents). Body: `{ "name": "...", "starterAgents": ["one", "researcher", ...] }`. The CEO identity comes from the session (`POST /api/session`, demo CEO for the hackathon). No wallet is involved (S+ v1.1, custodial). The endpoint creates the company, its `namespacePrefix` (`aquahab:{companyId}`), its quota row, and the starter agents.

### `POST /api/session`  **[added, S+ v1.1]**

Demo sign-in. Body: `{ "displayName": "..." }`. Returns a session cookie tied to one `User`. Disclosure acknowledgement is recorded here (`disclosureAckAt`). Phase 2 replaces this with Google sign-in via Enoki zkLogin (DECISIONS §8), not with per-user Walrus accounts.

### `GET /api/memory/:memoryId/proof`

Return the Walrus job and blob proof, plus the Sui reference read through Tatum (RESHADED §A).

Response `200`:

```json
{
  "memoryId": "mem_014",
  "walrusJobId": "job_8f2a",
  "walrusBlobId": "blob_9c71",
  "sui": { "status": "found", "reference": "...", "source": "tatum" }
}
```

If the Sui lookup fails: `"sui": { "status": "unavailable", "error": "..." }`. The blob id is always returned.

### `POST /api/memory/ask`  **[Phase 2, not in MVP. DECISIONS §8.]**

Question answered through `ask` (planned use: SYSTEM_DESIGN §8.2). Used by the Vault's "Ask the Vault" box, which is Phase 2. Do not implement or expose this route in MVP.

Request: `{ "companyId": "co_aquahab_hq", "question": "What tone do we use?" }`

Response `200`:

```json
{
  "answer": "Concise and technical, with citations.",
  "sources": [{ "memoryId": "mem_014" }],
  "found": true
}
```

If nothing relevant: `"found": false`, `"answer": null`, `"sources": []`. No guessed answer.

### `POST /api/memory/restore`  **[added]**

Rebuild the local memory index from Walrus with `restore`. Used when `recall` returns nothing for a company that has memories, and from the demo preflight. Restricted to the demo operator.

### `GET /api/memory/health`  **[added]**

Wraps `health`. Returns `{ "ok": true, "checkedAt": "..." }` or `{ "ok": false, "detail": "..." }`. Shown as the status light in the Vault. Polled every 30 seconds, and once at demo preflight.

---

## 6. Agents

### `GET /api/agents`

List the company's agents with role, status, desk position, and current task (RESHADED §A).

Query: `companyId` (required).

Response `200`:

```json
{
  "agents": [
    { "id": "researcher_01", "name": "Researcher", "role": "researcher", "status": "review", "currentTaskId": "t_004", "deskPosition": { "x": 2, "y": 0, "z": -1 } }
  ]
}
```

The Walrus Keeper is not in this list. The Vault gets its state from `GET /api/memory/health` and `GET /api/memory/vault`.

---

### Agent governance  **[added, DECISIONS.md §3–§7]**

There is no create-agent route. The five roles are seeded per company.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/agents/:agentId` | Profile, enabled and paused flags, budget (remaining derived from ledger), permissions, current strategy and skills versions |
| `PUT` | `/api/agents/:agentId/config` | Save strategy text, budget, and permissions as a new strategy version. Refused with `409` if memory quotas exceed the company quota (names the shortfall). |
| `POST` | `/api/agents/:agentId/skills` | Upload `skills.md` (max 16 KB, Markdown). Redacted before save. Response lists removed line numbers. A new `skillsVersion` is created. `413` if too large. |
| `POST` | `/api/agents/:agentId/pause` | Stop new tasks. In-flight task finishes or is blocked. |
| `POST` | `/api/agents/:agentId/resume` | Allow new tasks again |
| `POST` | `/api/agents/:agentId/disable` | Remove from routing; config kept |
| `POST` | `/api/agents/:agentId/enable` | Return to routing |
| `GET` | `/api/agents/:agentId/ledger` | Budget ledger entries, newest first. Query: `kind`, `limit` (default 50). |
| `POST` | `/api/agents/:agentId/ledger/adjust` | CEO refund or correction. Body: `{ "kind": "adjustment", "amount", "unit", "reason" }`. Append-only. |

Errors: `403` if the caller is not the company owner. `409` on quota conflicts. `422` for redaction-blocked skills text (body gives line numbers only, never values).

Memory writes: `POST /api/memory/remember` is called by the orchestrator only. Agents have no route to it. Outcome auto-stores are created by the orchestrator with `approvedBy: "auto_validated"` and `autoSaved: true`. Candidates for preference, feedback, and decision keep `approvedBy: "ceo"`.

## 7. Briefing  **[added]**

### `GET /api/briefing`

Company briefing generated by LLM over `recall` results from the company's namespaces (SYSTEM_DESIGN §8.2). `analyze` is not used here: it writes extracted facts to memory (S+ v1.1). Query: `companyId` (required).

Response `200`: the `Briefing` shape from `docs/features/company-briefing.md`, with `source: "recall+llm" | "recall-only"`.

---

## 8. Demo Endpoints (demo operator only)  **[added]**

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/demo/reset` | Clear missions, tasks, recall events, feedback for the demo company. Memories in Walrus are untouched. |
| `POST` | `/api/missions/:missionId/compare` | Create the paired run with the opposite `runMode` and the same objective, constraints, and template |

Both are disabled unless `DEMO_MODE=1` on the server.

---

## 9. Endpoint Summary

| Method | Path | RESHADED | Walrus SDK calls | Status |
|---|---|---|---|---|
| POST | `/api/missions` | yes | `recall` (routing) | v1 |
| GET | `/api/missions/:missionId` | yes | — | v1 |
| GET | `/api/missions` | added | — | added |
| POST | `/api/tasks/:taskId/start` | yes | `recall` | v1 |
| POST | `/api/tasks/:taskId/complete` | yes | — | v1 |
| POST | `/api/tasks/:taskId/retry` | added | `recall` | added |
| POST | `/api/tasks/:taskId/feedback` | yes | — (candidates only) | v1 |
| POST | `/api/memory/remember` | yes | `remember`, `waitForRememberJob` | v1 |
| POST | `/api/memory/:memoryId/retry` | added | `waitForRememberJob` | added |
| POST | `/api/memory/recall` | yes | `recall` | v1 |
| GET | `/api/memory/vault` | yes | — | v1 |
| GET | `/api/memory/:memoryId/proof` | yes | — (Tatum Sui read) | v1 |
| POST | `/api/memory/ask` | Phase 2 | `ask` | not in MVP |
| POST | `/api/memory/restore` | added | `restore` | added |
| GET | `/api/memory/health` | added | `health` | added |
| GET | `/api/agents` | yes | — | v1 |
| GET | `/api/briefing` | added | `recall` (sort recent, several namespaces) | added |
| POST | `/api/session` | added (S+ v1.1) | — | added |
| GET | `/api/memory/expiring` | added (S+ v1.1) | — | added |
| POST | `/api/demo/reset` | added | — | added |
| POST | `/api/missions/:missionId/compare` | added | — | added |
| POST | `/api/companies` | added (S+) | — | added |
| POST | `/api/memory/renew` | added (S+ v1.1) | `remember` (rewrite strategy) | added |
| POST | `/api/memory/:memoryId/forget` | added (S+) | — | added |
| GET | `/api/memory/export` | added (S+) | — | added |
| POST | `/api/agents/:agentId/revoke` | added (S+) | delegate revoke, if supported (A11) | added |

The v1 routes keep the RESHADED paths exactly. Added routes are needed by the feature specs and the Walrus lifecycle.
