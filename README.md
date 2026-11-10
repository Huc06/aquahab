<p align="center">
  <a href="https://aquahab.up.railway.app">
    <img src="docs/brand/aquahab-banner.svg" alt="Aquahab — the crew that remembers the work" width="100%" />
  </a>
</p>

<p align="center">
  <a href="https://aquahab.up.railway.app"><img src="https://img.shields.io/badge/Live_office-Railway-5EE7F0?style=flat-square&labelColor=050B17" alt="Live Aquahab office on Railway" /></a>
  <a href="https://recall-tatum-walrus.vercel.app/"><img src="https://img.shields.io/badge/Track_02-Smart_Agents_for_Real_Life-4DA2FF?style=flat-square&labelColor=050B17" alt="Total Recall Track 02" /></a>
  <a href="https://aquahab.up.railway.app/api/proof"><img src="https://img.shields.io/badge/Walrus_Memory-Mainnet-3FD0BE?style=flat-square&labelColor=050B17" alt="Walrus Memory mainnet proof endpoint" /></a>
  <a href="https://aquahab.up.railway.app/api/crew"><img src="https://img.shields.io/badge/Tatum-Sui_gRPC_%2B_GraphQL-A9BCD0?style=flat-square&labelColor=050B17" alt="Tatum Sui integration" /></a>
  <a href=".github/workflows/ci.yml"><img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" /></a>
</p>

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  AQUAHAB · THE CREW THAT REMEMBERS                                            │
│                                                                              │
│  A real project ──► a room ──► approved memory ──► next brief                │
│                                                                              │
│  One              Researcher          Builder          Lofi        Hippo     │
│  Chief of Staff   Head of Research    Engineering      Growth      Finance   │
│       ╲                 │                  │              │            ╱     │
│        ╲________________│__________________│______________│___________╱      │
│                                 WALRUS KEEPER                                │
│                                                                              │
│  Each stored memory has a Walrus Blob ID. Each brief line cites the blobs    │
│  it used. Tatum reads the corresponding Sui objects, author keys, writes,   │
│  and checkpoints for the office.                                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Judge start here

Aquahab is a **3D office for the projects you cannot afford to re-explain every morning**. A CEO captures a decision, failure, next step, lesson, deadline, or story note. The Walrus Keeper files only approved memories. The crew recalls them when it writes the next brief, and every line built from memory links back to the Blob IDs it used.

