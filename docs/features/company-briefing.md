# Feature Spec — Company Briefing (F5)

**Phase 1 (MVP), simple version.** v1.1: briefing reads memory with `recall` and summarizes with LLM. `analyze` is not used (it extracts and writes facts; S+ v1.1 and MemWal SDK reference).
Companion: `PRD.md` §8 (US-11), `SYSTEM_DESIGN.md` §8.2, `API_DESIGN.md` §7.

## Purpose

One, the Chief of Staff, tells the CEO where the company stands: what is in motion, what was decided, what is at risk, and what was learned recently. It turns memory and mission outcomes into a short read where every claim links back to memory.

## User Flow

1. CEO clicks One at the central desk, or opens **Briefing** from the top bar.
2. Briefing panel loads with four sections:
   - **Active missions**: missions in `active` or `review`, with status.
   - **Recent decisions**: `decision` memories across the company's namespaces.
   - **Open risks**: `outcome` and `feedback` memories that mention an unresolved issue.
   - **Memory added this week**: memories stored in the last 7 days.
3. Each decision and risk line has a memory chip. Clicking it opens the memory in the Vault.
4. Memories that are `expiring_soon` or `renewal_required` are counted in a banner that links to renewal.
5. CEO presses **Refresh**. The previous briefing stays visible until the new one arrives.

## UI States

| State | What the CEO sees |
|---|---|
| Empty company | "No missions or memories yet. Run a mission to start the briefing." |
| Generating | Skeleton of four sections with "One is writing the briefing…" |
| Ready | Four sections with memory chips |
| Empty section | "Nothing recorded yet." No invented content. |
| Refreshing | Previous briefing visible with "Updating" badge |
| Error | "The briefing could not be generated. Last briefing shown." with timestamp |
| Recall-only | Banner: "Summary generated from memory text without the AI summary. Check the sources." |
| Memory offline | Banner: "Memory is offline. Showing last briefing." |
| Expiring memory | Banner: "N memories expire within 14 days. Renew them." |

## Data Requirements

- **Reads:** `GET /api/briefing?companyId=`. Input: `recall` results across the company's namespaces (`aquahab:{companyId}:company`, `:project:*`, `:agent:*`), sorted by recent. Only memories with `lifecycle` `active` or `expiring_soon` are used. Mission outcomes come from the mission and task records.
- **Limits:** up to 20 recalled memories and 10 missions as input. Output: at most 3 items per section.
- **Response shape:**

```ts
interface Briefing {
  companyId: string;
  generatedAt: string;
  source: "recall+llm" | "recall-only";
  sections: {
    activeMissions: { missionId: string; title: string; status: MissionStatus }[];
    recentDecisions: { text: string; memoryId: string }[];
    openRisks: { text: string; memoryId: string }[];
    memoryAddedThisWeek: { memoryId: string; text: string; storedAt: string }[];
  };
  expiringCount: number;    // memories in expiring_soon or renewal_required
  excludedPending: number;  // memories not yet stored, excluded from the briefing
}
```

## Walrus Memory Usage

- **`recall`** is the only Walrus call. The briefing runs one `recall` per namespace group, with `sort: "recent"` and a limit of 20. Results carry `blob_id` and `created_at`, so "added this week" is computed from them.
- **LLM** writes the four sections from those recall results. Every item keeps the `blob_id` of the memory it came from, so the chips work. If the model drops an ID, the item is removed rather than shown without a source.
- **`analyze` is not used.** It extracts facts from text and stores them as memory, so calling it for a briefing would write new memory on every refresh.
- No `remember` call. The briefing is a read.
- Memories that are `queued`, `pending`, or `failed` are excluded. Their count is `excludedPending`.
- `ask` is not used here.

## Acceptance Criteria

- [ ] AC-CB-01: The briefing has exactly four sections in the order listed.
- [ ] AC-CB-02: Every decision and risk item has a memory chip that opens the correct memory in the Vault.
- [ ] AC-CB-03: No item references a memory that is not `stored`, or that is `expired`, `renewal_required`, or `forgotten`.
- [ ] AC-CB-04: An empty section shows "Nothing recorded yet" (tested with an empty-company fixture).
- [ ] AC-CB-05: If `source` is `recall-only`, the banner is visible.
- [ ] AC-CB-06: Refresh keeps the previous briefing visible until the new one is ready.
- [ ] AC-CB-07: After Mission 1 feedback is filed, "Memory added this week" lists those memories with blob IDs that open in the Vault.
- [ ] AC-CB-08: Briefing generation completes within 15 seconds for the demo dataset. Otherwise the previous briefing stays visible and the timing is logged.
- [ ] AC-CB-09: `excludedPending` matches the number of non-stored memories for the company.
- [ ] AC-CB-10: Briefing never calls `analyze` and never writes memory (checked by a test that counts SDK calls during a refresh).
- [ ] AC-CB-11: `expiringCount` matches the number of `expiring_soon` and `renewal_required` memories, and the banner links to the renewal batch.
