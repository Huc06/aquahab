# Aquahab × Total Recall (Tatum × Walrus)

**Track:** 02, Smart Agents for Real Life: "Portable memory means they pick up where they left off across tools and sessions."
**Also for:** Best Walrus Memory.

**Live office:** <https://aquahab.up.railway.app> (reads are public, so anyone can walk the office). The CEO works from Telegram and the office.

Every commit in this repo is from the build window: the first one is from 29 Oct 2026, and the window runs 20 Oct to 10 Nov.

## The idea

Aquahab is an office with a crew of AI agents for each real project. The crew remembers where you left off.

- **One room is one project and one Walrus Memory namespace** (`aquahab:room:<slug>`). The CEO's own preferences and feedback live in `aquahab:ceo`, which every room reads.
- **Each crew member is its own delegate key** on one MemWal account: One, Researcher, Builder, Lofi, Hippo and the Walrus Keeper. Every memory Blob on Sui records the key that signed it, so the office can show who filed what from the chain, not from our database.
- **Every morning** the crew recalls the room and writes a brief. Every line cites the Blobs it rests on.
- **Every evening** the crew asks how the day went. The reply becomes proposals, and only the ones the CEO keeps are written to Walrus.
- **When the CEO rates a brief 👎 with a reason**, the reason becomes a memory. Later briefs read it, and the Keeper says so with its receipt.

## What was built

| Feature | What it does | Where |
|---|---|---|
| **Crew payroll on Sui** | `pnpm account create · hire-all · hire · fire · hire-contractor`. The owner key signs, and the transactions go to Sui through Tatum's gRPC gateway (`--direct` uses Mysten's fullnode instead). | `server/scripts/account.ts` |
| **The Walrus Keeper** | The one code path that writes memories: <br>1. redact credentials; <br>2. type the memory, which picks the filer; <br>3. queue it in a ledger; <br>4. pace it under the relayer's limits; <br>5. sign it with the filer's own delegate key and an idempotency key; <br>6. poll until a blob id. <br>Nothing reaches Walrus without the CEO: there is no `autoSave` and no `analyze()`. | `server/src/memory/keeper.ts` |
| **Morning brief** | Three recalls: the room's recent memories, its risks, and the CEO's preferences. One section per crew member. A line that cites no recalled Blob is dropped. The prompt tells One to list only next steps no `done` memory has closed. | `server/src/brief.ts`, `server/src/llm.ts` |
| **Evening debrief** | The CEO's reply becomes typed proposals. The CEO keeps or drops each, and only kept ones are filed. | `server/src/actions.ts` |
| **Feedback loop** | 👎 + a one-line reason (200 characters at most), in Telegram or on the office's brief, becomes a `feedback` memory in `aquahab:ceo`, signed by the Keeper. Every later brief the model writes gets it. The Keeper's section names it with its receipt: "I gave the crew your feedback from 7 Nov on …". | `server/src/actions.ts`, `server/src/brief.ts` |
| **The memory switch** | `/compare <question>`: the same question answered twice. First by a model that has never seen the project (no recall, only the room name), then from the room's memory with receipts. Stores nothing. | `server/src/studio.ts` |
| **Crew standup** | After the brief, the members talk to each other from memory. Each turn cites a Blob in its own domain. | `server/src/standup.ts` |
| **Creator studio** | Draft a post in the CEO's voice, and ask the crew. Both cite the memories they used, and the draft also lists the failures it steered clear of. | `server/src/studio.ts` |
| **Receipts from the chain** | For every memory, read through Tatum: <br>- its Blob object; <br>- the namespace and author stored in the Blob's own metadata (`memwal_namespace`, `memwal_agent_id`); <br>- the write transaction and its checkpoint; <br>- the storage end epoch. | `server/src/chain/sui.ts`, `server/src/views.ts` |
| **3D office** | The crew at their desks, the brief with a Blob badge on every line, the memory wall and its receipts, live events over SSE. | `web/` |
| **Telegram bot** | Paired to one CEO by code. Commands: <br>- `/brief`, `/debrief`, `/compare`, `/ask`, `/memories`, `/crew`, `/times` (or `/times off` for a persona room); <br>- quick capture (`d:` decision, `f:` failure, `n:` next, `done:`, `l:` learned, `due:`, `s:` story, `p:` preference); <br>- 👍 / 👎 on every brief. | `server/src/telegram.ts` |
| **Proof scripts** | `pnpm probe`: read-only mainnet checks, written to `docs/FACTS.md`. `pnpm verify`: every memory on the relayer matched to its Blob object on Sui. It writes `docs/PROOF.md` when run; the file is not committed yet. | `server/scripts/` |
| **Tests** | 84 server tests against the SDK's `MemWalMock`. They include: <br>- the daily loop end to end; <br>- the LLM path against a fake OpenAI-compatible server that misbehaves on purpose (made-up codes, members out of their domain); <br>- Telegram rendering. | `server/test/` |

