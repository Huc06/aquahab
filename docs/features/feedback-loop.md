# Feature Spec — Feedback Loop (F4)

**Phase 1 (MVP).** v1.0 aligned to RESHADED §A (`POST /api/tasks/:taskId/feedback`), §S (Feedback entity and memory rules), and §Demo Script.
Companion: `PRD.md` §8 (US-05, US-06, US-07, US-08, US-14), `SYSTEM_DESIGN.md` §5.1, §7.c, `API_DESIGN.md` §4–§5, `DATA_MODEL.md` §3–§5.

## Purpose

This is where the CEO teaches the company. The CEO reviews an output, rates it, explains what to do differently, and chooses which lessons become company memory for as long as their storage is paid. This feature creates the "memory stored" moment in the demo. It is also the main safeguard against bad memory, because Walrus storage is append-only.

## User Flow

1. From the Desk panel or Mission Board, CEO presses **Review** on a task in `review`.
2. Review panel: the output on the left, the memories that were recalled for this task on the right.
3. CEO picks a rating:
   - **Positive**: the output works. Memory candidates are optional.
   - **Neutral**: acceptable but needs adjustment. A comment is required.
   - **Negative**: the output misses. A comment is required.
4. CEO writes a comment. Optionally, a **corrective instruction**: what the agent should do differently next time.
5. Press **Propose memories**. `POST /api/tasks/:taskId/feedback` returns 1–5 candidates. Each has a type, scope, owner, and confidence, and is editable.
6. CEO keeps, edits, or drops each candidate. Nothing is stored yet.
7. Press **File to Walrus**. Each kept candidate is sent with `POST /api/memory/remember`, one per candidate. Each shows `queued`, then `pending`, then `stored` with its blob id.
8. Positive feedback with no kept candidates is valid. Nothing is written.
9. After filing, the next mission uses the new memories. A re-run of the same task is optional and is not required for the demo.

## UI States

| State | What the CEO sees |
|---|---|
| Ready | Output and recalled memories visible; rating buttons enabled |
| Rating chosen, no comment | Comment field marked required for neutral or negative |
| Proposing | "Reading your feedback…" |
| Candidates ready | Candidate cards: editable text, type selector, scope selector, confidence, Keep/Drop toggle; counter "2 of 3 kept" |
| Candidate blocked | Card reads "Removed a credential-like line. Edit to continue." with the text replaced by `[removed]` |
| Filing | Button disabled; each card shows `queued`, then `pending` |
| Stored | Card shows `stored` and the blob id (shortened, copy) |
| Failed | Card shows "Memory not saved", error, and Retry |
| Duplicate found | "A similar memory already exists in this scope." Choices: Keep existing, Supersede, Store anyway |
| No candidates | "Nothing to remember from this review. That is fine." |
| Walrus offline | Filing disabled, with reason from the `health` status |

## Data Requirements

- **Reads:** the task output, the `RecallEvent` for the task, existing memories in the same scope (for the duplicate check), the vault status (polled every 2 s while filing).
- **Writes:** `POST /api/tasks/:taskId/feedback` (creates `Feedback`, returns candidates), `POST /api/memory/remember` (one per kept candidate), `POST /api/memory/:memoryId/retry`.
- **Entities:** `Feedback` (`rating`, `comment`, `correctiveInstruction`), `AquahabMemory` (`type`, `scope`, `ownerType`, `ownerId`, `content`, `confidence`, `sourceMissionId`, `sourceTaskId`, `writeStatus`).
- **Candidate rules:** 1–5 per feedback. Type and scope follow `DATA_MODEL.md` §3.1:

| Feedback content | `type` | `scope` | Owner |
|---|---|---|---|
| Preference ("concise, with citations") | `preference` | `agent` or `company` | agent or company |
| Corrective instruction | `feedback` | `agent` | agent |
| Strategic direction ("Vietnam first") | `decision` | `company` | company |
| Result of the task | `outcome`: **not proposed here.** Auto-saved after validation (`DECISIONS.md` §3.1) | — | — |

- **Confidence:** proposed by the extraction step. Default 0.9 for CEO-confirmed items. The CEO can edit it.

## Walrus Memory Usage

| Step | Method | Trigger |
|---|---|---|
| Kept candidate is filed | `remember` | CEO presses File to Walrus, once per candidate |
| Write settles | `waitForRememberJob` | Background, after `remember` returns a job id |
| Retry | `waitForRememberJob` with the existing job id | CEO presses Retry on a failed memory |
| Next mission uses it | `recall` | Next mission's task start (runtime, not this panel) |

Rules for the demo:

- Candidate extraction is an LLM step on the server. It produces text only and does not call Walrus.
- Redaction and policy run before candidates are shown, and again before `remember`.
- A dropped candidate is never sent to Walrus and is not kept anywhere.
- The UI never says "stored" before `waitForRememberJob` returns a blob id.

## Acceptance Criteria

- [ ] AC-FL-01: Neutral and negative require a comment; positive does not.
- [ ] AC-FL-02: Proposing returns 1–5 candidates, each with type, scope, owner, and confidence.
- [ ] AC-FL-03: No `remember` call happens before the CEO files. A test confirms that proposing makes zero Walrus calls.
- [ ] AC-FL-04: Dropped candidates are not sent and do not appear in the Vault.
- [ ] AC-FL-05: An edited candidate stores the edited text, not the original.
- [ ] AC-FL-06: Each filed candidate goes `queued` → `pending` → `stored`. `stored` appears only after `waitForRememberJob` resolves with a blob id.
- [ ] AC-FL-07: A credential pasted into a comment or corrective instruction is blocked. The line becomes `[removed]` in the candidate. The secret is absent from the database, Vault, responses, and logs (scripted test).
- [ ] AC-FL-08: A failed write shows "Memory not saved" and Retry. Retry settles the same job id and never creates a second memory.
- [ ] AC-FL-09: A near-identical memory in the same scope triggers the duplicate prompt. Filing it returns 409 unless the CEO picks Store anyway or Supersede.
- [ ] AC-FL-10: After filing in the demo, Mission 2's recall for the same company returns the stored memories when they match the query (the link the demo depends on).
- [ ] AC-FL-11: The Review panel shows the recalled memories for the reviewed task, so the CEO can see what the agent already knew before judging the output.
- [ ] AC-FL-12 (S+): A candidate with an obvious personal identifier (email, phone, ID number, home address) shows "Contains a personal identifier. Keep it only if you choose to." It is not kept by default. Keeping it requires an explicit toggle.
- [ ] AC-FL-13 (S+): Filing is blocked with "Memory is off or capped for this demo" when the spending cap or session cap is reached (HTTP 429). No candidate is written.
- [ ] AC-FL-14 (S+): Each filed candidate records `isEncrypted = true`. A test confirms the upload payload is ciphertext, not plaintext.
- [ ] AC-FL-15 (S+): The UI states that memory is encrypted and that the blob ID is public, at the point of filing. The text appears once per session, not on every card.
- [ ] AC-FL-17 (DECISIONS §3): Only `preference`, `feedback`, and `decision` candidates are proposed here, and each needs CEO approval. Outcome memories never appear in this panel. A test confirms that a task's outcome is written by the orchestrator with `approvedBy: "auto_validated"`, and never before validation passes.
- [ ] AC-FL-16 (S+ v1.1): Each candidate card shows the retention window it will get ("Kept about N days, renewable from the Vault"). The window is read from the relayer's default, not a fixed promise (A12).
