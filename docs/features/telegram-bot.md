# Feature Spec — Telegram bot (Phase 1, MVP)

**Phase 1 (MVP).** One CEO per deployment (DECISIONS §11.10). Sources: `DECISIONS.md` §11.2 (quick capture prefixes, briefs at the CEO's time), §11.10 (one CEO, writes from the `/web` link).
Code: `server/src/telegram.ts`. Tests: `server/test/telegram-*.test.ts`.

## Purpose

The CEO runs the crew from a phone: create a room for a project, capture a note in one line, read the morning brief, answer the evening debrief. Every screen must be usable without knowing a command syntax.

## Principles

1. **Buttons first, typed syntax second.** Every action a CEO can take has a button. Typed commands and prefixes stay as shortcuts and are listed in `/help`.
2. **One place per fact.** The capture prefixes and commands come from one list (`CAPTURE_TYPES`, `helpHtml()`). Menu, help and onboarding must not drift apart.
3. **Ask one thing per message.** A step asks one question and offers a skip or default button where a sensible default exists.
4. **Steps that have passed fail politely.** A stale button says so and offers a way back to the menu.

## Screens and states

| Screen | Entry | Buttons | Next |
|---|---|---|---|
| Onboarding | First `/start` or `/menu` before "Got it" | ＋ Create my first room, ✎ Try a capture, Got it | Menu |
| Menu | `/menu`, Refresh, Got it | Office, Rooms, ＋ New room, Capture, Ask, Brief, Debrief, Memories, Crew, Times, How to use | Each action |
| Help | `/help`, How to use | Back to menu | Menu |
| New room · name | ＋ New room | Typed name | New room · goal |
| New room · goal | After name | Skip goal, or typed goal | New room · times |
| New room · times | After goal | Use default 08:30 · 21:00, or typed `HH:MM HH:MM` and optional `private` | Room opens, day-one brief |
| Times picker | ⏰ Times, `/times` with no arguments | 08:30 · 21:00, 07:45 · 20:30, 09:00 · 22:00, Type my own | Confirmation for the active room |
| Times typed | Type my own | Typed `HH:MM [HH:MM]` | Confirmation |
| Capture | ✎ Capture | One button per prefix | Typed note goes to the active room |

## Rules

- **Default times** are 08:30 (brief) and 21:00 (debrief), set in `createRoom`. The first preset and the wizard default must use the same values.
- **Times are 24-hour `HH:MM`.** Invalid input gets the same message in every place, and the pending step stays open.
- **`private`** hides the room name on-chain. It is typed, not a button, and the times prompt says so.
- **Prefixes** `d: f: n: done: l: due: s: p:` file directly. A typed prefix works the same as the capture button.
- **Pending input** lives in the `telegram.await` setting. The next plain-text message clears it. A slash command does not clear it. A new button press replaces it.
- **Commands** shown to Telegram (`setMyCommands`): brief, debrief, rooms, new, ask, memories, crew, times, skip, web, menu, help. `/room` still works as an undocumented alias of `/rooms`.

## Out of scope for this spec

- Renaming a room, editing its goal, or archiving it. Planned for a later pass (see Known gaps).
- Per-room timezone. Times use the room's timezone as stored.

## Known gaps

- The wizard and times picker are not yet exercised against the live Telegram API. Unit tests cover the parser and callback format only.
- A pending step that the CEO abandons stays open until the next plain-text message. There is no cancel button yet.
- Any error that escapes a handler shows one generic message ("Something went wrong on our side"), with no next step.

## Acceptance

- A CEO with no command knowledge can create a room with a goal and custom times in under four taps plus typing.
- Every button callback is at most 64 bytes and maps to a known menu action (`telegram-menu.test.ts`).
- `/help`, the menu and onboarding list the same capture prefixes (`telegram-wizard.test.ts`).
