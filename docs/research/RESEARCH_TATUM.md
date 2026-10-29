# Tatum AI Builder — Research Notes

| Field | Value |
|---|---|
| Date | 2026-10-27 |
| Question | What is "Tatum AI" in our docs, and can it serve as the agent LLM and the Sui proof source? |
| Method | WebFetch of `ai.tatum.io`, `docs.tatum.io/llms.txt`, `ai.tatum.io/mcp`, `docs.tatum.io/docs/supported-blockchains`, `docs.tatum.io/reference/sui-grpc`, and web search. No account, no API key used. |
| Status | Findings verified from pages read. Pricing, rate limits, and the full `/auth` and `/safety` pages were not available. |

## Bottom line

**Tatum AI Builder is not an LLM inference API.** Our docs assume it is. That assumption is wrong, the same kind of error as assuming a wallet connect flow in the MemWal onboarding.

What Tatum offers, verified:

| Capability | What it is | Can the agent runtime call it for text generation? |
|---|---|---|
| **AI Builder** (ai.tatum.io) | Prompt-to-app builder. Example apps are described as built from one prompt. Also the "Launch AI Builder" signup. | No. It builds apps. It is not a runtime model endpoint. |
| **Blockchain MCP** (`@tatumio/blockchain-mcp`) | 13 tools for chain data and RPC (balances, portfolio, transactions, blocks, `gateway_execute_rpc`). | No. Tools are chain reads and RPC, with no text-generation tool. |
| **Skills** (`npx skills add tatum`) | Integration guidance for coding agents (wallet tracking, risk checks, webhooks, gas). | No. Guidance for writing code. |
| **Documentation MCP** (`docs.tatum.io/mcp`) | Lets coding agents search Tatum docs, and run live REST calls with an API key. | No. Developer tooling. |
| **Blockchain Data / RPC REST API** | Standard chain APIs (for example `x-api-key` auth). | Only chain data. |
| **Sui gRPC gateway** | LedgerService (checkpoints, transactions, objects), StateService, SubscriptionService, and others. | Not text, but usable for Sui proof reads. |

I found **no** Tatum LLM, chat completion, or inference endpoint in the docs, the llms.txt index (cut off, but no AI section), the MCP page, or search. This is a negative finding from what I could read. It is not proof that none exists.

## Facts that matter for our design

1. **Tatum AI cannot be the agent LLM.** Tatum-powered agent output needs a separate model provider. This changes SYSTEM_DESIGN §4.5 and §3.4, PRD A5, the risk table, and the `LLMClient` wiring. The `LLMClient` interface is still right. Its implementation is not Tatum.
2. **Tatum AI Builder is a build-time tool.** Our RESHADED V1 stack says "Tatum APIs / Tatum AI Builder integration". Read that way, it fits the frontend build, for example scaffolding the HQ UI. It does not fit runtime.
3. **Sui proof through Tatum is mainnet-only.** The Sui gRPC page lists only `sui-mainnet-grpc.gateway.tatum.io:443`. Our demo runs on Testnet (A8). A proof lookup through Tatum therefore cannot read a testnet blob. This links directly to the network decision (PRD A8).
4. **Sui proof read path is concrete.** `LedgerService` with `GetObject` and `GetCheckpoint` exists, and `SubscriptionService` streams checkpoints. That covers the Proof panel once the network question is settled. The blob-to-object mapping still needs to be confirmed from Walrus docs (A6).
5. **Auth is `x-api-key`** for both REST and gRPC (metadata). The MCP config reads `TATUM_API_KEY`. Keys must stay server-side.
6. **Blockchain MCP is local, not remote.** The documented setup is `npx @tatumio/blockchain-mcp` with `TATUM_API_KEY`. No hosted HTTP MCP URL was documented. Our backend should not depend on a developer MCP for runtime data. Direct REST or gRPC is simpler.
7. **Unknowns:** pricing, rate limits, tiers, whether AI Builder needs a paid plan, and the `/auth` and `/safety` contents. These must be read before any demo commitment.

## Sui support in Tatum

- Sui is listed in the supported-blockchains page under Tier 2 ("Popular"). That page names only RPC, with no network names.
- The Sui gRPC page is the concrete source. It is mainnet only.

## Corrections needed in our docs (not yet made)

| Doc | Current claim | Correction |
|---|---|---|
| `SYSTEM_DESIGN.md` §3 Stack | "AI and chain data: Tatum APIs and Tatum AI" | Split: Tatum for chain data and Sui proof; a separate LLM provider for agent output; AI Builder for build-time scaffolding only |
| `SYSTEM_DESIGN.md` §4.5 | "AI: every agent and briefing LLM call goes through `LLMClient` backed by Tatum AI" | `LLMClient` is backed by a model provider chosen by the team. Tatum is not an option for it. |
| `PRD.md` A5 | "Tatum AI endpoint and model" | Replace with "LLM provider and model (not Tatum)". Add: confirm AI Builder access and terms. |
| `PRD.md` §4 and risks | "Tatum AI unavailable on demo day" | Risk applies to the chosen LLM provider. Tatum risk is Sui proof on mainnet only. |
| `API_DESIGN.md` `/api/tasks/:taskId/start` | "Call the AI (Tatum AI via `LLMClient`)" | "Call the LLM provider via `LLMClient`" |
| `DATA_MODEL.md` / `docs/features/company-briefing.md` | "Tatum AI summary" | "LLM summary" |
| `docs/features/memory-vault.md` Proof | "Sui reference read through Tatum" | Still correct, but only on mainnet. Add the network condition. |
| `RESHADED_RE_SCAFFOLD_V1.md` | "Tatum AI Builder integration" in stack | Not edited (source doc). Flag as an open question for the author. |

## Decision needed from you

**Which LLM provider runs the agents and the briefing?** Options I can verify or plausibly support, pending your choice:

1. **Anthropic (Claude API)**: a Claude model through the official API. I can check the current model list and SDK before committing.
2. **Another provider** you already have access to (OpenAI, Google, or other).
3. **Tatum AI Builder** only for scaffolding the frontend, with the runtime LLM from option 1 or 2.

I recommend option 3 plus option 1. It keeps the Tatum integration for what Tatum actually provides (chain data and Sui proof), and gives the agents a model with documented runtime access. Confirm, and I will update the docs and the Day 3 plan.

## Next research steps

- Read `/auth`, `/safety`, and pricing on Tatum (not available in this pass).
- Confirm the Walrus-blob-to-Sui-object mapping (A6). Without it, the Proof panel has no verified lookup path.
- If the team picks a Claude-based runtime, verify the model names and SDK from the official Anthropic docs before writing them into the design.
- Decide the network (A8) before Day 3, since Tatum Sui proof is mainnet-only.

## Sources

- https://ai.tatum.io/ (AI Builder landing, read)
- https://ai.tatum.io/mcp (Blockchain MCP, read)
- https://docs.tatum.io/llms.txt (documentation index, read up to Wallet APIs; cut off)
- https://docs.tatum.io/docs/supported-blockchains (Sui in Tier 2)
- https://docs.tatum.io/reference/sui-grpc (Sui gRPC, mainnet only)
- https://docs.tatum.io/reference/welcome-to-the-tatum-api-reference (no AI product section)
- Web search results (Tatum AI product context, no LLM endpoint found)
