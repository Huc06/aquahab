# LLM Authentication for Aquahab Agents — Research Notes

| Field | Value |
|---|---|
| Date | 2026-10-27 |
| Question | Can Aquahab authenticate agent LLM calls through the user's local Claude login (Claude Code / Claude subscription) instead of an API key? |
| Source verified | https://code.claude.com/docs/en/legal-and-compliance (read in full, authentication and third-party sections quoted below) |
| Status | Verified from the official page. Not legal advice. Confirm the bridge pattern with Anthropic sales before relying on it. |

## Verdict

**Using the user's Claude subscription login to power Aquahab's agents is not permitted**, under the official terms. Routing requests through a user's Free, Pro, or Max plan credentials from a third-party product is the exact pattern the terms rule out. This applies whether the sign-in is done in our web app or through a local bridge that drives the user's own `claude` CLI.

## Quoted rules (official page)

On OAuth:

> "OAuth authentication is intended exclusively for purchasers of Claude Free, Pro, Max, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications."

On third-party products:

> "Developers building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use API key authentication through Claude Console or a supported cloud provider. Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users. Moreover, developers may not collect, store, or intermediate Claude.ai credentials or session tokens."

On what remains allowed:

> "This does not restrict how customers provision and manage their own API keys ... provided the resulting usage is billed to the key owner under their agreement with Anthropic ... and is not resold or intermediated as described above. Nor does it prevent an end user from signing in to the unmodified Claude Code binary with their own Claude subscription, including where a platform hosts Claude Code as described under ..."

On the Claude Code binary:

> "The Claude Code binary must not be modified ... customers may not remove, disable, or restrict any authentication method built into it."

On enforcement:

> "Anthropic reserves the right to take measures to enforce these restrictions and may do so without prior notice."

## What this means for the three options

| Option | Auth source | Allowed? | Notes |
|---|---|---|---|
| **A. Local bridge with the user's `claude` login** | User's Claude subscription, read through the local CLI | **No, as designed.** Our app would route requests through the user's plan on their behalf, and that is the prohibited pattern. The "end user signs into the unmodified binary" sentence covers the user using Claude Code themselves, not a product routing its own agent calls through that login. | Reject. Do not design the token or session handling around this. |
| **B. Bring-your-own Anthropic API key (BYOK)** | User's own API key from Claude Console | **Yes**, for the key owner's usage, billed to them. | Recommended. The key should stay on the user's machine if possible (local bridge or browser), because the terms also forbid developers intermediating credentials. A key the user holds is not a Claude.ai session token, but keep the handling minimal. |
| **C. Aquahab's own API key** | Our Console key, billed to us | **Yes**, under our commercial agreement. | Simplest for the hackathon demo. Costs are ours, and the cost model in PRD §7.5 must include them. Not a scale path, since it means we pay for every end user. |

## Recommendation

1. **Hackathon:** option C, a server-side Aquahab key for the demo only, with a per-session spend cap. This is the lowest-risk way to finish the demo.
2. **Scale and product:** option B. The user supplies their own API key. Prefer a local bridge, so the key never reaches our server. If the key must go through our server, keep it in memory for the request and never log or store it, and disclose that in onboarding.
3. **Do not build** the subscription-login bridge in any version, including a "local only" one, until Anthropic sales confirms the pattern in writing.

## Open questions for Anthropic sales

- Does a local companion app that calls the user's own API key, on the user's machine, count as the key owner's usage under the terms? (Expected yes, but confirm.)
- Is server-side proxying of a user's BYOK key permitted, and under which conditions?
- Limits on the Agent SDK when the user's key is supplied at runtime.

## Impact on the design (not yet applied)

- `LLMClient` gets a credential source: `operator` (option C) or `user_key` (option B). Only one is active per deployment.
- Onboarding gets an optional step: "Add your Anthropic API key to power your agents." The demo path uses option C and skips this step.
- PRD §7.5 and the cost section must state who pays for model calls per mode.
- No Claude subscription token is read, stored, or forwarded anywhere in the design.

## Sources

- [Legal and compliance (Claude Code docs)](https://code.claude.com/docs/en/legal-and-compliance) — primary source, read in full
- [Authentication (Claude Code docs)](https://code.claude.com/docs/en/authentication.md) — linked from the legal page, not read in this pass
- Secondary reports about a February 2026 policy update (blog posts and aggregators) were not used as evidence. The official page is the basis for this note.
