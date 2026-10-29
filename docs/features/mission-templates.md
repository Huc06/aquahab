# Mission Templates (MVP, v1)

| Field | Value |
|---|---|
| Status | Draft v1. Replaces the T1–T6 list in `docs/product/PRD.md` §7.3. |
| Date | 2026-10-29 |
| Context | Builders on Sui, in three groups: Technical & Product, Growth & Community, Business & Operations. One HQ serves all three. |
| Rule | Every template runs on mission only. No scheduler in MVP (`docs/product/DECISIONS.md` §3). Recurring runs are started by the CEO. |

Each template states: lead agent, supporting agents, inputs, output sections, memory it reads, and memory it may propose. Proposed memory follows the approval rules in `DECISIONS.md` §3: preference, feedback, and decision need CEO approval. Outcome memory is saved automatically after validation.

Output sections are the output contract for the template. A run fails validation if a section is missing.

---

## Technical & Product

### T1. Release checklist

| | |
|---|---|
| Lead | Builder |
| Supporting | Researcher (checks docs and SDK versions), Hippo (estimates infra and gas cost) |
| Inputs | Release name, target date, list of changes, network (testnet or mainnet) |
| Output sections | Checklist (owner, status per item), Risks, Docs to update (each with source trust score), Estimated cost |
| Memory read | Stack and version constraints, sources the CEO trusts, past release outcomes |
| Memory proposed | Decision: "Ship on testnet first" if the CEO chooses it. Feedback: missed checklist items. |
| Before / after | Without memory: generic checklist. With memory: the checklist includes the CEO's known risks and uses only trusted docs. |

### T2. Protocol and SDK research brief

| | |
|---|---|
| Lead | Researcher |
| Supporting | Builder (checks code-level claims) |
| Inputs | Topic (for example "Walrus storage epochs"), depth (short, full), any sources the CEO wants included |
| Output sections | Findings (each with source and trust score), Sources excluded and why, Open questions |
| Memory read | Source trust rules (for example "official docs over blog posts"), exclusion rules (for example "sources older than 12 months"), topics already covered |
| Memory proposed | Preference: a new source rule from the CEO's feedback. Feedback: a source that was wrong. |
| Before / after | Without memory: mixed sources, no trust scores. With memory: official docs first, old sources excluded, and each source carries a score. |

---

## Growth & Community

### T3. Weekly content plan

| | |
|---|---|
| Lead | Lofi |
| Supporting | One (sets the week's priorities from the CEO's notes) |
| Inputs | Week, product news, target audience, any links to include |
| Output sections | Three posts (angle, draft, call to action, link to docs), Replies to watch, Notes for the CEO |
| Memory read | Tone rules (for example "short, no hype"), links that must appear, banned phrases |
| Memory proposed | Preference: a tone rule. Feedback: a post the CEO rejected and why. |
| Before / after | Without memory: generic posts with buzzwords. With memory: short posts with the required links and no banned phrases. |

### T4. Ecosystem opportunities scan

| | |
|---|---|
| Lead | Researcher |
| Supporting | One (ranks by the CEO's priorities) |
| Inputs | Time window, categories (hackathons, grants, events, partner programs), region if the CEO wants one |
| Output sections | Opportunities table (name, deadline, fit with the team, source and trust score), Excluded items and why, Recommended next step |
| Memory read | Categories the CEO cares about, deadline rules, sources already trusted |
| Memory proposed | Decision: "Apply to grants under 5,000 USD only." Feedback: an opportunity that was a poor fit. |
| Before / after | Without memory: a long list with no deadlines checked. With memory: fewer items, each with a deadline and a score, filtered by the CEO's rules. |

---

## Business & Operations

### T5. Monthly budget review

| | |
|---|---|
| Lead | Hippo |
| Supporting | One (applies escalation rules) |
| Inputs | Month, spend entries (category, amount in USD, date), budget per category |
| Output sections | Spend by category, Items above threshold (needs CEO approval), Escalations, Next month's cap |
| Memory read | Approval threshold (for example "spend over 50 USD needs approval"), category budgets, invoice rules |
| Memory proposed | Decision: a new approval threshold. Feedback: a spend that was wrongly flagged. |
| Before / after | Without memory: a flat list of spend. With memory: items above the approval threshold are flagged, and escalations follow the CEO's rules. |

### T6. Partner outreach draft

| | |
|---|---|
| Lead | Lofi |
| Supporting | Researcher (builds the target list with sources), One (applies escalation rules for replies) |
| Inputs | Partner type (for example "wallet provider", "indexer", "community host"), goal, what the CEO can offer |
| Output sections | Target list (name, source, trust score), Draft email, Reply rules (what to escalate to the CEO and what One can answer), Open questions |
| Memory read | Tone for partner emails, what the team can and cannot offer, escalation rules, targets already contacted |
| Memory proposed | Preference: an email tone rule. Decision: a partner the CEO will not contact. |
| Before / after | Without memory: generic outreach to unverified targets. With memory: verified targets only, and the escalation rules are applied to the draft. |

---

## Track fit

Each group shows the portable-memory story:
- Technical & Product (T1, T2): source trust and version constraints carry across sessions.
- Growth & Community (T3, T4): tone rules and deadline rules carry across weeks.
- Business & Operations (T5, T6): approval thresholds and escalation rules carry across months.

Recurring runs (weekly, monthly) are started by the CEO. In the demo, one run per group is enough to show the before/after.

## Demo selection

The demo runs one template end-to-end, then shows the other templates in the template list. Recommended demo: T2 (Protocol and SDK research brief), because source trust scores are the clearest before/after. The CEO can change this choice.

## Open items

| # | Item | Owner |
|---|---|---|
| M1 | Confirm the six templates and the demo template | Product owner |
| M2 | Confirm which agent each template uses as lead (the table above) | Product owner |
| M3 | Define the validation check for each output section (used by outcome auto-save in `DECISIONS.md` §3.1) | Engineering |
