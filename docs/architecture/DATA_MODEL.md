# Aquahab — Data Model (MVP, Phase 1)

| Field | Value |
|---|---|
| Status | Draft v1.0 (aligned to `RESHADED_RE_SCAFFOLD_V1.md` §S) |
| Date | 2026-10-26 |
| Source of truth | `RESHADED_RE_SCAFFOLD_V1.md` §S; additions are marked **[added]** |
| Related | `SYSTEM_DESIGN.md`, `API_DESIGN.md`, `PRD.md` |

All IDs are opaque strings (UUID v4 unless noted). Timestamps are ISO 8601 UTC. Enum values are lowercase snake_case.

---

## 1. Entities Overview

```text
User ──< Company >── Agent
              │
              ├──< Project >──< Mission >──< Task >──< Feedback
              │                     │            │
              ├──< AquahabMemory <──┼────────────┘ (sourceMissionId / sourceTaskId)
              │                     │
              └──< RecallEvent >────┴──> Task (taskId)   [added]
```

Walrus Memory is the durable store for `AquahabMemory` content. The local database holds the same records as an index so the Vault and UI can list, filter, and show status without a Walrus read on every render.

---

## 2. Enums

```ts
type MemoryScope = "agent" | "project" | "company";

type MemoryType = "preference" | "outcome" | "feedback" | "decision";

type AgentRole = "chief_of_staff" | "researcher" | "builder" | "creative" | "operations";

type AgentStatus = "idle" | "assigned" | "working" | "review" | "blocked" | "offline";

type MissionStatus = "draft" | "active" | "review" | "completed" | "failed";

type TaskStatus = "assigned" | "working" | "review" | "done" | "blocked";

type Rating = "positive" | "neutral" | "negative";

type Priority = "low" | "normal" | "high";                       // [added] RESHADED §R requires priority on missions

type WriteStatus = "queued" | "pending" | "stored" | "failed";   // [added] Walrus write lifecycle, see §5

type RunMode = "memory_off" | "memory_on";                       // [added] before/after demo switch

type LifecycleStatus = "active" | "expiring_soon" | "renewal_required" | "expired"; // [S+, DECISIONS.md §2: exactly four states]
type RenewalStrategy = "rewrite" | "extend_blob";                // [added, S+ v1.1] MVP uses "rewrite"; "extend_blob" only after A11 and self-host
type RenewalState = "not_needed" | "due" | "renewed" | "failed" | "unsupported"; // [added, S+ v1.1]
```

Agent role mapping for the demo cast:

| Character | `AgentRole` | Notes |
|---|---|---|
| One | `chief_of_staff` | Routes missions; synthesizes the briefing |
| Researcher | `researcher` | Market and insight |
| Builder | `builder` | Engineering |
| Lofi | `creative` | Content |
| Hippo | `operations` | Operations and finance |
| Walrus Keeper | — | UI character for the Memory Vault only. **Not an `Agent` row.** |

---

## 3. Core Entities (RESHADED §S)

