# Feature Spec — Onboarding (F0, S+ v1.1)

**Phase 1 (MVP).** Custodial model. Sources: `RESHADED_RE_SCAFFOLD_V2.md` §Onboarding Flow, plan D1, MemWal research F1–F2, F10.
Companion: `PRD.md` §7.5, §8 (US-21), `API_DESIGN.md` (`POST /api/companies`), `SYSTEM_DESIGN.md` §10.1.

## Purpose

Take a new CEO from zero to a stored memory and a memory-aware repeat mission in minutes, without asking them to connect a wallet. Aquahab holds the operator account and delegate key on the server. The CEO gets a company and a namespace. The first 60 seconds are what judges see.

## User Flow

| Step | Screen | What happens | Backend |
|---|---|---|---|
| 1 | Start demo CEO session | Demo CEO session only. No wallet, and no Google sign-in via Enoki zkLogin (both Phase 2, DECISIONS §8). Disclosure shown before any data is written. | `POST /api/session` (demo identity, no wallet) |
| 2 | Name company | CEO names the company | `POST /api/companies` creates company, namespace prefix `aquahab:{companyId}`, quota row |
| 3 | Review the five agents | The five fixed agents (One, Researcher, Builder, Lofi, Hippo) are shown with default budgets from config. The CEO may adjust strategy and budget now or later. No arbitrary creation (DECISIONS §6). Agents are namespaces inside the company. | Same request as step 2 |
| 4 | Assign first mission | Pre-filled: "Plan a Sui wallet launch for Vietnam." CEO presses Assign. | `POST /api/missions` |
| 5 | Watch agents recall or create memory | Desks animate. Researcher shows "Recalled 0 memories" on a fresh company. | Polling |
| 6 | Give feedback | Rating and comment. Candidates appear, each with its retention window. | `POST /api/tasks/:taskId/feedback` |
| 7 | See first memory in the Vault | Confirm and file. `queued` → `pending` → `stored` with blob ID. Shows expiry date and quota used. | `POST /api/memory/remember`, settle |
| 8 | Run the same mission type again | Same template, similar brief, memory on | `POST /api/missions` |
| 9 | See improved, memory-aware output | Recall chip shows stored memories; output reflects them | Polling |

## Disclosure (required at step 1, before any data is written)

Plain words, shown once, acknowledged by the CEO and stored with the company record (not in Walrus):

- Aquahab stores your company memory in an operator account it runs. You do not hold that account's keys.
- Memory is encrypted before it reaches Walrus. Our relayer processes plaintext during writes and recalls, so the relayer can see it.
- Your memories last for a fixed number of Walrus epochs. Renewal is your decision, and you see every expiry date. An expired memory cannot be recovered.
- Forgetting a memory removes it from your Vault and stops renewal. It does not erase the blob before its paid epochs end.
- Namespaces separate your company's memory, but they are not a security boundary against other users of the same operator account. Aquahab enforces the boundary in the app.

## Targets

| Milestone | Target | Measured from |
|---|---|---|
| Time to first mission | Under 60 seconds | Landing on step 1 (demo CEO) |
| Time to first stored memory | Under 2 minutes | Landing on step 1 |
| Time to first memory-aware repeat mission | Under 5 minutes | Landing on step 1 |

The onboarding timer is logged per step, so the targets can be checked in the demo rehearsal.

## UI States

| State | What the CEO sees |
|---|---|
| Step 1, before disclosure | Disclosure card with an "I understand" checkbox. Continue is disabled until checked. |
| Step 1, acknowledged | "Signed in as demo CEO" with a company name field next. |
| Session expired | "Sign in again to continue. Your memory is safe." Progress resumes from backend state. |
| Step 2–3 | Form with company name and starter agent checklist |
| Step 4–7 | Shared with the normal Mission Board, Feedback Loop, and Vault. Progress rail: "Step 4 of 9". |
| Step 7 retention note | "This memory is kept until {date} (about {N} epochs). You can renew it from the Vault." |
| Step 8–9 | Same as the demo flow. Banner: "This is the same mission type. Memory is now involved." |
| Done | Summary: time to first mission, first stored memory, repeat mission. Quota used. |

## Walrus Memory Usage

- The company's memory lives under the operator account (one `MemWalAccount` and one delegate key, held server-side). Each company gets a namespace prefix `aquahab:{companyId}`, with scope and id appended (`company`, `project:{id}`, `agent:{id}`).
- Step 7 is the first `remember` call for the company. It follows the Feedback Loop rules: confirm, `remember`, then `waitForRememberJob`. The relayer chooses the epoch count (default 3 on mainnet, 5 on testnet; to be measured, plan spike). No epochs option is sent.
- Step 8 relies on `recall` returning the step 7 memory. This is the same check as AC-FL-10.
- No onboarding step calls `analyze` or `ask`.

## Acceptance Criteria

- [ ] AC-OB-01: The disclosure is shown and acknowledged before any company record is written.
- [ ] AC-OB-02: No Walrus call happens before step 7.
- [ ] AC-OB-03: The company's namespace prefix is unique per company, and no company can read another company's namespace through the API (server test).
- [ ] AC-OB-04: The guided mission "Plan a Sui wallet launch for Vietnam." is pre-filled and assignable in one click.
- [ ] AC-OB-05: Time to first mission is under 60 seconds in three rehearsals on the demo network.
- [ ] AC-OB-06: Time to first stored memory is under 2 minutes in three rehearsals.
- [ ] AC-OB-07: Time to first memory-aware repeat mission is under 5 minutes in three rehearsals.
- [ ] AC-OB-08: On step 8, the recall event contains the step 7 memory. Otherwise onboarding shows "Memory not found for this repeat. Check the Vault." and does not claim success.
- [ ] AC-OB-09: A refresh at any step resumes at the same step, from backend state.
- [ ] AC-OB-10: Step 7 never claims "stored" before `waitForRememberJob` returns a blob ID.
- [ ] AC-OB-11: Step 7 shows the expiry date and the quota used, read from the Walrus status after the write settles.
