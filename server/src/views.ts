// Read models for the office. Each joins three sources: the server ledger (what the Keeper filed), the
// relayer (what Walrus Memory lists), and Sui read through Tatum (who is on the payroll, which memory Blobs
// exist, which key wrote each one). Where they disagree, the chain wins. Results are cached so the office
// can poll freely while Tatum sees at most a few calls a minute.
import { delegateKeyToPublicKey } from "@mysten-incubation/memwal";
import {
  CREW,
  ROLES,
  suiscanObject,
  walruscanBlob,
  type CrewMember,
  type CrewResponse,
  type HealthResponse,
  type Memory,
  type MemoryReceipt,
  type MemoriesResponse,
  type MemoryType,
  type ProofResponse,
  type Role,
  type Room,
} from "./contract.ts";
import { env } from "./env.ts";
import { cached, q } from "./db.ts";
import { blobMetadata, chainInfo, delegateKeyEvents, lastWrite, memwalAccount, ownedMemories, type ChainAccount, type ChainMemory } from "./chain/sui.ts";
import { TatumUnavailable } from "./chain/tatum.ts";
import { isMock, listAll, listNamespace, recall, relayerHealth } from "./memory/walrus.ts";
import { queueCounts } from "./memory/keeper.ts";
import { parseMemory } from "./memory/format.ts";
import { llmStatus } from "./llm.ts";
import { blobIdToU256 } from "./util.ts";

const roleByLabel = (label: string): Role | null => {
  const l = label.trim().toLowerCase();
  for (const r of ROLES) if (l === r || l === CREW[r].name.toLowerCase()) return r;
  if (l === "keeper") return "keeper";
  return null;
};

/** Public keys (Agent IDs) of the delegate keys this server holds, by role. */
export async function configuredKeys(): Promise<Partial<Record<Role, string>>> {
  const out: Partial<Record<Role, string>> = {};
  for (const r of ROLES) {
    const k = env.roleKey(r);
    if (k) out[r] = Buffer.from(await delegateKeyToPublicKey(k)).toString("hex");
  }
  return out;
}

async function relayerRoster(owner: string): Promise<ChainAccount | null> {
  const r = await fetch(`${env.relayerUrl()}/api/accounts/${owner}/delegate-keys`);
  if (!r.ok) return null;
  const j: any = await r.json();
  return {
    id: j.account_id,
    owner,
    active: true,
    delegateKeys: (j.keys ?? []).map((k: any) => ({ label: k.label, publicKeyHex: k.public_key, suiAddress: k.sui_address, createdAt: k.created_at ?? null })),
    version: null,
    previousTransaction: null,
  };
}

// ---------- the memory index on Sui ----------

interface ChainIndex {
  byU256: Record<string, ChainMemory>;
  checkedAt: string;
}

/**
 * The owner's memory Blobs on Sui, read through Tatum GraphQL and indexed by on-chain blob id. Each one
 * carries its namespace and the delegate key that wrote it (`memwal_agent_id`), so authorship and proof
 * need nothing from the relayer.
 */
export async function chainIndex(owner = env.ownerAddress()): Promise<ChainIndex | null> {
  if (isMock() || !env.tatumKey() || !owner) return null;
  return cached(`chain-memories:${owner}`, 60, async () => {
    const byU256: ChainIndex["byU256"] = {};
    for (const m of await ownedMemories(owner)) byU256[m.blobIdU256] = m;
    return { byU256, checkedAt: new Date().toISOString() };
  }).catch((e) => {
    console.warn(`[chain] ${(e as Error).message}`);
    return null;
  });
}

/** Memories per Agent ID: from the chain when Tatum answers, otherwise from the relayer listing. */
async function agentCounts(owner: string | null): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const index = await chainIndex(owner ?? undefined);
  if (index) {
    for (const m of Object.values(index.byU256)) {
      if (m.namespace?.startsWith("aquahab:") && m.agentId) counts.set(m.agentId, (counts.get(m.agentId) ?? 0) + 1);
    }
    return counts;
  }
  for (const m of await listAll().catch(() => [])) {
    if (m.namespace_id?.startsWith("aquahab:") && m.agent_id) counts.set(m.agent_id, (counts.get(m.agent_id) ?? 0) + 1);
  }
  return counts;
}

// ---------- the crew ----------

