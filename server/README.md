# Aquahab crew server

The backend of Aquahab: the crew that remembers where you left off on each project. It owns every call to
Walrus Memory (mainnet), Sui through Tatum, the LLM and Telegram. The web app never holds a key; it reaches
this server through a same-origin `/api` proxy (`web/next.config.ts`).

```
            Telegram (CEO)          Web office (3D)
                 │  poll/webhook          │ /api (same-origin proxy)
                 ▼                        ▼
   ┌──────────────────────── crew server (Hono, Node 22) ────────────────────────┐
   │ scheduler ─ morning brief / evening debrief, once per local day per room    │
   │ brief     ─ 3 recalls → LLM writes per-agent sections → every line cites     │
   │ actions   ─ capture · debrief proposals · keep/drop · 👍/👎 feedback          │
   │ Keeper    ─ redact → type → queue → paced remember() signed by the filing   │
   │             member's own delegate key → poll to blob_id → SSE + Telegram     │
   │ views     ─ crew, memory wall, receipts, proof: relayer × Sui (via Tatum)    │
   └───────┬───────────────────────────────┬────────────────────────┬────────────┘
           ▼                               ▼                        ▼
  Walrus Memory relayer            Tatum Sui gateway          Vercel AI Gateway
  (mainnet, Seal-encrypted)        gRPC + GraphQL             (Claude)
```

## The loop

| When | What happens | Walrus / Sui |
|---|---|---|
| 08:30 (per room) | One brief per room on Telegram and in the office. One section per crew member; every line cites blob ids; 👍 / 👎 | 3 `recall`s (room recent, room risks, CEO prefs) |
| Any time | `d:` `f:` `n:` `done:` `l:` `due:` `s:` `p:` quick capture, or a free note the crew turns into proposals | Keeper `remember`, signed by the filer |
| 21:00 (per room) | "How did today go?" The reply becomes proposals; the CEO keeps or drops each | Kept ones only |
| 👎 + reason | "Too long, keep it to five lines" becomes a feedback memory in `aquahab:ceo`. Every later brief written by the model gets it, and the Keeper's section names it with its receipt ("I gave the crew your feedback from 7 Nov on …") | Keeper `remember`, then `recall` (CEO prefs) |
| `/compare question` | The memory switch: the same question answered by a model that has never seen the project, then from the room's memory with receipts. Stores nothing | 1 `recall` (room), none for the blank side |

Memory line format (recall has no tag filters, so the type lives in the text):
`[decision][aquahab][2026-11-04][by:one] Use Tatum GraphQL for events; JSON-RPC returns 404`

| Type | Filed (signed) by | | Type | Filed by |
|---|---|---|---|---|
| decision, next | One | | deadline | Hippo |
| failure, done | Builder | | story | Lofi |
| learned | Researcher | | preference, feedback | Walrus Keeper |

## Frontend work: no keys needed

```bash
cd server && pnpm install && pnpm dev:mock     # API on :8787, in-memory Walrus mock, a seeded "Aquahab" room
cd web && pnpm dev                              # http://localhost:3000, /api is proxied to :8787
```

`dev:mock` loads [`.env.mock`](.env.mock): the real API and the real Keeper, brief and debrief code, over the
SDK's `MemWalMock`. Nothing reaches Walrus, Sui, Tatum, an LLM or Telegram, and every write is allowed
(`AUTH=off`). To see live mainnet data instead, point the web app at the deployed server:
`API_ORIGIN=https://<server> pnpm dev`.

Only one real (mainnet) server runs at a time: the Telegram bot accepts a single poller, and each server
keeps its own ledger of rooms and briefs.

## Run it (mainnet)

```bash
cd server
pnpm install
pnpm keys                   # owner Sui address + one delegate key per crew member, into .env.local / .env.owner.local
# send ~0.5 SUI to the printed owner address, add TATUM_API_KEY to .env.local, then:
pnpm account create         # the Aquahab MemWalAccount (submitted through Tatum gRPC)
pnpm account hire-all       # register the 6 labelled crew keys on-chain
pnpm probe                  # read-only Day-1 checks against mainnet → docs/FACTS.md
pnpm dev                    # API on :8787, scheduler, Telegram long-poll
```

Then in `web/`: `pnpm dev` (proxies `/api` to `API_ORIGIN`, default `http://localhost:8787`).

Deployed: one Railway project (server, web, Postgres), steps and variables in [`docs/DEPLOY.md`](../docs/DEPLOY.md). `pnpm db:copy` moves the local ledger to the deployed Postgres once, at cut-over.

UI work without mainnet: `MEMORY_MODE=mock AUTH=off pnpm dev`. That is the real API over the SDK's
in-memory `MemWalMock`; the server refuses both flags when `NODE_ENV=production`.

