# Feature Spec — Memory Vault (F3)

> **Scope note (DECISIONS §8).** Ask the Vault is Phase 2. Every Ask step, Ask state, Ask endpoint, and AC-MV-06 / AC-MV-07 below is out of MVP. Do not build or test them for MVP. The rest of this spec is MVP.

**Phase 1 (MVP).** v1.0 aligned to RESHADED §S and §Aqua Memory Vault (the "distinctive component"), §A.
Companion: `PRD.md` §8 (US-09, US-10, US-13, US-16), `SYSTEM_DESIGN.md` §4.4, §8, `API_DESIGN.md` §5, `DATA_MODEL.md` §3, §5.

## Purpose

The Aqua Memory Vault is the company's persistent, verifiable memory layer. It is not chat history and not a game save. It shows what the company remembers, where each memory is stored on Walrus, how to verify it on Sui, and lets the CEO ask questions of it. It is the proof surface for the demo.

## User Flow

1. CEO clicks the Walrus Keeper or the Vault door in the HQ. The Vault panel opens over the scene.
2. Header shows the Walrus status light from `GET /api/memory/health`.
3. Default view groups memories by scope: **Company**, **Project**, **Agent**, each with a count.
4. Each row shows: memory text, type chip (`preference`, `outcome`, `feedback`, `decision`), confidence, created time, status chip (`queued`, `pending`, `stored`, `failed`), and the blob id once stored.
5. Clicking a row opens its detail: full text, source mission and task, supersession chain, and the **Proof** action.
6. **Proof** shows the Walrus job id, blob id, and the Sui reference read through Tatum. It notes that Walrus records are append-only.
7. The **Ask the Vault** box accepts a question. The answer appears with source memories beneath it.
8. **Correct** opens the text pre-filled with the old content. Saving creates a new memory with `supersedesId` set to the old one. The old one is collapsed under "Replaced by…".

## UI States

| State | What the CEO sees |
|---|---|
| Empty | "The Vault is empty. Confirm a memory from a mission review to file the first one." |
| Populated | Grouped list with counts |
| Filtered | Filter chips for type, scope, status; count updates |
| Queued / pending | Row with `queued` or `pending` chip and "Writing to Walrus…"; no blob id |
| Stored | Row with `stored` chip and shortened blob id with copy button |
| Failed | Row with `failed` chip, "Memory not saved", error text, and Retry |
| Superseded | Old row collapsed, labeled "Replaced by…" with link to the new one |
| Walrus offline | Status light red; list shows last known rows; write actions disabled with reason |
| Ask: loading | "Searching the Vault…" |
| Ask: answered | Answer text and source list; each source opens its detail |
| Ask: no memory | "The Vault has no memory on this. Nothing was guessed." |
| Proof: loading | "Reading Sui through Tatum…" |
| Proof: found | Walrus job id, blob id, Sui reference, timestamp |
| Proof: Sui unavailable | Walrus job id, blob id, and the lookup error with a link to the Walrus record. Never empty. |

## Data Requirements

- **Reads:** `GET /api/memory/vault?companyId=&scope=&ownerId=&type=&writeStatus=`, `GET /api/memory/:memoryId/proof`, `GET /api/memory/health`.
- **Writes:** `POST /api/memory/ask` (no memory write), `POST /api/memory/remember` with `supersedesId` (correction), `POST /api/memory/:memoryId/retry`.
- **Entities:** `AquahabMemory` (`type`, `scope`, `ownerType`, `ownerId`, `content`, `confidence`, `sourceMissionId`, `sourceTaskId`, `walrusJobId`, `walrusBlobId`, `writeStatus`, `supersedesId`, `createdAt`, `storedAt`).
- **Index:** the list comes from the local `memories` table. Status changes arrive by polling every 2 seconds while any memory is `queued` or `pending`.
- **Proof cache:** `suiProofRef` is cached after the first successful lookup.

## Walrus Memory Usage

| Action | Method | Notes |
|---|---|---|
| Correct a memory | `remember` with `supersedesId` | Only after the CEO confirms the corrected text. The old record is never edited. |
| Settle a correction | `waitForRememberJob` | `pending` until a blob id returns |
| Retry a failed write | `waitForRememberJob` with the existing job id | Never a second `remember` |
| Ask the Vault | `ask` | Scoped to the company. Must return sources or an explicit "not found". |
| Walrus status light | `health` | Polled every 30 seconds and at demo preflight |
| Recover an empty index | `restore` | Operator action only, when recall is empty for a company that has memories |
| Proof | Tatum Sui read (not a Walrus SDK method) | Read-only |

Read rule: the Vault shows the content confirmed at the time of writing, from the local index. It does not re-read raw Walrus content on every render.

