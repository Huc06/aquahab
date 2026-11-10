// What Aquahab reads from Sui through Tatum:
//   - the payroll: the MemWalAccount object's delegate keys (label, public key, hire time)
//   - the hire/fire history: DelegateKeyAdded / DelegateKeyRemoved events, from Tatum's checkpoint floor up
//   - every memory's Walrus Blob object: blob id, size, storage.end_epoch, and its memwal_namespace metadata
//   - the receipt: the transaction and checkpoint that last wrote a Blob
import { MEMWAL_PACKAGE, WALRUS_BLOB_TYPE } from "../env.ts";
import { emptyToken, gql, grpcCall, pbValue } from "./tatum.ts";

export async function chainInfo(): Promise<{ chain: string | null; epoch: string | null; checkpoint: string | null }> {
  const r: any = await grpcCall("ledger", "GetServiceInfo", {});
  return { chain: r.chain ?? null, epoch: r.epoch ?? null, checkpoint: r.checkpoint_height ?? null };
}

export interface ChainDelegateKey {
  label: string;
  publicKeyHex: string;
  suiAddress: string;
  createdAt: string | null;
}

export interface ChainAccount {
  id: string;
  owner: string;
  active: boolean;
  delegateKeys: ChainDelegateKey[];
  version: string | null;
  previousTransaction: string | null;
}

const toHex = (v: unknown): string => {
  if (Array.isArray(v)) return Buffer.from(v.map(Number)).toString("hex"); // GraphQL may render vector<u8> as numbers
  if (typeof v !== "string") return "";
  if (/^(0x)?[0-9a-f]+$/i.test(v) && v.replace(/^0x/, "").length === 64) return v.replace(/^0x/, "").toLowerCase();
  return Buffer.from(v, "base64").toString("hex"); // vector<u8> arrives base64-encoded in the JSON view
};

const ms = (v: unknown) => (v == null ? null : new Date(Number(v)).toISOString());

/** The MemWalAccount object, read over native gRPC (LedgerService/GetObject). */
export async function memwalAccount(accountId: string): Promise<ChainAccount> {
  const r: any = await grpcCall("ledger", "GetObject", {
    object_id: accountId,
    read_mask: { paths: ["object_id", "version", "object_type", "json", "previous_transaction"] },
  });
  const o = r.object;
  if (!o?.object_type?.includes("::account::MemWalAccount")) throw new Error(`${accountId} is not a MemWalAccount (${o?.object_type ?? "not found"})`);
  const j = pbValue(o.json) ?? {};
  return {
    id: o.object_id,
    owner: j.owner,
    active: j.active !== false,
    delegateKeys: (j.delegate_keys ?? []).map((k: any) => ({
      label: String(k.label ?? ""),
      publicKeyHex: toHex(k.public_key),
      suiAddress: k.sui_address,
      createdAt: ms(k.created_at),
    })),
    version: o.version ?? null,
    previousTransaction: o.previous_transaction ?? null,
  };
}

export interface ChainBlob {
  objectId: string;
  blobIdU256: string;
  size: number;
  endEpoch: number | null;
  certifiedEpoch: number | null;
}

/** Every Walrus Blob object owned by the account owner (StateService/ListOwnedObjects, paginated). */
export async function ownedBlobs(owner: string, maxPages = 20): Promise<ChainBlob[]> {
  const out: ChainBlob[] = [];
  let page_token: any = undefined;
  for (let i = 0; i < maxPages; i++) {
    const r: any = await grpcCall("state", "ListOwnedObjects", {
      owner,
      page_size: 500,
      page_token,
      object_type: WALRUS_BLOB_TYPE,
      read_mask: { paths: ["object_id", "json"] },
    });
    for (const o of r.objects ?? []) {
      const j = pbValue(o.json) ?? {};
      out.push({
        objectId: o.object_id,
        blobIdU256: String(j.blob_id),
        size: Number(j.size ?? 0),
        endEpoch: j.storage?.end_epoch != null ? Number(j.storage.end_epoch) : null,
        certifiedEpoch: j.certified_epoch != null ? Number(j.certified_epoch) : null,
      });
    }
    if (emptyToken(r.next_page_token)) break;
    page_token = r.next_page_token;
  }
  return out;
}

/** Find a `key → value` pair anywhere in a decoded Move value (VecMap entries are `{key, value}`). */
function findEntry(v: any, key: string): string | null {
  if (!v || typeof v !== "object") return null;
  if (Array.isArray(v)) {
    for (const x of v) {
      const f = findEntry(x, key);
      if (f) return f;
    }
    return null;
  }
  if (v.key === key && typeof v.value === "string") return v.value;
  if (typeof v[key] === "string") return v[key];
  for (const x of Object.values(v)) {
    const f = findEntry(x, key);
    if (f) return f;
  }
  return null;
}

/** The Blob's metadata dynamic field, which the relayer fills with `memwal_namespace` and `memwal_owner`. */
export async function blobMetadata(blobObjectId: string): Promise<{ namespace: string | null; owner: string | null; agentId: string | null }> {
  const r: any = await grpcCall("state", "ListDynamicFields", {
    parent: blobObjectId,
    page_size: 10,
    read_mask: { paths: ["field_id", "value_type", "field_object"] },
  });
  for (const f of r.dynamic_fields ?? []) {
    const j = pbValue(f.field_object?.json);
    const namespace = findEntry(j, "memwal_namespace");
    if (namespace) return { namespace, owner: findEntry(j, "memwal_owner"), agentId: findEntry(j, "memwal_agent_id") };
  }
  return { namespace: null, owner: null, agentId: null };
}

