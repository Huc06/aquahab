# Aquahab web

The 3D office for the Aquahab HQ. Stack: Next.js (App Router), TypeScript, Tailwind CSS v4, React Three Fiber, Drei, Zustand.

## Run

```
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # production build
pnpm check      # typecheck, lint, build (same as CI)
```

The office calls same-origin `/api`, which `next.config.ts` proxies to the crew server (`API_ORIGIN`, default `http://localhost:8787`). For local work without mainnet, run the server with `pnpm dev:mock` (see `server/README.md`): the real API over an in-memory Walrus mock.

## Layout

- `src/app/` — the page and the design tokens in `globals.css`.
- `src/components/hq/` — the 3D office. `HQStage` loads the scene client-side only.
- `src/components/shell/` — overlays: agent tabs, left rail, side tabs, drawers, the status footer.
- `src/components/memory/` — the Memory Vault. `receipt/` — the Blob receipt read from Sui.
- `src/components/briefing/` — the cited morning brief, with 👍 / 👎 and a one-line reason.
- `src/components/chat/` — Ask the Crew (the default) and Quick Capture.
- `src/components/moments/` — Rewind: replay of memory moments.
- `src/lib/api.ts` — typed client; `api-types.ts` is generated from `server/src/contract.ts`.
- `src/lib/hq-layout.ts` — desk positions and camera.
- `public/models/` — optimized GLB assets (office, city and captain).

Specs: `docs/features/hq-scene.md`, `docs/design/ui-layout-map.md`.
