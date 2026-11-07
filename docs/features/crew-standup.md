# Feature Spec — Crew standup (Phase 1, MVP)

**Phase 1 (MVP).** The crew members talk to each other about one room, from its memories. Sources: `DECISIONS.md` §11 (receipts on every line, one namespace per room), the HQ small talk from #18.
Code: `server/src/standup.ts`, `crewStandup` in `server/src/llm.ts`, `web/src/lib/banter.ts`. Tests: `server/test/standup.test.ts`, `server/test/llm-path.test.ts`.

## Purpose

Before #18 the office showed small talk only: twelve fixed lines, flavour with no facts. The standup is the real thing. After the morning brief, the crew talks the room over: One opens with the most important next step, and the others answer with what shipped, what broke, what is due and what the story is. Each turn cites the Walrus blobs it rests on, so the office conversation is grounded in memory like the brief.

## Rules

1. **Recall first.** One recall of the room, newest first (`purpose: "standup"`, so the cited objects glow through `recall.used`).
2. **Who speaks.** One runs it. Every other member joins only when the room has memories of its own types (`DOMAIN`). Fewer than two members means no standup (409 on demand).
3. **Receipts or it didn't happen.** A turn whose cites are not in the recall is dropped. A turn must cite at least one memory of the speaker's own types. One may also cite a done memory, to say a next step is closed, but never a failure alone: that is history turned into a task ("run the missed brief"), and the failure is Builder's to report. A turn that answers someone who is not in the standup, or answers itself, becomes a turn to the whole crew. Memory codes the model writes into the text (`(m1)`) are removed.
4. **Short.** 2 to 8 turns, as few as the memories need, about 25 words each (300 characters kept).
5. **Open means open.** One opens with the most important next step that no done memory has closed. When none is open, One says so and leaves the next step to the CEO. A question is asked only when a memory answers it. The morning brief follows the same rule for One's section.
6. **No new memory.** The standup is kept in the ledger (`standups` table), never on Walrus: it is a conversation about memories, not a memory. Committing anything still goes through `/capture`.
7. **Never padded.** Without a model, or when fewer than two of the model's turns pass the checks, each member reads out its newest memory unchanged (`source: "fallback"`).

## When it runs

- After the morning brief, in the same scheduler tick. A failed standup is logged in the tick's errors and never fails the brief.
- On demand: `POST /api/rooms/:id/standup` (CEO). `GET /api/rooms/:id/standup/latest` is public, like the brief.
- `standup.created` on `/api/events` tells an open office to load it.

## In the office

`useBanter(roomId)` plays the room's latest standup on a loop, one turn every 7 s, under the speaker's name. A turn that answers another member starts with `@Name`. Until the room has a standup (404), the office keeps the small talk. Each line carries its `cites`, ready for the receipt popover (#17).

## Acceptance

- [x] AC-SU-01: Every turn cites at least one blob of the room; a made-up code never reaches the client.
- [x] AC-SU-02: A member never states facts outside its domain (One excepted).
- [x] AC-SU-03: Holding a standup files no memory job.
- [x] AC-SU-04: The morning tick holds the standup after the brief.
- [x] AC-SU-05: The office shows the standup when there is one, the small talk otherwise.
- [x] AC-SU-06: One never opens with a next step a done memory closed, and never turns a failure alone into a task (server check on the turn; prompt checked live on 7 Nov: 5 runs on the `aquahab` room, none stale).
