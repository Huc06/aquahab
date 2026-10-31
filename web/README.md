# Aquahab web

Frontend for the Aquahab HQ. Stack: Next.js (App Router), TypeScript, Tailwind CSS v4, React Three Fiber, Drei, Zustand.

## Run

```
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # production build
pnpm check      # typecheck, lint, build (same as CI)
```

## Layout

- `src/app/` — routes and global tokens (`globals.css` mirrors `DESIGN.md` §10).
- `src/components/shell/` — top bar, mission rail, agent inspector.
- `src/components/hq/` — 3D HQ scene. `HQStage` loads the scene client-side only.
- `src/lib/hq-layout.ts` — desk positions and camera. Positions other than `one` are estimates to calibrate.
- `src/lib/mock.ts` — mock data until the API exists.
- `public/models/` — optimized GLB assets (office and captain).

Specs: `docs/features/hq-scene.md`, `docs/design/ui-layout-map.md`.