/** The transaction that last wrote an object, with its checkpoint and time (GetObject → GetTransaction). */
export async function lastWrite(objectId: string): Promise<{ digest: string; checkpoint: string | null; at: string | null } | null> {
  const o: any = await grpcCall("ledger", "GetObject", { object_id: objectId, read_mask: { paths: ["object_id", "previous_transaction"] } });
  const digest = o.object?.previous_transaction;
  if (!digest) return null;
  const t: any = await grpcCall("ledger", "GetTransaction", { digest, read_mask: { paths: ["digest", "checkpoint", "timestamp"] } });
  const ts = t.transaction?.timestamp;
  const at = ts?.seconds ? new Date(Number(ts.seconds) * 1000 + Math.floor(Number(ts.nanos ?? 0) / 1e6)).toISOString() : null;
  return { digest, checkpoint: t.transaction?.checkpoint ?? null, at };
}

export interface KeyEvent {
  kind: "hired" | "fired";
  label: string | null;
  publicKeyHex: string | null;
  at: string | null;
  digest: string | null;
}

// Tatum's GraphQL index keeps checkpoints from a floor up. An events query with no lower bound reaches below
// it and fails with "Failed to list events" (OutOfRange: lowest available checkpoint is N). So the query names
// the floor, and a failure that reports a higher floor is retried once from there.
let eventFloor = 237_661_232; // Tatum's lowest available checkpoint on 10 Nov 2026

/** The higher floor a Tatum OutOfRange error reports, or null when the error is about something else. */
export function reportedFloor(message: string, floor: number): number | null {
  const n = Number(message.match(/lowest available checkpoint is (\d+)/)?.[1]);
  return Number.isSafeInteger(n) && n > floor ? n : null;
}

/**
 * Hire and fire history in one GraphQL query: every `account` event the owner signed (events have no gRPC
 * query on Tatum). Event public keys arrive base64; Agent IDs are hex.
 */
export async function delegateKeyEvents(owner: string, accountId: string): Promise<KeyEvent[]> {
  const list = (after: number) =>
    gql<any>(
      `query($t: String!, $s: SuiAddress!) {
        events(last: 50, filter: { type: $t, sender: $s, afterCheckpoint: ${after} }) {
          nodes { timestamp contents { type { repr } json } transaction { digest } }
        }
      }`,
      { t: `${MEMWAL_PACKAGE}::account`, s: owner },
    );
  let d: any;
  try {
    d = await list(eventFloor);
  } catch (e) {
    const higher = reportedFloor((e as Error).message, eventFloor);
    if (higher === null) throw e;
    eventFloor = higher;
    d = await list(eventFloor);
  }
  const out: KeyEvent[] = [];
  for (const n of d.events?.nodes ?? []) {
    const type = String(n.contents?.type?.repr ?? "");
    const kind = type.endsWith("::DelegateKeyAdded") ? "hired" : type.endsWith("::DelegateKeyRemoved") ? "fired" : null;
    if (!kind) continue;
    const j = n.contents?.json ?? {};
    if (j.account_id && j.account_id !== accountId) continue;
    out.push({ kind, label: j.label ?? null, publicKeyHex: j.public_key ? toHex(j.public_key) : null, at: n.timestamp ?? null, digest: n.transaction?.digest ?? null });
  }
  return out.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

export interface ChainMemory {
  objectId: string;
  blobIdU256: string;
  size: number;
  endEpoch: number | null;
  namespace: string | null; // Blob metadata `memwal_namespace`
  agentId: string | null; // Blob metadata `memwal_agent_id`: the delegate key that wrote it
  tx: string | null;
  checkpoint: string | null;
  at: string | null;
}

/**
 * Every memory Blob the owner holds, with its on-chain authorship, in one paginated GraphQL query:
 * contents (blob_id, size, storage.end_epoch), the metadata dynamic field (memwal_namespace,
 * memwal_agent_id) and the transaction that wrote it. This is the office's independent view of memory:
 * it needs nothing from the relayer.
 */
export async function ownedMemories(owner: string, maxPages = 30): Promise<ChainMemory[]> {
  const out: ChainMemory[] = [];
  let after: string | null = null;
  for (let i = 0; i < maxPages; i++) {
    const d: any = await gql(
      `query($o: SuiAddress!, $t: String!, $after: String) {
        address(address: $o) {
          objects(first: 20, after: $after, filter: { type: $t }) {
            pageInfo { hasNextPage endCursor }
            nodes {
              address
              contents { json }
              previousTransaction { digest effects { timestamp checkpoint { sequenceNumber } } }
              dynamicFields { nodes { name { json } value { ... on MoveValue { json } } } }
            }
          }
        }
      }`,
      { o: owner, t: WALRUS_BLOB_TYPE, after },
    );
    const page = d.address?.objects;
    for (const n of page?.nodes ?? []) {
      const j = n.contents?.json ?? {};
      const meta = n.dynamicFields?.nodes ?? [];
      const effects = n.previousTransaction?.effects;
      out.push({
        objectId: n.address,
        blobIdU256: String(j.blob_id),
        size: Number(j.size ?? 0),
        endEpoch: j.storage?.end_epoch != null ? Number(j.storage.end_epoch) : null,
        namespace: findEntry(meta, "memwal_namespace"),
        agentId: findEntry(meta, "memwal_agent_id"),
        tx: n.previousTransaction?.digest ?? null,
        checkpoint: effects?.checkpoint?.sequenceNumber != null ? String(effects.checkpoint.sequenceNumber) : null,
        at: effects?.timestamp ?? null,
      });
    }
    if (!page?.pageInfo?.hasNextPage) break;
    after = page.pageInfo.endCursor;
  }
  return out;
}