| Script | What it does |
|---|---|
| `pnpm check` | typecheck + tests (the whole daily loop against `MemWalMock`, no network) |
| `pnpm keys` | generate missing keys and secrets; prints only public values |
| `pnpm account status \| create \| hire-all \| hire <role> \| fire <role> \| hire-contractor <label> <pubkey>` | the payroll desk, signed by the owner key, submitted through Tatum (`--direct` for Mysten's fullnode) |
| `pnpm probe` | read-only mainnet checks → `docs/FACTS.md` |
| `pnpm verify` | every memory on the relayer matched to its Blob object on Sui (namespace and author from Blob metadata) → `docs/PROOF.md` |
| `pnpm seed-room <slug> <file> [--api <url>] [--dry-run]` | file prepared memories (one prefixed line each) through the normal capture path; real mainnet writes, so true lines only. `p:` is refused: preferences live in `aquahab:ceo` and every room's brief reads them |
| `pnpm db:copy` | one-time cut-over: copy the local PGlite ledger (rooms, briefs, board, pairing) into `DATABASE_URL` |
| `pnpm contract:sync` | copy `src/contract.ts` to `web/src/lib/api-types.ts` (CI checks they match) |

## API

Shapes: [`src/contract.ts`](src/contract.ts). Reads are public; writes (✱) need the CEO session from the bot's `/web` link.

| Route | Purpose |
|---|---|
| `GET /api/health` | relayer (writes ok/paused), Tatum (epoch, checkpoint), LLM, queue counts, mock or mainnet |
| `GET /api/session` | `{ ceo }` |
| `GET /api/rooms` · `POST /api/rooms` ✱ · `GET/PATCH ✱ /api/rooms/:id` | rooms (one namespace each), with an optional goal and `contextTags` (a label per crew member; `CONTEXT_PRESETS.creator`) |
| `GET /api/rooms/:id/brief/latest` · `GET …/briefs` · `POST …/brief` ✱ | briefs with per-line `cites` (blob ids) |
| `GET /api/rooms/:id/standup/latest` · `POST …/standup` ✱ | the crew talking to each other about the room after the morning brief: turns with `to` (who they answer) and `cites` (blob ids). Stores nothing on Walrus; 409 when fewer than two members have memories |
| `POST /api/briefs/:id/feedback` ✱ | `{ rating: "up"\|"down", reason? }` → feedback memory |
| `POST /api/rooms/:id/capture` ✱ | `{ text }` with a quick-capture prefix, or free text (classified) → `MemoryJob` |
| `POST /api/rooms/:id/debrief` ✱ · `GET …/candidates` · `POST /api/candidates/decide` ✱ | proposals, then keep/drop/edit → `MemoryJob[]` |
| `GET /api/memory-jobs/:jobId` · `GET /api/memory-jobs?roomId=` · `POST …/retry` ✱ | `queued → pending → stored` (or `failed`) with `blobId` |
| `POST /api/rooms/:id/draft` ✱ | `{ idea, agent?, refine?, previous? }` → a draft in the room's voice plus the memories it followed or avoided (blob ids). Stores nothing |
| `POST /api/rooms/:id/chat` ✱ | `{ message, agent: role | "all" }` → replies from the members with relevant memories, each citing blob ids, plus an optional proposal to commit through `/capture`. Stores nothing |
| `POST /api/rooms/:id/compare` ✱ | `{ question }` → `withoutMemory` (no recall: the model gets only the room name) and `withMemory` (recall + answer, citing blob ids; an answer that cites nothing says so). Stores nothing |
| `GET /api/rooms/:id/memories` | the room wall: relayer listing joined with Sui (Blob object, end epoch, on-chain author) |
| `GET /api/rooms/:id/recall?q=` | search the room's memory |
| `GET /api/memories/:blobId/receipt` | one memory's on-chain receipt via Tatum: Blob object, namespace, write tx, checkpoint |
| `GET /api/crew` | the payroll from Sui via Tatum: labels, Agent IDs, hire dates and txs, memories per employee, vacancies |
| `GET /api/proof` | relayer vs chain counts, per room and per employee |
| `GET /api/events` | SSE: `memory.queued/stored/failed`, `recall.used { blobIds }`, `brief.created`, `standup.created`, `crew.changed` |
| `POST /api/cron/tick` | scheduler tick for serverless hosts (bearer `CRON_SECRET`) |
| `POST /telegram/webhook` | Telegram webhook (secret header), registered on boot when `TELEGRAM_MODE=webhook`; the web app proxies it |
| `GET /healthz` | liveness for the host, no outbound calls |

## Design notes

- **One gate, many signers.** The Keeper is the only code path that calls `remember()`, but it signs with the
  filing member's own delegate key, so each Blob's on-chain `memwal_agent_id` says who filed it.
- **Nothing is written without the CEO.** Captures are typed by the CEO, debrief proposals are kept by the CEO,
  feedback is the CEO's rating. No `autoSave`, no `analyze()`.
- **Receipts or it didn't happen.** The model sees memories as codes (`m1`, `c1`), cites codes, and the server
  maps them to blob ids and drops any line whose citations are not in the recall set.
- **Empty recall is "unknown", not "nothing".** Recall is retried once and cross-checked against the Keeper's
  ledger; a brief built from the ledger is marked `degraded`. The CEO recall falls back to the ledger the same way.
- **Paced writes.** ~2.7 s between writes on the account and ~5.2 s per key (mainnet allows about 24/min per
  account and 12/min per key), `retry_after` honoured on 429, account-wide idempotency keys prefixed `aq:<room>:`.
- **Redaction before every write** (the managed relayer sees plaintext): API keys, bot tokens, bare 32-byte hex
  (delegate keys), bech32 Sui private keys, emails. Public `0x` addresses and object ids are kept.
- **Tatum budget.** One token bucket (2 req/s) for gRPC and GraphQL, 45–120 s caches; the office polls this
  server, never Tatum.

Prior work: the paced-queue, backoff, idempotency and empty-recall patterns follow
[yukitran03/tact](https://github.com/yukitran03/tact) (`src/memory/backend.ts`), rewritten for this server.
Vendored protos: [`proto/`](proto/README.md) (MystenLabs/sui-apis, Apache-2.0).
