# Aquahab

A 3D habitat where a CEO runs a company of AI agents that remember missions, preferences, feedback, and decisions.

Phase 1 (MVP): one private HQ, demo CEO session, operator-managed Walrus Memory, on-mission agents, manual renewal.

## For judges (Total Recall, Track 02)

- **Live office:** https://aquahab.up.railway.app. Reads are public. Open the office, then look at the Vault and a brief line: each memory has a receipt (Walrus blob ID, Sui object, checkpoint).
- **Live proof:** `/api/proof` compares the memories on the relayer with the Blob objects on Sui. `/api/crew` reads the crew from Sui through Tatum.
- **Hackathon entry:** `docs/TOTAL_RECALL.md` maps every judging criterion to where it is shown.
- **Run it without keys:** `cd server && pnpm install && pnpm dev:mock`, then `cd web && pnpm dev`, open http://localhost:3000. This uses an in-memory Walrus mock and does not write to mainnet.
- **Run against mainnet:** see `server/README.md`. The CEO works from Telegram; `/brief`, `/compare` and `/menu` are the commands to try.

## Where things are

| Path | What it is | Read it when |
|---|---|---|
| `CLAUDE.md` | Working rules for Claude Code | Always first |
| `DESIGN.md` | Design system: colors, type, layout, components, motion, copy. Read by OpenDesign and Claude Code. | Any UI work |
| `web/` | Frontend app (Next.js, TypeScript, Tailwind, React Three Fiber). Run with `pnpm dev` inside `web/`. | Building UI |
| `server/` | Crew server: Walrus Memory (mainnet), Sui via Tatum, LLM, Telegram, scheduler. API contract in `server/src/contract.ts`. See `server/README.md`. | Building services, routes |
| `docs/source/` | Source documents: product concept, RESHADED V1–V3, research notes | Starting point, or when a decision is unclear |
| `docs/product/PRD.md` | Product requirements, MVP scope, user stories, demo criteria | Scope questions |
| `docs/product/DECISIONS.md` | Accepted decisions. Overrides earlier drafts (latest section wins). | Any conflict between documents |
| `docs/architecture/` | `SYSTEM_DESIGN.md`, `DATA_MODEL.md`, `API_DESIGN.md` | Building services, models, routes |
| `docs/features/` | One spec per feature: mission board, agent desk, Memory Vault, feedback loop, briefing, onboarding, agent governance, HQ scene | Building a feature |
| `docs/research/` | `RESEARCH_TATUM.md` (Tatum AI Builder, Sui gRPC), `RESEARCH_LLM_AUTH.md` (LLM auth options) | Integration questions |
| `docs/TOTAL_RECALL.md` | The hackathon entry: what was built, how Tatum and Walrus are used, live mainnet evidence, judging criteria → where to look | Judging, the blog, the video |
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
