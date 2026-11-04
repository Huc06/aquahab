# FACTS
Observed by `pnpm probe` on 2026-11-04T08:46:38.259Z. Read-only checks against Sui mainnet, the Walrus Memory relayer and Tatum.
- Walrus Blob type: `0xfdc88f7d7cf30afab2f82e8380d11ee8f70efb90e863d1de8616fae1bb09ea77::blob::Blob`
- MemWal package: `0xe7c16fbea0560e7057e2bf7422feaa4fb313749fc69c9e9092fac7a33b81d7f5`
- Aquahab MemWalAccount: `0x394fc2e4275efeb1b57a94eeff662c68fb2bd16a5d2e908e5fb475c9fd3ef986`
- Owner: `0x6ee7e4f6c38afdb845e4cd9315ec69c95536a1074ee3cff7a5fab1c3bfa69fad`
- Tatum calls made by this probe: 5
| Check | Result | Detail |
|---|---|---|
| Relayer health | pass | {"status":"ok","version":"0.1.0","relayerVersion":"0.1.0","apiVersion":"1.0.0","minSupportedSdk":{"typescript":"0.0.4"," (4010 ms) |
| Relayer config is mainnet MemWal | pass | network mainnet, registry 0x8bf82c9e09e36b8d1c38298f68b7cb68e7b8762887e7592add9986d5e9cf199f (1519 ms) |
| Tatum gateway methods | pass | {"sui-mainnet-graphql":{"url":"https://sui-mainnet.gateway.tatum.io/graphql","protocol":"GraphQL","methods":["mutation","query"]}} (1954 ms) |
| Tatum GraphQL with key | pass | chain 4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S, Sui epoch 1301 (686 ms) |
| Tatum native gRPC (@grpc/grpc-js) | pass | chain mainnet, epoch 1301, checkpoint 341502714 (6596 ms) |
| Tatum SuiGrpcClient (native transport) | pass | chain identifier 4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S (3263 ms) |
| Crew keys on this server | pass | 6: one 8a1f72ba…, researcher 1d8f12e2…, builder 743cee8e…, lofi 1a17f463…, hippo 42731058…, keeper 02c5a628… (0 ms) |
| MemWalAccount over Tatum gRPC | pass | owner 0x6ee7e4f6c38afdb845e4cd9315ec69c95536a1074ee3cff7a5fab1c3bfa69fad, 6 keys: One✓, Researcher✓, Builder✓, Lofi✓, Hippo✓, Walrus Keeper✓ (1484 ms) |
| Hire history over Tatum GraphQL events | pass | 6 events: hired One, hired Researcher, hired Builder, hired Lofi, hired Hippo, hired Walrus Keeper (534 ms) |
| Memory Blobs over Tatum GraphQL (namespace + agent id) | pass | 0 Blobs, 0 in aquahab namespaces (1176 ms) |
| Relayer roster (public endpoint) | pass | 6 keys: One, Researcher, Builder, Lofi, Hippo, Walrus Keeper (1888 ms) |
| listMemories as the Keeper (agent_id, end_epoch) | pass | 0 aquahab memories on this page (5134 ms) |
