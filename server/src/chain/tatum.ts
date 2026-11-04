// Tatum is how Aquahab reads Sui mainnet. Tatum's Sui JSON-RPC is gone (the gateway serves GraphQL and
// gRPC only), and @mysten/sui's SuiGrpcClient speaks gRPC-web, which Tatum's gateway does not accept.
// So: native gRPC (sui.rpc.v2) through @grpc/grpc-js for objects and transactions, and GraphQL for
// events, which have no gRPC query. Server-only; the key travels as `x-api-key`.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../env.ts";
import { sleep } from "../util.ts";

export const TATUM_GRAPHQL = "https://sui-mainnet.gateway.tatum.io/graphql";
export const TATUM_GRPC = "sui-mainnet-grpc.gateway.tatum.io:443";

const PROTO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../proto");

export class TatumUnavailable extends Error {}

const key = () => {
  const k = env.tatumKey();
  if (!k) throw new TatumUnavailable("TATUM_API_KEY is not set");
  return k;
};

// Free plan: 3 requests/second and 100K lifetime credits. One token bucket for both transports keeps
// Aquahab at ~2 req/s; the office polls the server (which caches), never Tatum directly.
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + 500;
  if (at > now) await sleep(at - now);
}

let calls = 0;
export const tatumCallCount = () => calls;

export async function gql<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await throttle();
    calls++;
    const r = await fetch(TATUM_GRAPHQL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key() },
      body: JSON.stringify({ query, variables }),
    });
    if (r.status === 429) {
      await sleep(1200 * (attempt + 1));
      continue;
    }
    const text = await r.text();
    let j: any;
    try {
      j = JSON.parse(text);
    } catch {
      throw new Error(`tatum graphql ${r.status}: ${text.slice(0, 200)}`);
    }
    if (j.errors?.length) throw new Error(`tatum graphql: ${j.errors[0].message}`);
    return j.data as T;
  }
  throw new Error("tatum graphql: rate limited");
}

// ---------- native gRPC ----------

type Svc = "ledger" | "state";
let grpcClients: Promise<{ ledger: any; state: any; md: any }> | null = null;

function grpc() {
  if (!grpcClients) {
    grpcClients = (async () => {
      const grpcJs = await import("@grpc/grpc-js");
      const loader = await import("@grpc/proto-loader");
      const def = loader.loadSync(["sui/rpc/v2/ledger_service.proto", "sui/rpc/v2/state_service.proto"], {
        includeDirs: [PROTO_ROOT],
        keepCase: true,
        longs: String,
        enums: String,
        defaults: false,
        oneofs: true,
      });
      const pkg: any = (grpcJs.loadPackageDefinition(def) as any).sui.rpc.v2;
      const creds = grpcJs.credentials.createSsl();
      const md = new grpcJs.Metadata();
      md.set("x-api-key", key());
      return { ledger: new pkg.LedgerService(TATUM_GRPC, creds), state: new pkg.StateService(TATUM_GRPC, creds), md };
    })();
  }
  return grpcClients;
}

export async function grpcCall<T = any>(svc: Svc, method: string, req: unknown): Promise<T> {
  const c = await grpc();
  for (let attempt = 0; attempt < 3; attempt++) {
    await throttle();
    calls++;
    try {
      return await new Promise<T>((resolve, reject) =>
        c[svc][method](req, c.md, { deadline: Date.now() + 15_000 }, (e: any, r: T) => (e ? reject(e) : resolve(r))),
      );
    } catch (e: any) {
      if (e?.code === 8 /* RESOURCE_EXHAUSTED */ || /429|exceeded/i.test(String(e?.details))) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      throw new Error(`tatum grpc ${method}: ${e?.details ?? e?.message ?? e}`);
    }
  }
  throw new Error(`tatum grpc ${method}: rate limited`);
}

/** google.protobuf.Value (as decoded by proto-loader) → plain JSON. */
export function pbValue(v: any): any {
  if (!v || typeof v !== "object") return v;
  switch (v.kind) {
    case "structValue":
      return Object.fromEntries(Object.entries(v.structValue?.fields ?? {}).map(([k, x]) => [k, pbValue(x)]));
    case "listValue":
      return (v.listValue?.values ?? []).map(pbValue);
    case "stringValue":
      return v.stringValue;
    case "numberValue":
      return v.numberValue;
    case "boolValue":
      return v.boolValue;
    case "nullValue":
      return null;
    default:
      return null;
  }
}

export const emptyToken = (t: any) => !t || (Buffer.isBuffer(t) && t.length === 0) || (typeof t === "string" && !t);

// ---------- the official client, for transactions ----------

let suiClient: Promise<any> | null = null;

/**
 * @mysten/sui's SuiGrpcClient on the native HTTP/2 transport, pointed at Tatum. (The default gRPC-web
 * transport is what Tatum's gateway rejects.) Used to sign and execute hires and fires through Tatum.
 */
export function tatumSuiClient(): Promise<any> {
  if (!suiClient) {
    suiClient = (async () => {
      const [{ SuiGrpcClient }, { GrpcTransport }, { ChannelCredentials }] = await Promise.all([
        import("@mysten/sui/grpc"),
        import("@protobuf-ts/grpc-transport"),
        import("@grpc/grpc-js"),
      ]);
      return new SuiGrpcClient({
        network: "mainnet",
        transport: new GrpcTransport({
          host: TATUM_GRPC,
          channelCredentials: ChannelCredentials.createSsl(),
          meta: { "x-api-key": key() },
        }),
      });
    })();
  }
  return suiClient;
}