```ts
interface User {
  id: string;
  // [S+ v1.1] custodial: no wallet is required. Identity is the app session (demo CEO for hackathon).
  externalId?: string;         // identity from the app's auth provider, when one exists (scale phase)
  displayName: string;
  companyId: string;
}

interface Company {
  id: string;
  ownerId: string;             // User.id of the CEO
  name: string;
  operatorAccountId: string;   // [S+ v1.1] MemWalAccount ID of the Aquahab operator account that holds the company's blobs
  namespacePrefix: string;     // [S+ v1.1] "aquahab:{companyId}"; scope and id are appended per memory
  memoryNamespace: string;     // company namespace = namespacePrefix + ":company"
}

interface Agent {
  id: string;
  companyId: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  currentTaskId?: string;
  deskPosition: { x: number; y: number; z: number };
  memoryNamespace: string;     // namespace inside the CEO's company space; agents own no memories (S+)
}

interface Mission {
  id: string;
  companyId: string;
  ceoId: string;
  projectId?: string;          // [added] anchors project-scope memory
  templateId?: string;         // [added] demo template (T1..T6)
  title: string;
  objective: string;
  constraints: string[];
  priority: Priority;          // [added] required by RESHADED §R
  runMode: RunMode;            // [added] memory_on by default
  status: MissionStatus;
  createdAt: string;
  updatedAt: string;
}

interface Task {
  id: string;
  missionId: string;
  agentId: string;
  title: string;
  input: string;
  output?: string;
  status: TaskStatus;
  blockerReason?: string;      // set when status = blocked
  attempt: number;             // [added] starts at 1; incremented by each retry
  createdAt: string;
  updatedAt: string;
}

interface Feedback {
  id: string;
  missionId: string;
  taskId: string;
  ceoId: string;
  rating: Rating;
  comment: string;
  correctiveInstruction?: string;   // what the agent should do differently next time
  createdAt: string;               // [added]
}

interface AquahabMemory {
  id: string;
  companyId: string;
  ownerType: "agent" | "company";  // project-scope memories are owned by the project's company
  ownerId: string;
  scope: MemoryScope;
  type: MemoryType;
  content: string;                 // CEO-confirmed text, post-redaction
  sourceMissionId?: string;
  sourceTaskId?: string;
  confidence: number;              // 0..1
  walrusJobId?: string;
  walrusBlobId?: string;
  // [added] fields below
  writeStatus: WriteStatus;        // derived rule in §5; stored iff walrusBlobId is set
  supersedesId?: string;           // correction chain; old memory is never edited
  createdAt: string;
  storedAt?: string;
  error?: string;
  // [added, S+] lifecycle, cost, privacy
  lifecycle: LifecycleStatus;  // separate from writeStatus; recall uses only active and expiring_soon
  isEncrypted: boolean;        // true when stored through the Seal-encrypted flow; must be true for all memories
  blobSizeBytes?: number;      // reported by listMemories size, counted against the namespace quota
  endEpoch?: number;           // [S+ v1.1] from listMemories end_epoch; null until the expiry sweep runs
  expiresAt?: string;          // [S+ v1.1] from listMemories expires_at; drives expiring_soon
  renewedFromId?: string;      // [S+ v1.1] set on a "rewrite" renewal; points to the memory it replaces
  renewalStrategy?: RenewalStrategy;
  renewalState: RenewalState;  // [S+ v1.1] "unsupported" until the rewrite path is verified in the spike
  forgottenAt?: string;        // set by CEO "forget"; a field, not a lifecycle state (DECISIONS.md §2). Memory leaves the Vault list.
  approvedBy?: "ceo" | "auto_validated";  // [DECISIONS.md §3] how the memory was approved for storage
  autoSaved: boolean;          // true for outcome memories stored after the §3.1 validation; shows the "Auto-saved" badge
  skillsVersion?: number;      // [DECISIONS.md §7] version of skills.md used by the task that produced this memory; never set on preference, feedback, or decision
}
```

### 3.1 Memory rules (RESHADED §S)

| Event | `type` | `scope` | `ownerType` / `ownerId` |
|---|---|---|---|
| CEO gives a preference | `preference` | `agent` or `company` | agent id or company id |
| Agent completes a task | `outcome` | `agent` or `project` | agent id or project's company |
| CEO gives corrective feedback | `feedback` | `agent` | agent id |
| CEO approves a strategic direction | `decision` | `company` | company id |

Example (RESHADED):

```json
{
  "scope": "agent",
  "type": "feedback",
  "ownerId": "researcher_01",
  "content": "CEO wants concise, cited market briefs with no hype.",
  "confidence": 0.9
}
```

---

## 4. Added Entities

### 4.1 Project  **[added]**

Needed so `scope: "project"` has an owner. One project groups missions of the same initiative.

```ts
interface Project {
  id: string;
  companyId: string;
  name: string;               // e.g. "Sui wallet launch — Vietnam"
  createdAt: string;
}
```

### 4.2 RecallEvent  **[added]**

Needed for the proof that memory changed the output (PRD §9, RESHADED Vault requirement "visible recall").

```ts
interface RecallEvent {
  id: string;
  taskId: string;
  agentId: string;
  query: string;                // built from mission objective, task input, role, constraints
  scopes: MemoryScope[];
  memoryIds: string[];          // 0–5 results injected into the prompt
  injectedCount: number;        // [added, S+] memories actually placed in the prompt; drives memory influence rate
  skipped: boolean;             // true when runMode = memory_off or recall failed
  skipReason?: "memory_off" | "recall_failed";
  latencyMs: number;            // checked against the 3–5 second target
  createdAt: string;
}
```

### 4.3 WalrusHealth  **[added]**

Last result of `health`, kept for the UI status light and the demo preflight.

```ts
interface WalrusHealth {
  checkedAt: string;
  ok: boolean;
  detail?: string;
}
```

---

### 4.4 Agent Profile  **[added, DECISIONS.md §6]**

Agents are the five fixed roles. Desks never change.

```ts
type AgentRoleFixed = "chief_of_staff" | "researcher" | "builder" | "creative" | "operations";

interface AgentProfile {
  agentId: string;             // fixed per role, for example "one", "researcher", "builder", "lofi", "hippo"
  companyId: string;
  role: AgentRoleFixed;
  deskId: string;              // fixed
  enabled: boolean;            // false = removed from routing, config kept
  paused: boolean;             // true = no new tasks; in-flight task finishes or is blocked
  currentStrategyVersion: number;
  currentSkillsVersion?: number;
  updatedAt: string;
}
```

