// pnpm probe: the Day-1 checks against mainnet, read-only. Writes docs/FACTS.md with what was observed.
// Nothing here writes a memory or a transaction.
import "../src/net.ts"; // first: outbound HTTP settings
import { writeFileSync } from "node:fs";
import path from "node:path";
import { MemWal } from "@mysten-incubation/memwal";
import { env, MAINNET_RELAYER, MEMWAL_PACKAGE, WALRUS_BLOB_TYPE } from "../src/env.ts";
import { chainInfo, delegateKeyEvents, memwalAccount, ownedMemories } from "../src/chain/sui.ts";
import { gql, tatumCallCount, tatumSuiClient } from "../src/chain/tatum.ts";
import { configuredKeys } from "../src/views.ts";
import { SERVER_DIR } from "./envfile.ts";

const rows: { check: string; ok: boolean; detail: string }[] = [];
async function check(name: string, fn: () => Promise<string>) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    rows.push({ check: name, ok: true, detail: `${detail} (${Date.now() - t0} ms)` });
  } catch (e) {
    rows.push({ check: name, ok: false, detail: (e as Error).message.slice(0, 300) });
  }
  const r = rows[rows.length - 1];
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${name}: ${r.detail}`);
}

const accountId = env.accountIdOrNull();
const owner = env.ownerAddress();

await check("Relayer health", async () => JSON.stringify(await (await fetch(`${MAINNET_RELAYER}/health`)).json()).slice(0, 120));
await check("Relayer config is mainnet MemWal", async () => {
  const c: any = await (await fetch(`${MAINNET_RELAYER}/config`)).json();
  if (c.packageId !== MEMWAL_PACKAGE) throw new Error(`package ${c.packageId}`);
  return `network ${c.network}, registry ${c.registryId}`;
});
await check("Tatum gateway methods", async () => (await (await fetch("https://sui-mainnet.gateway.tatum.io/_methods")).text()).replace(/\s+/g, " ").slice(0, 160));
await check("Tatum GraphQL with key", async () => {
  const d = await gql<any>(`{ chainIdentifier epoch { epochId } }`);
  if (d.chainIdentifier !== "4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S") throw new Error(`unexpected chain ${d.chainIdentifier}`);
  return `chain ${d.chainIdentifier}, Sui epoch ${d.epoch?.epochId}`;
});
await check("Tatum native gRPC (@grpc/grpc-js)", async () => {
  const c = await chainInfo();
  return `chain ${c.chain}, epoch ${c.epoch}, checkpoint ${c.checkpoint}`;
});
await check("Tatum SuiGrpcClient (native transport)", async () => {
  const client = await tatumSuiClient();
  return `chain identifier ${(await client.core.getChainIdentifier()).chainIdentifier}`;
});
const keys = await configuredKeys();
await check("Crew keys on this server", async () => `${Object.keys(keys).length}: ${Object.entries(keys).map(([r, k]) => `${r} ${k!.slice(0, 8)}…`).join(", ")}`);
if (accountId) {
  await check("MemWalAccount over Tatum gRPC", async () => {
    const a = await memwalAccount(accountId);
    const mine = new Set(Object.values(keys));
    return `owner ${a.owner}, ${a.delegateKeys.length} keys: ${a.delegateKeys.map((k) => `${k.label}${mine.has(k.publicKeyHex) ? "✓" : ""}`).join(", ")}`;
  });
  if (owner) {
    await check("Hire history over Tatum GraphQL events", async () => {
      const ev = await delegateKeyEvents(owner, accountId);
      return `${ev.length} events: ${ev.map((e) => `${e.kind} ${e.label}`).join(", ") || "none"}`;
    });
    await check("Memory Blobs over Tatum GraphQL (namespace + agent id)", async () => {
      const m = await ownedMemories(owner);
      const ours = m.filter((x) => x.namespace?.startsWith("aquahab:"));
      const sample = ours[0];
      return `${m.length} Blobs, ${ours.length} in aquahab namespaces${sample ? `; e.g. ${sample.namespace} by ${sample.agentId?.slice(0, 8)}… end_epoch ${sample.endEpoch}` : ""}`;
    });
    await check("Relayer roster (public endpoint)", async () => {
      const r: any = await (await fetch(`${MAINNET_RELAYER}/api/accounts/${owner}/delegate-keys`)).json();
      return `${(r.keys ?? []).length} keys: ${(r.keys ?? []).map((k: any) => k.label).join(", ")}`;
    });
  }
  const keeperKey = env.roleKey("keeper");
  if (keeperKey) {
    await check("listMemories as the Keeper (agent_id, end_epoch)", async () => {
      const mw = MemWal.create({ key: keeperKey, accountId, serverUrl: env.relayerUrl() });
      const page = await mw.listMemories({ limit: 50 });
      const ours = page.memories.filter((x) => x.namespace_id?.startsWith("aquahab:"));
      const s = ours[0];
      return `${ours.length} aquahab memories on this page${s ? `; e.g. agent_id ${s.agent_id?.slice(0, 8)}… end_epoch ${s.end_epoch} expires ${s.expires_at}` : ""}`;
    });
  }
}

const md = [
  "# FACTS",
  "",
  `Observed by \`pnpm probe\` on ${new Date().toISOString()}. Read-only checks against Sui mainnet, the Walrus Memory relayer and Tatum.`,
  "",
  `- Walrus Blob type: \`${WALRUS_BLOB_TYPE}\``,
  `- MemWal package: \`${MEMWAL_PACKAGE}\``,
  accountId ? `- Aquahab MemWalAccount: \`${accountId}\`` : "- Aquahab MemWalAccount: not created yet",
  owner ? `- Owner: \`${owner}\`` : "",
  `- Tatum calls made by this probe: ${tatumCallCount()}`,
  "",
  "| Check | Result | Detail |",
  "|---|---|---|",
  ...rows.map((r) => `| ${r.check} | ${r.ok ? "pass" : "**fail**"} | ${r.detail.replace(/\|/g, "\\|")} |`),
  "",
].filter((l) => l !== "").join("\n");
writeFileSync(path.join(SERVER_DIR, "..", "docs", "FACTS.md"), `${md}\n`);
console.log(`\nWrote docs/FACTS.md (${rows.filter((r) => r.ok).length}/${rows.length} passed)`);
process.exit(rows.every((r) => r.ok) ? 0 : 1);