export async function crewView(): Promise<CrewResponse> {
  return cached("crew", 45, async () => {
    const accountId = env.accountIdOrNull() ?? "";
    let account: ChainAccount | null = null;
    let source: CrewResponse["source"] = "config";
    if (accountId && !isMock()) {
      try {
        account = await memwalAccount(accountId);
        source = "tatum-grpc";
      } catch (e) {
        if (!(e instanceof TatumUnavailable)) console.warn(`[crew] tatum: ${(e as Error).message}`);
        const owner = env.ownerAddress();
        account = owner ? await relayerRoster(owner).catch(() => null) : null;
        if (account) source = "relayer";
      }
    }
    const owner = account?.owner ?? env.ownerAddress() ?? "";
    const keys = await configuredKeys();
    const counts = new Map<string, number>();
    if (isMock()) {
      for (const r of await q(`select agent, count(*) as n from memory_jobs where status='stored' group by agent`)) counts.set(`mock-${r.agent}`, Number(r.n));
    } else {
      for (const [k, n] of await agentCounts(owner || null)) counts.set(k, n);
    }
    let history: CrewResponse["history"] = [];
    if (account && source === "tatum-grpc") {
      history = (await delegateKeyEvents(account.owner, accountId).catch(() => [])).map((e) => ({
        kind: e.kind,
        label: e.label ?? "",
        publicKey: e.publicKeyHex,
        at: e.at,
        tx: e.digest,
      }));
    }

    const agents: CrewMember[] = [];
    if (account) {
      for (const k of account.delegateKeys) {
        const role = (Object.entries(keys).find(([, pk]) => pk === k.publicKeyHex)?.[0] as Role | undefined) ?? roleByLabel(k.label);
        const hire = [...history].reverse().find((h) => h.kind === "hired" && (h.publicKey === k.publicKeyHex || h.label === k.label));
        agents.push({
          role,
          name: role ? CREW[role].name : k.label,
          title: role ? CREW[role].title : "Contractor",
          label: k.label,
          publicKey: k.publicKeyHex,
          suiAddress: k.suiAddress,
          hiredAt: k.createdAt,
          hireTx: hire?.tx ?? null,
          employed: true,
          memoryCount: counts.get(k.publicKeyHex) ?? 0,
        });
      }
    } else {
      // No chain answer: show the keys this server holds (mock mode shows the full crew).
      for (const role of ROLES) {
        const pk = keys[role];
        if (!pk && !isMock()) continue;
        agents.push({
          role,
          name: CREW[role].name,
          title: CREW[role].title,
          label: CREW[role].name,
          publicKey: pk ?? "",
          suiAddress: "",
          hiredAt: null,
          hireTx: null,
          employed: true,
          memoryCount: counts.get(isMock() ? `mock-${role}` : pk ?? "") ?? 0,
        });
      }
    }
    const employed = new Set(agents.map((a) => a.role).filter(Boolean));
    return {
      accountId,
      owner,
      agents,
      vacancies: ROLES.filter((r) => !employed.has(r)),
      history,
      source,
      checkedAt: new Date().toISOString(),
    };
  });
}

// ---------- the memory wall ----------

export async function memoriesView(room: Pick<Room, "id" | "namespace">): Promise<MemoriesResponse> {
  return cached(`memories:${room.namespace}`, 20, async () => {
    const [listed, crew, index] = await Promise.all([listNamespace(room.namespace), crewView(), chainIndex()]);
    const ids = listed.map((m) => m.blob_id);
    const texts = new Map<string, string>();
    const loadTexts = async () => {
      if (!ids.length) return;
      for (const r of await q(`select blob_id, text from memory_texts where blob_id = any($1::text[])`, [ids])) texts.set(r.blob_id, r.text);
    };
    await loadTexts();
    // listMemories carries no text. On a fresh database (a new machine, a new deploy) or for a write made
    // outside the Keeper (Claude Code), recall the room once: recall() stores every hit's text.
    if (ids.some((id) => !texts.has(id))) {
      await recall({ namespace: room.namespace, query: "project memory: decisions, failures, next steps, deadlines", sort: "recent", limit: Math.min(100, ids.length * 2), purpose: "wall", roomId: room.id, as: "keeper" });
      await loadTexts();
    }
    const labelOf = new Map(crew.agents.map((a) => [a.publicKey, a.label]));
    const memories: Memory[] = listed.map((m) => {
      const raw = texts.get(m.blob_id) ?? null;
      const p = raw ? parseMemory(raw) : null;
      const chain = index?.byU256[blobIdToU256(m.blob_id)];
      const agentId = chain?.agentId ?? m.agent_id; // the chain's word wins
      return {
        blobId: m.blob_id,
        type: p?.type ?? null,
        text: p ? p.body : null,
        agent: p?.by ?? null,
        agentId,
        agentLabel: agentId ? (labelOf.get(agentId) ?? null) : null,
        roomId: room.id,
        namespace: room.namespace,
        createdAt: m.created_at,
        expiresAt: m.expires_at,
        endEpoch: chain?.endEpoch ?? m.end_epoch ?? null,
        blobObjectId: chain?.objectId ?? null,
        verified: !!chain && (!chain.namespace || chain.namespace === room.namespace),
        checkedAt: index?.checkedAt ?? null,
        supersedes: p?.supersedes ?? null,
        supersededBy: null,
        imported: p?.imported ?? false,
      };
    });
    const byBlob = new Map(memories.map((m) => [m.blobId, m]));
    for (const m of memories) if (m.supersedes && byBlob.has(m.supersedes)) byBlob.get(m.supersedes)!.supersededBy = m.blobId;
    memories.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const counts: Partial<Record<MemoryType, number>> = {};
    for (const m of memories) if (m.type) counts[m.type] = (counts[m.type] ?? 0) + 1;
    return {
      roomId: room.id,
      namespace: room.namespace,
      memories,
      counts,
      verifiedCount: memories.filter((m) => m.verified).length,
      checkedAt: new Date().toISOString(),
    };
  });
}