### 4.5 Agent Strategy and Skills  **[added, DECISIONS.md §7]**

```ts
interface AgentStrategyVersion {
  agentId: string;
  version: number;             // increments on every save
  strategyText: string;        // CEO-written, redacted, max 2,000 characters
  createdAt: string;
  createdBy: string;           // CEO id
}

interface SkillsVersion {
  agentId: string;
  version: number;             // increments on every save
  skillsHash: string;          // SHA-256 of the redacted Markdown
  content: string;             // redacted Markdown, max 16 KB; untrusted input, never memory
  createdAt: string;
  redactionRemovedLines: number[];  // line numbers only, never values
}
```

### 4.6 Agent Budget and Permissions  **[added, DECISIONS.md §4–§5]**

```ts
interface AgentBudget {
  agentId: string;
  llmBudgetCents: number;        // USD cents, demo period
  perTaskLlmCapCents: number;    // USD cents per task
  memoryQuotaCount: number;
  memoryQuotaBytes: number;
  taskQuotaCount: number;
  toolQuotaCount: number;
  // derived, not stored: remaining = quota - ledger sum
}

interface AgentPermissions {
  agentId: string;
  canReadCompanyMemory: boolean;
  canProposeMemory: boolean;     // proposal only; the orchestrator is the only caller of remember()
  canCallExternalTools: boolean;
  maxRecallResults: number;      // 1–5
}
```

Hard rules, not stored as data: agents cannot call `remember()`; agents cannot read another company; the delegate key is server-side only.

### 4.7 Budget Ledger  **[added, DECISIONS.md §4]**

```ts
interface BudgetLedgerEntry {
  id: string;
  agentId: string;
  companyId: string;
  kind: "llm" | "memory" | "task" | "tool" | "adjustment";
  amount: number;                // cents for llm; count for memory, task, tool; bytes for memory bytes
  unit: "cents" | "count" | "bytes";
  taskId?: string;
  reason?: string;               // required for adjustment (for example "CEO refund")
  createdAt: string;
}
```

Ledger is append-only. "Refund" is an `adjustment` entry with a reason. No money moves. The remaining budget is the quota minus the sum of debits, plus adjustments.

## 5. Walrus Write Lifecycle

`AquahabMemory.writeStatus` is the single source for what the UI may claim.

| `writeStatus` | Set when | Required fields | UI label |
|---|---|---|---|
| `queued` | `remember` returned a job reference | `walrusJobId` | "Queued" |
| `pending` | `waitForRememberJob` is in progress | `walrusJobId` | "Writing to Walrus…" |
| `stored` | `waitForRememberJob` resolved | `walrusJobId`, `walrusBlobId`, `storedAt` | "Stored" + blob ID |
| `failed` | write or settle failed | `error` | "Memory not saved" + Retry |

Invariants (enforced in the memory service, covered by tests):

1. `writeStatus = "stored"` ⇔ `walrusBlobId` is set.
2. A memory with `writeStatus = "failed"` retries by calling `waitForRememberJob` with its existing `walrusJobId`. It never calls `remember` again.
3. `AquahabMemory` content is immutable after `remember`. A correction creates a new memory with `supersedesId` set.
4. Only memories with `writeStatus = "stored"` are eligible for recall in a demo run.

---

## 6. Memory Eligibility Policy  **[added]**

Only these inputs become memories:

- CEO preferences, feedback, and decisions.
- Task outcomes (a short summary of the output and the CEO's rating, not the full output).

Never stored in Walrus Memory:

- Player position, chat, camera, or any UI state.
- Raw prompts, full task logs, or full outputs.
- Credentials of any kind (API keys, tokens, private keys, seed phrases, `Authorization` headers, session cookies, URLs with `user:password`). Redaction runs before every `remember` call. A match blocks the candidate. Obvious personal identifiers (email, phone, ID numbers, home address) are flagged, and kept only when the CEO explicitly chooses to keep them (S+).

Plaintext never reaches Walrus. Every memory is written through the Seal-encrypted flow, so `isEncrypted` is true for every stored memory. A test checks that the upload payload is ciphertext.

---

## 7. Local Database Tables (SQLite)

One table per entity above. Indexes:

| Table | Index | Reason |
|---|---|---|
| `memories` | `(companyId, scope, ownerId, writeStatus)` | Vault list and filters |
| `memories` | `(walrusJobId)` | Settle and retry by job |
| `recall_events` | `(taskId)` | Desk panel and proof trace |
| `tasks` | `(missionId, agentId)` | Mission view |
| `feedback` | `(taskId)` | Review panel |

Persistence rule: all of the above survive a browser refresh because the state lives on the backend. The browser keeps no authoritative state (RESHADED: "Page refresh preserves memory context").

Demo reset clears `missions`, `tasks`, `recall_events`, and `feedback` for the demo company only. It never deletes `memories` rows that have a `walrusBlobId`, because Walrus records cannot be removed.

---

## 8. Example Records

Mission (demo Mission 1, RESHADED §D):

```json
{
  "id": "m_001",
  "companyId": "co_aquahab_hq",
  "ceoId": "u_ceo",
  "projectId": "p_sui_wallet_vn",
  "templateId": "T1",
  "title": "Plan a Sui wallet launch for Vietnam",
  "objective": "Draft a launch brief for the Sui wallet in Vietnam.",
  "constraints": ["Vietnam first", "Technical tone", "Cite sources"],
  "priority": "high",
  "runMode": "memory_off",
  "status": "review",
  "createdAt": "2026-10-26T09:00:00Z",
  "updatedAt": "2026-10-26T09:01:30Z"
}
```

Memory stored after Mission 1 feedback (writeStatus `stored`):

```json
{
  "id": "mem_014",
  "companyId": "co_aquahab_hq",
  "ownerType": "agent",
  "ownerId": "researcher_01",
  "scope": "agent",
  "type": "feedback",
  "content": "CEO wants concise, cited market briefs with no hype.",
  "sourceMissionId": "m_001",
  "sourceTaskId": "t_004",
  "confidence": 0.9,
  "walrusJobId": "job_8f2a",
  "walrusBlobId": "blob_9c71",
  "writeStatus": "stored",
  "createdAt": "2026-10-26T09:03:10Z",
  "storedAt": "2026-10-26T09:03:58Z"
}
```

---

## 9. Open Items

| # | Item | Resolution |
|---|---|---|
| D1 | Exact fields of `remember` / `recall` payloads in the Walrus SDK | Confirm in the Walrus Memory API reference (Day 1). `scope`, `ownerId`, and `type` are passed inside the memory payload until the SDK's native fields are confirmed. |
| D2 | Whether `memoryNamespace` maps to a native SDK namespace | Confirm via `health` and the API reference on Day 2 |
| D3 | `confidence` source | For MVP, the LLM extraction step proposes it and the CEO can edit it at confirm time. Default 0.9 for CEO-confirmed feedback. |
| D4 | Epoch length and duration | The relayer chooses epochs: default 3 (mainnet) or 5 (testnet), cap 15 when self-hosted. Repo and docs disagree (F13). Measure with `listMemories` on Day 2 (PRD A12). No epochs option on `remember`. |
| D5 | Quota fields | Cost in WAL is not published for the hosted relayer. Track `blobSizeBytes` and memory count per namespace. Quota comes from the relayer (1 GB per account in self-host defaults; hosted limits unconfirmed, PRD A13). |
| D6 | Renewal | `renewalState` is `unsupported` until the rewrite path passes the Day 2 spike. `extend_blob` is post-MVP and needs A11. |

## 10. Lifecycle, Cost, Ownership (S+)

**Lifecycle.** `lifecycle` is separate from `writeStatus`. A memory is `stored` (write) and `active` (lifecycle) at the same time once it is written. Transitions are in `SYSTEM_DESIGN.md` §5.4. Expired and renewal-required memories are excluded from recall, and never hidden from the Vault.

**Quota (replaces cost in WAL).** Per company: memory count and total `blobSizeBytes` for non-forgotten memories, read from `listNamespaces` (`memory_count`, `storage_used`). The operator account's quota is shared by all companies. Rate-limit points (remember 5, analyze 10, recall 1, restore 3, ask 2) are tracked per delegate key. Demo accounts have a per-session memory cap, checked before any `remember` call.

**Renewal.** `RenewalStrategy` has two values. MVP uses `rewrite`: when a memory is `expiring_soon`, the server recalls its text and calls `remember` again with `renewedFromId` set. The old memory is marked `superseded` in the index and dropped from recall once the new one is `stored`. `extend_blob` is for self-hosted scale only.

**Ownership (custodial).** The blobs belong to `Company.operatorAccountId`, the Aquahab operator account. The delegate key that writes them stays on the server. Space key = `operatorAccountId` + `namespacePrefix` + scope. Agents are namespaces inside the company and own no memories. Namespace isolation is enforced in the app, not by Walrus.

**Forget.** Sets `forgottenAt`. Lifecycle stays one of the four states (DECISIONS.md §2). The memory leaves the Vault list and is not renewed. The blob persists until its paid epochs end. The UI says so.
