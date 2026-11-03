# FRICTION

What got in the way while building Aquahab on Walrus Memory and Tatum, and what we did about it. Written for
the Total Recall feedback fields and for anyone building the same stack.

| # | Friction | Where | What we did |
|---|---|---|---|
| 1 | `recall` can return 200 with no results when every blob fails to decrypt, which looks the same as "no memories" | Walrus Memory relayer ([#1036](https://github.com/MystenLabs/walrus-memory/issues/1036)) | Retry once, then cross-check the Keeper's ledger; a brief built from the ledger is marked `degraded` |
| 2 | `recall` can hang while the relayer builds a Seal session | relayer ([#1367](https://github.com/MystenLabs/walrus-memory/issues/1367)) | Our own 25 s timeout around every recall |
| 3 | The mainnet registry id is not in the SDK; account helpers need it | SDK `/account` | Read `packageId` and `registryId` from the relayer's public `GET /config` at run time |
| 4 | Account helpers ignore relayer sponsorship and need a funded owner key | SDK ([#1034](https://github.com/MystenLabs/walrus-memory/issues/1034)) | A new owner address funded with a little SUI; the owner key never leaves the CEO's machine |
| 5 | The dashboard can only generate delegate keys, not register a public key we generated | memory.walrus.xyz | Hire by script (`pnpm account hire-all`) with labelled keys |
| 6 | `SuiGrpcClient`'s default gRPC-web transport fails against Tatum's gateway | `@mysten/sui` × Tatum | Native HTTP/2 transport (`@protobuf-ts/grpc-transport` + `@grpc/grpc-js`) for transactions; raw `@grpc/grpc-js` with vendored protos for reads |
| 7 | Tatum's Sui JSON-RPC is gone; events have no gRPC query | Tatum gateway | GraphQL for events and the memory index, gRPC for objects and transactions |
| 8 | Recall has no tag filters and takes one namespace per call | relayer ([#1109](https://github.com/MystenLabs/walrus-memory/issues/1109)) | Type, room, date and author live in the memory text; three recalls per brief |
| 9 | `listMemories` filters namespaces client-side, so a page can be empty while `has_more` is true | SDK | Keep paginating on `has_more` |
| 10 | Idempotency keys are account-wide | relayer | Prefix `aq:<room>:` |
| 11 | No TS `forget()`, and REST forget clears a whole namespace | SDK ([#1043](https://github.com/MystenLabs/walrus-memory/issues/1043)) | Supersede with a newer memory tagged `[supersedes:<blob_id>]` |
| 12 | `MemWalMock` has no `listMemories` or `getPublicKeyHex` | SDK mock | Mock listings are synthesised from the Keeper's ledger |
| 13 | `delegateKeyToPublicKey` is async in 0.1.12 | SDK | Awaited everywhere |
| 14 | Relayer blob ids are base64url; the on-chain Blob stores a little-endian u256; event public keys are base64 while Agent IDs are hex | relayer × Sui | Conversions in `server/src/util.ts` and `server/src/chain/sui.ts` |
| 15 | `remember()` returns 202 and confirmation takes tens of seconds | relayer ([#1165](https://github.com/MystenLabs/walrus-memory/issues/1165)) | Never block a request: queue, poll status in the scheduler, push `memory.stored` over SSE |