## How Tatum is used

| Call | Transport | Used for |
|---|---|---|
| `MemWalAccount` object: owner and delegate keys | Tatum native gRPC (`@grpc/grpc-js`) | The crew roster in the office and in `/crew` (`source: "tatum-grpc"`) |
| Hire and fire history: every `DelegateKeyAdded` and `DelegateKeyRemoved` event the owner signed, with its transaction | Tatum GraphQL (`events`, from Tatum's indexed checkpoint floor up) | `history` and each member's `hireTx` in `GET /api/crew` |
| Every Walrus Blob the owner holds, with its metadata dynamic field, previous transaction and checkpoint | Tatum GraphQL | The memory wall, each receipt, and `GET /api/proof` (memories on the relayer vs Blob objects on chain) |
| Account creation and hires | Tatum gRPC, through the Sui SDK's `SuiGrpcClient` | `pnpm account` |
| Chain, Sui epoch and checkpoint (`GetServiceInfo`) | Tatum native gRPC | `GET /api/health` and the office footer |

Tatum's free plan allows 3 requests a second (see `server/src/chain/tatum.ts`), so one token bucket keeps Aquahab at about 2. The office polls our server, which caches, and never calls Tatum directly.

## Live evidence on Sui mainnet

| What happened | Transaction |
|---|---|
| The Aquahab MemWal account was created, 4 Nov 2026 08:44 UTC | [2EG1WAjX…](https://suiscan.xyz/mainnet/tx/2EG1WAjXKNSDUthezKmg3bBZA58dmeQKPhZ6yhB6SnYC) |
| One was hired | [DtqqN9od…](https://suiscan.xyz/mainnet/tx/DtqqN9odCsTtVTiTowzpnTakhWnL2QoVW2cmAxwFEPbf) |
| Researcher was hired | [2vbfTv27…](https://suiscan.xyz/mainnet/tx/2vbfTv27ZVmLseGT6CgsZbZRTjQNZreqxeqpT3y2q4qX) |
| Builder was hired | [9Z7cRKwX…](https://suiscan.xyz/mainnet/tx/9Z7cRKwXpxkWsEks3C4jR9RKiq1PZxrWn4QmBLWhtQ3r) |
| Lofi was hired | [ASoYahPw…](https://suiscan.xyz/mainnet/tx/ASoYahPwdaQtqscGNbCh6xhiCGaHDmVQeURbvjgxFLoS) |
| Hippo was hired | [2AJMmtbm…](https://suiscan.xyz/mainnet/tx/2AJMmtbmfBybxJtYN2k5ctddcHVN9dV32NnFXxBtHUvE) |
| The Walrus Keeper was hired | [GFkz8jHM…](https://suiscan.xyz/mainnet/tx/GFkz8jHMhERsjAgaoWgCpdmr3UoG4sFA6vL5houFciVW) |
| The first memory, a decision filed by One: "Read the crew roster and memory Blobs from Sui through Tatum…" Its Blob [0x3d5f…a12a](https://suiscan.xyz/mainnet/object/0x3d5f8a2498136fa3a0d5b0d6972f50e81d97c67e97dbaddfaab1c5d921d8a12a) carries the namespace `aquahab:room:aquahab` and One's key on chain. Checkpoint 341503306. [Walruscan](https://walruscan.com/mainnet/blob/FxSi7LLYAEQ4-kLZxG7PE37tYq1mGiC1qeZt23PwJS0) | [6cW9GBSW…](https://suiscan.xyz/mainnet/tx/6cW9GBSWJWq1GiN6JU4HqAau5ZPZWx8oAdpx2Ca7AHYg) |
| Claude Code was hired as a contractor with its own key, 10 Nov 2026, through Tatum gRPC (`pnpm account hire-contractor`, DECISIONS §14) | [9QPaPnLE…](https://suiscan.xyz/mainnet/tx/9QPaPnLEGtJN2w21JZ2ygpq74apXB8SvhC1bWtVhCRAz) |
| The contractor's first memory, signed by its own key: "done: The crew's hire history reads through Tatum again…" Its Blob [0xc527…6290](https://suiscan.xyz/mainnet/object/0xc52714f96bf0f6d60576c291d8340faaa6fde86bedfb85d93d9a10e738c76290) carries the namespace `aquahab:room:aquahab`. Checkpoint 343665234. [Walruscan](https://walruscan.com/mainnet/blob/dPPp-IhVWYVJgg3QRqHjOd0oKLVAdQA_xyBmxvAKziw) | [85bgHwE8…](https://suiscan.xyz/mainnet/tx/85bgHwE8ZbEw5H5U2o2XUnVX8sismdYpyYq5A5fAP2im) |

- **Account:** `0x394fc2e4275efeb1b57a94eeff662c68fb2bd16a5d2e908e5fb475c9fd3ef986`.
- **Hire history, fixed on 10 Nov:** on 7–9 Nov the hire history in `/api/crew` came back empty. Tatum answered the events query with `Failed to list events`, and the reason underneath was `OutOfRange: lowest available checkpoint is 237661232`: a query with no lower bound reached below Tatum's index. The query now starts at that floor, and moves up if Tatum reports a higher one. The history and each member's `hireTx` come back through Tatum.
- **Live counts:** [`/api/proof`](https://aquahab.up.railway.app/api/proof) shows memories on the relayer against Blob objects on chain, per namespace and per crew member. [`/api/crew`](https://aquahab.up.railway.app/api/crew) shows the roster read from Sui.
- **Every memory on chain in the `aquahab` and `creator-journey` rooms is real.** As of 10 Nov that is 12 memories in two rooms: 8 in `aquahab`, one of them by the contractor, and 4 in `creator-journey`. Two of the eight in `aquahab` are setup notes from 4 Nov. The CEO namespace holds 2 feedback memories. The persona room `creator-demo` is separate and labelled as a demo; it is not counted.

## Judging criteria: where to look

| Criterion | Weight | Evidence |
|---|---|---|
| Walrus and Tatum integration | 30% | **Walrus Memory is the product:** <br>- one namespace per project; <br>- one delegate key per crew member; <br>- typed one-line memories; <br>- the brief, standup, `/compare` and debrief all recall before they speak. <br>**Tatum carries every chain read the office shows:** roster, Blob authorship, receipts and health. The payroll transactions go through it too. |
| Technical quality (incl. "successful Tatum Sui RPC integration") | 30% | 84 server tests and strict TypeScript. <br>- Every LLM call has a deterministic fallback. <br>- Codes the model invents are dropped, and a line with no real citation is not shown. <br>- The relayer's limits are paced, retries carry idempotency keys, and credentials are redacted before anything is stored. <br>- `pnpm probe` and `pnpm verify` check it all live. |
| Creativity | 20% | **The crew is on payroll:** each agent's identity is a key on Sui, and every memory on chain records which agent wrote it. **Memory visibly changes the work:** the CEO's 👎 shows up in the next brief with its receipt, and `/compare` puts the answer without memory next to the answer with it. |
| Presentation | 20% | The live office and bot, this document, the server README, and, once published, the demo video and the blog post. |