**[Open the live office →](https://aquahab.up.railway.app)** · **[Read live health →](https://aquahab.up.railway.app/api/health)** · **[Compare relayer and chain proof →](https://aquahab.up.railway.app/api/proof)** · **[Inspect the Sui-backed crew →](https://aquahab.up.railway.app/api/crew)**

| What to verify | Live evidence | What it proves |
|---|---|---|
| **Live product** | [Aquahab office](https://aquahab.up.railway.app) | A public, interactive 3D office with rooms, crew, Memory Vault, briefs, receipts, and Telegram-backed CEO writes. |
| **Walrus mainnet writes** | [`GET /api/health`](https://aquahab.up.railway.app/api/health) | The live service reports mainnet mode, relayer health, queue state, LLM health, and Tatum chain health. |
| **Relayer ↔ Sui match** | [`GET /api/proof`](https://aquahab.up.railway.app/api/proof) | Live totals, namespace counts, and memories-per-filer. The endpoint compares Walrus-relayer memory listings against Sui Blob objects. |
| **Crew identity** | [`GET /api/crew`](https://aquahab.up.railway.app/api/crew) | The office roster comes from the MemWal account through Tatum Sui gRPC, not a frontend fixture. |
| **One Blob on chain** | [First decision object on Suiscan](https://suiscan.xyz/mainnet/object/0x3d5f8a2498136fa3a0d5b0d6972f50e81d97c67e97dbaddfaab1c5d921d8a12a) · [Walruscan](https://walruscan.com/mainnet/blob/FxSi7LLYAEQ4-kLZxG7PE37tYq1mGiC1qeZt23PwJS0) | The Blob metadata records the room namespace and the delegate key that filed it. |
| **Complete criterion map** | [Total Recall entry](docs/TOTAL_RECALL.md) | Source paths, live transactions, known gaps, and each judging criterion mapped to evidence. |

## The learning loop

```text
CEO captures a real project event
  “d: Lead the launch demo with creator context.”
                │
                ▼
Walrus Keeper redacts → types → queues → paces → signs → stores
                │                                  │
                │                         Walrus Blob ID
                ▼                                  │
Next morning, the crew recalls project context ◄───┘
                │
                ▼
Brief lines cite the memories they used
                │
                ▼
CEO can inspect the Blob receipt: Sui object, author key, transaction,
checkpoint, namespace, and storage end epoch.
```

This is not a chat-history archive. Aquahab turns a project event into a **verifiable input to a later decision**.

### A five-minute judge walkthrough

1. Open the [live office](https://aquahab.up.railway.app). Reads are public so judges can inspect the product without a CEO session.
2. Select a room, then open **Memory Vault**. Each memory has its type, filer, lifecycle status, and Blob receipt.
3. Open **Briefing**. Every line that relies on memory displays its Blob badge. Open a badge to see the receipt and explorer links.
4. Open [`/api/proof`](https://aquahab.up.railway.app/api/proof). It compares the live Walrus listing with Sui Blob objects per namespace and delegate key.
5. Open [`/api/crew`](https://aquahab.up.railway.app/api/crew). It lists the labelled delegate keys on the MemWal account, read through Tatum, with the transaction that hired each one.
6. For the full build narrative, live transaction links, and tested limitations, read [`docs/TOTAL_RECALL.md`](docs/TOTAL_RECALL.md).

## What makes Aquahab different

| Pillar | What we built |
|---|---|
| **Rooms are project memory** | One room equals one real project and one Walrus Memory namespace. Private rooms use an HMAC alias because namespaces are public metadata. |
| **The crew is on payroll** | One, Researcher, Builder, Lofi, Hippo, and the Walrus Keeper each have a labelled Ed25519 delegate key. The Blob records who filed a memory on chain. |
| **Memory is used, not merely saved** | Morning briefs, evening debriefs, crew standups, drafts, and `/compare` recall room context before responding. Brief and standup lines without valid memory citations are dropped. |
| **Evidence follows the output** | Receipts expose the Blob object, namespace, author, write transaction, checkpoint, and explorer links. The office reads these facts through Tatum. |
| **The human stays in control** | The CEO approves captures, debrief candidates, and feedback. There is no `autoSave` path and no unreviewed `analyze()` call. |

## Mainnet evidence

Aquahab uses a real MemWal account on Sui mainnet. The account owner remains offline; the deployed service holds only scoped delegate keys.

| On-chain action | Evidence |
|---|---|
| Create Aquahab MemWal account | [2EG1WAjX…](https://suiscan.xyz/mainnet/tx/2EG1WAjXKNSDUthezKmg3bBZA58dmeQKPhZ6yhB6SnYC) |
| Hire One | [DtqqN9od…](https://suiscan.xyz/mainnet/tx/DtqqN9odCsTtVTiTowzpnTakhWnL2QoVW2cmAxwFEPbf) |
| Hire Researcher | [2vbfTv27…](https://suiscan.xyz/mainnet/tx/2vbfTv27ZVmLseGT6CgsZbZRTjQNZreqxeqpT3y2q4qX) |
| Hire Builder | [9Z7cRKwX…](https://suiscan.xyz/mainnet/tx/9Z7cRKwXpxkWsEks3C4jR9RKiq1PZxrWn4QmBLWhtQ3r) |
| Hire Lofi | [ASoYahPw…](https://suiscan.xyz/mainnet/tx/ASoYahPwdaQtqscGNbCh6xhiCGaHDmVQeURbvjgxFLoS) |
| Hire Hippo | [2AJMmtbm…](https://suiscan.xyz/mainnet/tx/2AJMmtbmfBybxJtYN2k5ctddcHVN9dV32NnFXxBtHUvE) |
| Hire Walrus Keeper | [GFkz8jHM…](https://suiscan.xyz/mainnet/tx/GFkz8jHMhERsjAgaoWgCpdmr3UoG4sFA6vL5houFciVW) |
| File the first project decision | [6cW9GBSW…](https://suiscan.xyz/mainnet/tx/6cW9GBSWJWq1GiN6JU4HqAau5ZPZWx8oAdpx2Ca7AHYg) |
| Hire Claude Code as a contractor, with its own key | [9QPaPnLE…](https://suiscan.xyz/mainnet/tx/9QPaPnLEGtJN2w21JZ2ygpq74apXB8SvhC1bWtVhCRAz) |

The historical [mainnet probe](docs/FACTS.md) records the account, relayer configuration, native Tatum gRPC, Tatum GraphQL, roster, and delegate-key checks. Live memory totals change as memories are filed, so use [`/api/proof`](https://aquahab.up.railway.app/api/proof) for the current state.

## Architecture

```text
┌────────────────────── CEO interfaces ──────────────────────┐
│  Telegram bot                         3D web office         │
│  room · capture · brief · debrief     rooms · Vault · proof │
└───────────────┬─────────────────────────────────┬───────────┘
                │                                 │
                └──────────────┬──────────────────┘
                               ▼
┌──────────────── Aquahab crew server · Hono ────────────────┐
│  CEO session · rooms · Keeper queue · scheduler · SSE        │
│  brief / debrief / studio · deterministic LLM fallbacks      │
│  Postgres production ledger · PGlite local development       │
└────────────────┬─────────────────────────────┬─────────────┘
                 │                             │
                 ▼                             ▼
      Walrus Memory relayer              Tatum Sui gateway
      remember · recall · list           native gRPC · GraphQL
                 │                             │
                 └─────────────► Sui mainnet ◄─┘
```

### Walrus Memory

The Keeper is the only write path. It redacts credential-shaped text, formats typed memory, creates an account-wide idempotency key, queues the request in the ledger, paces submissions, retries failures, waits for a Blob ID, and emits an SSE update only after storage confirms.

A room brief performs three recall passes: recent project context, risks/open work, and the CEO's cross-room preferences. The model can only cite recalled codes. Aquahab rejects invented citations and uses a deterministic fallback if an LLM response fails.

### Tatum and Sui

Tatum is used for the chain facts the product displays:

- native Sui gRPC reads the MemWal account, delegate keys, objects, transactions, epoch, and checkpoint;
- GraphQL lists the owner's memory Blob objects with their metadata, and the account's hire and fire events from Tatum's indexed checkpoint floor up;
- the office caches server-side and limits outbound calls to avoid polling Tatum from the browser;
- a receipt joins the Walrus Blob ID with the Sui object, `memwal_namespace`, `memwal_agent_id`, write transaction, checkpoint, and storage end epoch.

## Engineering decisions under real constraints

| Constraint | Aquahab response |
|---|---|
| A relayer may return an empty recall response when decryption fails | Retry once, then cross-check the Keeper ledger. A fallback brief is explicitly marked `degraded`. |
| A `remember()` response is asynchronous | Queue and poll it. The web app receives `memory.queued`, `memory.stored`, and `memory.failed` as durable SSE events. |
| Relayer limits are shared across delegate keys | Pace both account-wide and per-key writes. Honour 429/503 retry windows and reuse the same idempotency key. |
| Sui representations differ from relayer identifiers | Convert base64url Blob IDs to the little-endian u256 representation stored on Sui, and normalize public-key encodings. |
| The default Sui gRPC-web transport cannot reach Tatum's gateway | Use native HTTP/2 transport for Tatum gRPC and GraphQL for index/event queries. |
| The SDK cannot forget one TypeScript memory safely | Supersede with a later memory that names the older Blob; never silently erase history. |

See [`docs/FRICTION.md`](docs/FRICTION.md) for the full implementation notes and source issue references.

## Run it locally

### 1. Safe UI and API walkthrough, no keys and no chain writes

```bash
cd server
pnpm install
pnpm dev:mock
```

In another terminal:

```bash
cd web
pnpm install
pnpm dev
```

Open <http://localhost:3000>. Mock mode runs the real API, queue, briefing, debrief, and UI over the SDK's in-memory MemWal mock. It does not reach Walrus, Sui, Tatum, an LLM provider, or Telegram.

### 2. Run checks

```bash
cd server
pnpm check

cd ../web
pnpm check
```

Server tests cover the daily loop, redaction, idempotency, citation validation, debrief approval, studio, standup, SSE, Telegram flows, database copying, and LLM fallback behavior. Web checks run TypeScript, ESLint, and a Next.js production build.

### 3. Mainnet setup

Mainnet requires an operator-owned MemWal account, six delegate keys, a Tatum API key, an LLM provider, Telegram configuration, and a production Postgres database. Secrets are server-only. Follow [`server/README.md`](server/README.md) and [`docs/DEPLOY.md`](docs/DEPLOY.md); do not copy local secrets into issue threads, the browser, or the repository.

## Where to inspect the build

```text
Aquahab/
│
├── web/                                  The judge-facing 3D office
│   ├── src/app/page.tsx                   Full-screen HQ entry point
│   ├── src/components/hq/                 Office model, roaming crew, scene labels
│   ├── src/components/memory/             Vault and Blob receipt UI
│   ├── src/components/briefing/           Cited morning brief UI
│   └── src/components/chat/               CEO capture and crew conversation UI
│
├── server/                               The product and memory runtime
│   ├── src/app.ts                         Hono API, CEO-write boundary, SSE, Telegram webhook
│   ├── src/memory/keeper.ts               Redaction → queue → pacing → signed Walrus write → Blob ID
│   ├── src/memory/walrus.ts               Walrus Memory client, recall, and local mock adapter
│   ├── src/brief.ts                       Three-pass recall and citation-checked morning brief
│   ├── src/actions.ts                     Capture, debrief candidates, CEO keep/drop decisions
│   ├── src/standup.ts                     Crew conversation built from cited memories
│   ├── src/studio.ts                      Draft and without-memory / with-memory comparison
│   ├── src/telegram.ts                    Pairing, CEO bot controls, receipts, and magic web link
│   ├── src/views.ts                       Relayer × Sui read models for Vault, crew, and proof
│   ├── src/chain/sui.ts                   Tatum gRPC / GraphQL chain reads and Blob metadata
│   └── test/                              Daily loop, queue, citations, Telegram, SSE, and fallback tests
│
├── docs/                                 Judge evidence and operating record
│   ├── TOTAL_RECALL.md                    Track criterion map, live mainnet transactions, known gaps
│   ├── FACTS.md                           Read-only mainnet probe transcript
│   ├── FRICTION.md                        Integration failures and production mitigations
│   └── DEPLOY.md                          Railway topology, secrets boundary, and smoke test
│
└── .github/workflows/ci.yml               Contract sync plus separate web and server checks
```

| If you want to verify… | Start here | Follow it to |
|---|---|---|
| **A memory really reaches Walrus** | [`server/src/memory/keeper.ts`](server/src/memory/keeper.ts) | [`/api/memory-jobs`](https://aquahab.up.railway.app/api/memory-jobs) → Blob receipt → [Walruscan](https://walruscan.com/mainnet/blob/FxSi7LLYAEQ4-kLZxG7PE37tYq1mGiC1qeZt23PwJS0) |
| **Memory changes a later output** | [`server/src/brief.ts`](server/src/brief.ts) | [`web/src/components/briefing/BriefingPanel.tsx`](web/src/components/briefing/BriefingPanel.tsx) → cited Blob badges |
| **A crew member is a real on-chain identity** | [`server/src/chain/sui.ts`](server/src/chain/sui.ts) | [`server/src/views.ts`](server/src/views.ts) → [`/api/crew`](https://aquahab.up.railway.app/api/crew) |
| **The office matches live data** | [`web/src/components/hq/HQScene.tsx`](web/src/components/hq/HQScene.tsx) | [`/api/crew`](https://aquahab.up.railway.app/api/crew) and room memory counts |
| **The Telegram workflow is protected** | [`server/src/telegram.ts`](server/src/telegram.ts) | CEO pairing, brief receipts, capture lifecycle, and `/web` magic link |
| **The system survives real failures** | [`docs/FRICTION.md`](docs/FRICTION.md) | Queue backoff, retry, timeout, degraded brief, and identifier conversion code |

## Scope and known limits

Aquahab is a **one-CEO hackathon deployment**. Reads are intentionally public so judges can walk the real office; CEO writes require the Telegram `/web` session. The Telegram bot, [@Aquahab_Crew_bot](https://t.me/Aquahab_Crew_bot), answers only the one CEO chat it is paired with, so judges see it in the demo video and the team can run a live walkthrough on request. The current product does not claim permanent storage, automatic renewal, arbitrary agent creation, marketplace features, or multi-user production access control.

The system handles uncertainty explicitly: a queued memory is not shown as stored, a failed recall is not silently treated as no memory, and a model line without a valid recalled citation is not shown as evidence.

---

**Total Recall · Track 02: Smart Agents for Real Life**<br />
**Bonus target: Best Walrus Memory**
