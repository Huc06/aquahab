# S+ — Walrus Memory Lifecycle, Privacy, Ownership

## Memory Lifecycle

Aquahab must not assume memories are permanently stored.

Walrus Memory persists a memory only for the number of Walrus epochs paid for.

On Mainnet, an epoch is approximately two weeks; on Testnet, approximately one

day. When paid epochs expire and the underlying blob is not renewed, Walrus

drops the blob and the memory disappears.

Therefore, Aquahab must define:

- Initial storage duration for every memory.

- Who pays for storage.

- Whether renewal is automatic or manual.

- What happens in the UI when a memory expires.

- Whether expired memories are hidden, archived, or deleted from the Vault.

## MVP Storage Policy

For the hackathon MVP:

- Store memories for a fixed demo-safe duration, for example 53 epochs where

  supported, or the maximum practical duration allowed by the SDK.

- Treat memory expiry as a first-class UI state:

  - `active`

  - `expiring_soon`

  - `expired`

  - `renewal_required`

- Do not silently hide expired memories.

- If a memory expires, show:

  - “This memory expired because its Walrus storage epoch ended.”

  - A renewal action when supported.

- The company owner is responsible for renewal in MVP.

- Do not claim permanent memory unless automatic renewal is implemented and

  funded.

## Cost Model

Walrus storage is paid per encoded storage unit per epoch, plus a one-time

write fee per blob. Cost scales with blob size and the number of epochs.

For MVP:

- Track estimated storage cost per memory.

- Show an estimated company memory-storage cost in the Memory Vault.

- Define a spending cap for demo accounts.

- Prevent unbounded memory creation in a single demo session.

- Log:

  - number of memories stored

  - total blob size

  - paid epochs

  - estimated WAL cost

  - renewal status

## Privacy and Encryption

Walrus blobs are public and discoverable by default. Walrus does not provide

native encryption; confidential data must be encrypted client-side before

storage, for example with Seal. The blob ID should be treated as public.

Aquahab privacy rules:

- All CEO preferences, feedback, decisions, and sensitive company context are

  confidential by default.

- Memory plaintext must never be uploaded directly to Walrus.

- Use Walrus Memory’s Seal-encrypted memory flow.

- Only the memory owner or an authorized delegate may decrypt a memory.

- Treat every Walrus blob ID as public metadata.

- Never place secrets, API keys, private keys, or raw credentials in memory.

- Add a redaction layer before `remember()`:

  - remove API keys

  - remove private keys

  - remove wallet seed phrases

  - remove obvious personal identifiers unless the CEO explicitly chooses to

    store them

- The Memory Vault must distinguish:

  - encrypted memory content

  - public Walrus blob metadata

  - public proof links

## Ownership and Portability

A Walrus Memory space is bounded by:

\`\`\`text

owner address + namespace + app\_id

\`\`\`

The owner is the Sui wallet address recorded by the MemWal account. Access to

decrypt memories is governed by Seal policy: the data owner or a registered

delegate may decrypt, provided the account is active.

Aquahab ownership rules:

- Each CEO owns their company memory space.

- Each agent has a namespace inside the CEO-owned company memory space.

- The CEO’s Sui wallet address is the memory owner.

- Agent identities do not own memories; they operate within the CEO-owned

  memory space.

- Support delegated access for agents where the SDK supports it.

- The CEO must be able to:

  - view all memories in their company

  - export memory metadata

  - revoke agent access where supported

  - delete unwanted memories

  - understand what happens if they lose access to their wallet

For MVP, define the account-recovery limitation explicitly:

- If the CEO loses their wallet and has no delegate/recovery mechanism, they

  may lose access to encrypted memories.

- Do not promise account recovery that Walrus Memory does not provide.

## Memory Metrics

Aquahab must prove that memory actually affects missions.

Track these metrics:

| Metric | Definition | MVP target |

|---|---|---|

| Memory recall rate | Percentage of agent tasks that recall at least one relevant memory | ≥ 80% for repeat missions |

| Recall latency | Time from recall request to memories returned | ≤ 3–5 seconds |

| Remember settle time | Time from `remember()` to confirmed blob/job completion | Track and display |

| Memory influence rate | Percentage of completed tasks whose prompt included recalled memory | ≥ 80% for repeat missions |

| Memory storage success rate | Successful `remember()` jobs / total attempts | ≥ 95% |

| Expired memory rate | Expired memories / total memories | Track; target 0 during demo |

| Feedback-to-memory rate | CEO feedback events that become memories | 100% |

| Mission improvement signal | Human-rated before/after output quality | Positive for demo mission |

## Onboarding Flow

The first-run experience must get a new CEO from zero to their first stored

memory quickly.

\`\`\`text

1. Connect wallet / create demo CEO

2. Name company

3. Choose starter agents

4. Assign first mission

5. Watch agents recall or create memory

6. Give feedback

7. See first memory appear in Aqua Memory Vault

8. Run the same mission type again

9. See improved, memory-aware output

\`\`\`

MVP onboarding target:

- Time to first mission: under 60 seconds.

- Time to first stored memory: under 2 minutes.

- Time to first memory-aware repeat mission: under 5 minutes.

The onboarding should include a guided demo mission:

\`\`\`text

“Plan a Sui wallet launch for Vietnam.”

\`\`\`

## Dependencies and Owners

| Dependency | Owner | Purpose | Risk | Mitigation |

|---|---|---|---|---|

| Walrus Memory SDK | Memory integration owner | Store, recall, analyze memories | API changes, latency, expiry | Pin SDK version; add health check and fallback |

| Walrus storage funding | Product/infra owner | Pay for memory epochs | Memory expiry | Define demo storage budget and renewal policy |

| Seal encryption | Security/privacy owner | Client-side encryption and access policy | Key/access misconfiguration | Use SDK default encrypted flow; do not upload plaintext |

| Tatum AI Builder | AI integration owner | Agent reasoning/output generation | Latency, prompt drift, cost | Structured prompts, retries, fallback output |

| Tatum Sui RPC/Data | Blockchain integration owner | Sui connectivity and proof/data reads | Endpoint/rate limits | Cache read-only data; handle rate limits |

| Sui wallet / identity | Auth owner | CEO identity and memory ownership | Wallet loss, delegate setup | Clear ownership UI and delegate documentation |

| 3D HQ frontend | Frontend owner | Office, desks, task UI | Performance and scope creep | One scene, low-poly assets, no open world |