## Acceptance Criteria

- [ ] AC-MV-01: Memories are grouped by company, project, and agent, with correct counts.
- [ ] AC-MV-02: Each row shows type, confidence, and created time, plus source mission and task.
- [ ] AC-MV-03: A memory without a blob id never shows a blob id and never shows `stored`.
- [ ] AC-MV-04: After `waitForRememberJob` resolves, the row updates to `stored` with the blob id within 2 seconds.
- [ ] AC-MV-05: Retry on a failed memory calls `waitForRememberJob` with the same job id. A test confirms `remember` is not called again.
- [ ] AC-MV-06: Ask the Vault returns a sourced answer for a question covered by a stored memory, and each source is clickable.
- [ ] AC-MV-07: Ask the Vault returns "no memory on this" for an unrelated question in the demo script, and does not produce a general answer.
- [ ] AC-MV-08: Correct creates a new memory with `supersedesId`. The old memory is collapsed and labeled "Replaced by…".
- [ ] AC-MV-09: Proof shows the blob id and Sui reference for at least one stored memory in the demo. If Sui lookup fails, the error and blob id are shown.
- [ ] AC-MV-10: No secret pattern appears in any row, detail, or ask answer (redaction fixture test).
- [ ] AC-MV-11: Recall-based views and the Vault's "current" filter prefer the newest memory in a supersession chain.
- [ ] AC-MV-12: The status light is red when `health` fails, and write actions are disabled with a reason.

## S+ additions (lifecycle, cost, privacy, ownership)

**Lifecycle states shown on each row:**

| Lifecycle | Row shows |
|---|---|
| `active` | "Active · N epochs left" |
| `expiring_soon` | Amber chip "Expires {date}" with a one-tap Renew (rewrite) |
| `renewal_required` | Red chip "Renewal required" with Renew |
| `expired` | Grey row, message "This memory expired because its Walrus storage epoch ended." No renew (the blob is gone). Never hidden. |
| `forgotten` | Not in the list. Visible only in export metadata. |

**Quota (replaces WAL cost, S+ v1.1):** the header shows memory count and bytes used for the company, read from `listNamespaces`, with the session cap and operator quota as a progress bar. No WAL price is shown, because none is published for the hosted relayer.

**Expiring panel:** a section above the list shows memories that are `expiring_soon` or `renewal_required`, sorted by expiry date, with a batch **Renew all** action. Batch renew is `POST /api/memory/renew` with the selected IDs.

**Labels:** every item carries one of three labels. "Encrypted content" for the Seal-encrypted memory. "Public blob metadata" for blob ID, size, and epochs. "Public proof link" for links to Walrus or Sui records. The blob ID is always labeled public.

**Actions:** Renew (when supported), Forget (confirm dialog: "Forgetting stops renewal and removes this memory from the Vault. The blob stays on Walrus until its paid epochs end."), Export metadata, and revoke agent access (when supported, otherwise "App-only: this agent's recall is disabled in the app").

**Acceptance criteria:**

- [ ] AC-MV-13: Every row shows its lifecycle state and remaining epochs. An `expired` memory is visible with its message.
- [ ] AC-MV-14: Recall never returns `expired` or `renewal_required` memories (checked with a fixture that contains each state).
- [ ] AC-MV-15: The quota header matches `listNamespaces` (`memory_count`, `storage_used`). The bar turns red when the session cap or operator quota is reached, and writes are blocked with a clear message.
- [ ] AC-MV-20 (S+ v1.1): Renew (rewrite) writes a new memory with `renewedFromId` set. The old row shows "Superseded" only after the new memory is `stored`. A failed renewal leaves the old row unchanged and shows "Renewal failed" with Retry.
- [ ] AC-MV-22 (DECISIONS §3.1): Auto-saved outcome memories show an "Auto-saved" badge and a link to the validation result. They can be forgotten or superseded like any other memory.
- [ ] AC-MV-21 (S+ v1.1): The expiring panel lists every `expiring_soon` and `renewal_required` memory, sorted by `expires_at`. Batch renew is limited to 20 IDs per request.
- [ ] AC-MV-16: Forget removes the row from the list, sets `forgottenAt`, and shows the confirm message. The UI never says the blob is erased.
- [ ] AC-MV-17: Export produces metadata only. No plaintext appears unless the owner requests content, and that request is logged.
- [ ] AC-MV-18: Revoke is app-level only: it disables an agent's recall and says so ("App-only: this agent's recall is disabled in the app"). It never claims to revoke a Walrus key.
- [ ] AC-MV-19: No row ever shows plaintext content to a viewer who is not the owner (the demo has only the owner session).