/** One memory's receipt, read from Sui through Tatum: Blob object, on-chain namespace and author, write tx. */
export async function receiptView(blobId: string): Promise<MemoryReceipt> {
  return cached(`receipt:${blobId}`, 300, async () => {
    const u256 = blobIdToU256(blobId);
    const hit = (await chainIndex())?.byU256[u256];
    let namespaceOnChain = hit?.namespace ?? null;
    let last: Awaited<ReturnType<typeof lastWrite>> = hit?.tx ? { digest: hit.tx, checkpoint: hit.checkpoint, at: hit.at } : null;
    if (hit && !namespaceOnChain) namespaceOnChain = (await blobMetadata(hit.objectId).catch(() => ({ namespace: null }))).namespace;
    if (hit && !last) last = await lastWrite(hit.objectId).catch(() => null);
    return {
      blobId,
      blobIdU256: u256,
      blobObjectId: hit?.objectId ?? null,
      namespaceOnChain,
      endEpoch: hit?.endEpoch ?? null,
      size: hit?.size ?? null,
      lastTx: last?.digest ?? null,
      checkpoint: last?.checkpoint ?? null,
      storedAt: last?.at ?? null,
      links: { suiscan: hit ? suiscanObject(hit.objectId) : null, walruscan: walruscanBlob(blobId) },
    };
  });
}

// ---------- health and proof ----------

export async function healthView(): Promise<HealthResponse> {
  return cached("health", 15, async () => {
    const t0 = Date.now();
    const tatum = await chainInfo()
      .then((c) => ({ ok: true, epoch: c.epoch, checkpoint: c.checkpoint, latencyMs: Date.now() - t0 }))
      .catch(() => ({ ok: false, epoch: null, checkpoint: null, latencyMs: null }));
    return {
      mode: isMock() ? "mock" : "mainnet",
      relayer: await relayerHealth(),
      tatum,
      llm: llmStatus(),
      queue: await queueCounts(),
      checkedAt: new Date().toISOString(),
    };
  });
}

/** Relayer and chain counted independently, per room and per employee. */
export async function proofView(): Promise<ProofResponse> {
  return cached("proof", 120, async () => {
    const [all, crew, index] = await Promise.all([isMock() ? listAll() : listAll().catch(() => []), crewView(), chainIndex()]);
    const ours = all.filter((m) => m.namespace_id?.startsWith("aquahab:"));
    const byNs = new Map<string, { relayer: number; onChain: number }>();
    for (const m of ours) {
      const e = byNs.get(m.namespace_id) ?? { relayer: 0, onChain: 0 };
      e.relayer++;
      byNs.set(m.namespace_id, e);
    }
    const byAgent = new Map<string, number>();
    let onChain = 0;
    for (const c of Object.values(index?.byU256 ?? {})) {
      if (!c.namespace?.startsWith("aquahab:")) continue;
      onChain++;
      const e = byNs.get(c.namespace) ?? { relayer: 0, onChain: 0 };
      e.onChain++;
      byNs.set(c.namespace, e);
      if (c.agentId) byAgent.set(c.agentId, (byAgent.get(c.agentId) ?? 0) + 1);
    }
    if (!index) for (const m of ours) if (m.agent_id) byAgent.set(m.agent_id, (byAgent.get(m.agent_id) ?? 0) + 1);
    const labelOf = new Map(crew.agents.map((a) => [a.publicKey, a.label]));
    return {
      accountId: crew.accountId,
      owner: crew.owner,
      memories: ours.length,
      onChain,
      byNamespace: [...byNs.entries()].map(([namespace, x]) => ({ namespace, ...x })).sort((a, b) => b.relayer - a.relayer),
      byAgent: [...byAgent.entries()].map(([publicKey, memories]) => ({ publicKey, label: labelOf.get(publicKey) ?? "unknown", memories })).sort((a, b) => b.memories - a.memories),
      firstMemoryAt: ours.map((m) => m.created_at).sort()[0] ?? null,
      checkedAt: new Date().toISOString(),
    };
  });
}
