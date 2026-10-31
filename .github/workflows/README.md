# Workflows

| Workflow | Purpose | Trigger |
|---|---|---|
| `ci.yml` (CI) | Runs `pnpm check` in `web/` (typecheck, lint, build) when `web/` changes. The `ci` job is the required check. | Pull requests, pushes to `main` |

Run the same checks on a development machine: `cd web && pnpm install && pnpm check`.

## Required check

The branch ruleset for `main` requires the `ci` job from `ci.yml`. The per-area job `web` can be skipped when nothing under `web/` changed. The gate job still reports the result.
