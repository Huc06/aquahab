// The only module that holds Walrus Memory clients. Each crew member is its own delegate key on the
// Aquahab MemWalAccount, so each gets its own MemWal client, and every write is signed by the member who
// files it. Reads (recall, list) can use any registered key; briefs read as One.
import { MemWal, MemWalMock } from "@mysten-incubation/memwal";
import type { MemorySummary, RecallMemory } from "@mysten-incubation/memwal";
import { ROLES, type Role } from "../contract.ts";
import { env } from "../env.ts";
import { q } from "../db.ts";
import { sleep, withTimeout } from "../util.ts";
import { emit } from "../events.ts";

type Client = MemWal | MemWalMock;

const clients = new Map<Role, Client>();
let mock: MemWalMock | null = null;

/** Tests and MEMORY_MODE=mock share one in-memory store across the whole crew. */
export function useMock(m: MemWalMock | null) {
  mock = m;
  clients.clear();
}

export const isMock = () => env.memoryMode() === "mock" || mock !== null;

/** Roles that have a delegate key configured on this server. */
export function hiredRoles(): Role[] {
  if (isMock()) return [...ROLES];
  return ROLES.filter((r) => !!env.roleKey(r));
}

/**
 * The client that signs for `role`. Falls back to the Keeper's key when that member has no key yet, so
 * the crew keeps working with a single key (cut order item 6); the author still appears in the text.
 */
export function clientFor(role: Role): { client: Client; signer: Role } {
  if (isMock()) {
    if (!mock) mock = MemWalMock.create({ owner: "0xmock" });
    return { client: mock, signer: role };
  }
  const signer: Role | undefined = env.roleKey(role) ? role : env.roleKey("keeper") ? "keeper" : hiredRoles()[0];
  if (!signer) throw new Error("No crew delegate key is configured (MEMWAL_KEY_<ROLE>). Run `pnpm keys` and `pnpm account hire-all`.");
  let c = clients.get(signer);
  if (!c) {
    c = MemWal.create({
      key: env.roleKey(signer)!,
      accountId: env.accountId(),
      serverUrl: env.relayerUrl(),
      recallTimeoutMs: 20_000,
    });
    clients.set(signer, c);
  }
  return { client: c, signer };
}

export async function publicKeyOf(role: Role): Promise<string | null> {
  const { client, signer } = clientFor(role);
  if (signer !== role || !("getPublicKeyHex" in client)) return null;
  return client.getPublicKeyHex();
}

// ---------- recall ----------

export interface RecallArgs {
  namespace: string;
  query: string;
  sort?: "relevance" | "recent";
  limit?: number;
  purpose: string;
  roomId: string | null;
  as?: Role;
}

export interface RecallOutcome {
  hits: RecallMemory[];
  ok: boolean;
  latencyMs: number;
  /** The relayer answered 200 with nothing, and a retry did not help (see FRICTION.md: empty recall). */
  emptyAnswer: boolean;
}

/**
 * Recall with our own timeout and one retry. An empty 200 can mean every blob failed to decrypt
 * (walrus-memory #1036), so empty is treated as "unknown" and retried once before it is believed.
 */
export async function recall(a: RecallArgs): Promise<RecallOutcome> {
  const { client } = clientFor(a.as ?? "one");
  const t0 = Date.now();
  const params = { query: a.query, namespace: a.namespace, limit: a.limit ?? 20, sort: a.sort ?? "relevance", timeoutMs: 20_000 } as const;
  let hits: RecallMemory[] = [];
  let ok = true;
  let emptyAnswer = false;
  try {
    let res = await withTimeout(client.recall({ ...params }), 25_000, "recall");
    if (!res.results.length) {
      await sleep(900);
      res = await withTimeout(client.recall({ ...params }), 25_000, "recall");
      emptyAnswer = !res.results.length;
    }
    hits = res.results;
  } catch (e) {
    ok = false;
    console.warn(`[recall] ${a.purpose} ${a.namespace}: ${(e as Error).message}`);
  }
  const latencyMs = Date.now() - t0;
  await q(
    `insert into recall_events (room_id, purpose, query, namespace, blob_ids, latency_ms, ok) values ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
    [a.roomId, a.purpose, a.query, a.namespace, JSON.stringify(hits.map((h) => h.blob_id)), latencyMs, ok],
  );
  // Remember what each blob says, so the memory wall can show text for writes made outside the Keeper
  // (Claude Code through the memwal plugin), which listMemories does not return.
  for (const h of hits) {
    await q(
      `insert into memory_texts (blob_id, namespace, text) values ($1,$2,$3)
       on conflict (blob_id) do update set text = excluded.text, seen_at = now()`,
      [h.blob_id, a.namespace, h.text],
    );
  }
  if (hits.length) await emit({ type: "recall.used", roomId: a.roomId ?? "ceo", blobIds: hits.map((h) => h.blob_id), purpose: a.purpose });
  return { hits, ok, latencyMs, emptyAnswer };
}

// ---------- listing ----------

/**
 * Every memory the relayer lists for one namespace, with blob id, signer (agent_id) and expiry.
 * `listMemories` filters namespaces client-side, so a page can be empty while `has_more` is true:
 * keep paginating.
 */
export async function listNamespace(namespace: string, maxPages = 20): Promise<MemorySummary[]> {
  if (isMock()) return ledgerListing(namespace);
  const { client } = clientFor("keeper");
  const out: MemorySummary[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const page = await (client as MemWal).listMemories({ namespace, limit: 200, cursor });
    out.push(...page.memories.filter((m) => m.namespace_id === namespace || !m.namespace_id));
    if (!page.has_more || !page.next_cursor) break;
    cursor = page.next_cursor;
  }
  return out;
}

/** Every memory on the account (all namespaces). */
export async function listAll(maxPages = 40): Promise<MemorySummary[]> {
  if (isMock()) return ledgerListing(null);
  const { client } = clientFor("keeper");
  const out: MemorySummary[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const page = await (client as MemWal).listMemories({ limit: 500, cursor });
    out.push(...page.memories);
    if (!page.has_more || !page.next_cursor) break;
    cursor = page.next_cursor;
  }
  return out;
}

async function ledgerListing(namespace: string | null): Promise<MemorySummary[]> {
  const rows = await q(
    `select * from memory_jobs where status = 'stored' and ($1::text is null or namespace = $1) order by stored_at asc`,
    [namespace],
  );
  return rows.map((r) => ({
    memory_id: r.id,
    namespace_id: r.namespace,
    blob_id: r.blob_id,
    created_at: new Date(r.stored_at).toISOString(),
    updated_at: new Date(r.stored_at).toISOString(),
    size: Buffer.byteLength(r.text),
    agent_id: `mock-${r.agent}`,
    package_id: null,
    status: "active",
    end_epoch: null,
    expires_at: null,
    importance: null,
  }));
}

export async function relayerHealth(): Promise<{ status: "ok" | "down"; writes: "ok" | "degraded" | "paused"; version: string | null }> {
  try {
    const { client } = clientFor("keeper");
    const h = await withTimeout(client.health(), 8_000, "health");
    const writes = h.write_ready === false ? "paused" : h.status === "ok" ? "ok" : "degraded";
    return { status: h.status === "ok" ? "ok" : "down", writes, version: h.version ?? null };
  } catch {
    return { status: "down", writes: "paused", version: null };
  }
}
