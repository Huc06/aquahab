# Aquahab

A 3D habitat where a CEO runs a company of AI agents that remember missions, preferences, feedback, and decisions.

Phase 1 (MVP): one private HQ, demo CEO session, operator-managed Walrus Memory, on-mission agents, manual renewal.

## Where things are

| Path | What it is | Read it when |
|---|---|---|
| `CLAUDE.md` | Working rules for Claude Code | Always first |
| `DESIGN.md` | Design system: colors, type, layout, components, motion, copy. Read by OpenDesign and Claude Code. | Any UI work |
| `web/` | Frontend app (Next.js, TypeScript, Tailwind, React Three Fiber). Run with `pnpm dev` inside `web/`. | Building UI |
| `docs/source/` | Source documents: product concept, RESHADED V1–V3, research notes | Starting point, or when a decision is unclear |
| `docs/product/PRD.md` | Product requirements, MVP scope, user stories, demo criteria | Scope questions |
| `docs/product/DECISIONS.md` | Accepted decisions. Overrides earlier drafts (latest section wins). | Any conflict between documents |
| `docs/architecture/` | `SYSTEM_DESIGN.md`, `DATA_MODEL.md`, `API_DESIGN.md` | Building services, models, routes |
| `docs/features/` | One spec per feature: mission board, agent desk, Memory Vault, feedback loop, briefing, onboarding, agent governance, HQ scene | Building a feature |
| `docs/research/` | `RESEARCH_TATUM.md` (Tatum AI Builder, Sui gRPC), `RESEARCH_LLM_AUTH.md` (LLM auth options) | Integration questions |
| `docs/design/wireframes/` | Wireframe reference images | Comparing against the design |

## Reading order for a new contributor

1. `docs/source/PRODUCT_CONCEPT`
2. `docs/product/PRD.md`
3. `docs/product/DECISIONS.md` (latest section)
4. `DESIGN.md`
5. `docs/architecture/SYSTEM_DESIGN.md`
6. The feature spec you are working on in `docs/features/`

## Status

- MVP decisions: v2.2 (`docs/product/DECISIONS.md` §8).
- Ask the Vault, Google sign-in via Enoki zkLogin, wallet ownership, scheduled agents, and the Tatum brand palette are Phase 2.
- Tatum brand palette and Poppins are gated on written permission from Tatum. The active palette is the Aquahab deep-sea set in `DESIGN.md` Appendix A.
