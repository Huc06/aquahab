# CLAUDE.md

## Project

Aquahab is a 3D habitat where a CEO runs a company of AI agents that
remember missions, preferences, feedback, and decisions.

Project map: see `README.md`.

## Current Workflow

1. First, complete the user's current requested task.

2. After completing it, read these files before making further product,
   architecture, API, or implementation changes:

   - `docs/source/PRODUCT_CONCEPT`
   - `docs/source/RESHADED_RE_SCAFFOLD_V1.md`
   - `docs/source/RESHADED_RE_SCAFFOLD_V2.md` (S+ lifecycle, privacy, ownership)
   - `docs/source/RESHADED_RE_SCAFFOLD_V3.md` (agent funding and permissions)
   - `docs/source/RESEARCH.md`

3. Use those documents as the source of truth. Where they conflict,
   `docs/product/DECISIONS.md` (latest section) overrides them.

4. Do not change the product concept, MVP scope, or memory model unless
   the user explicitly asks.

## Implementation Rules

- MVP is Phase 1 only: private Aquahab HQ.
- Aqua City multiplayer is Phase 2 and must not be implemented now.
- Use Walrus Memory for persistent agent/project/company memory.
- Use official Walrus Memory methods:
  remember, waitForRememberJob, recall, analyze, ask, restore, health.
- Do not invent Walrus or Tatum APIs.
- Do not store ephemeral player position or chat in Walrus Memory.
- Memory must be recalled before an agent works on a task.
- CEO feedback must create a memory.
- The key demo is the same mission type before and after memory exists.

## Documentation Order

When asked to scaffold, design, or implement:

1. Read `docs/source/PRODUCT_CONCEPT`.
2. Read `docs/source/RESHADED_RE_SCAFFOLD_V1.md`, then V2 and V3.
3. Read `docs/source/RESEARCH.md`.
4. Update or create:
   - `docs/product/PRD.md`
   - `docs/architecture/SYSTEM_DESIGN.md`
   - `docs/architecture/DATA_MODEL.md`
   - `docs/architecture/API_DESIGN.md`
   - `docs/features/` (one spec per feature)
   - `DESIGN.md` (design system, root level, read by OpenDesign and Claude Code)
5. Only then modify application code.
