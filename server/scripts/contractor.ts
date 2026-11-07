// pnpm contractor <command>: Claude Code as a contractor on the Aquahab payroll.
//
// The contractor holds its own delegate key (server/.env.contractor.local: never committed, never deployed),
// so every memory it files carries that key on Sui, next to the crew's. The CEO hires it on-chain with
// `pnpm account hire-contractor "Contractor: Claude Code" <public key>` and fires it the same way
// (`pnpm account fire-contractor <public key>`). Its writes go straight to Walrus Memory, not through the
// server's Keeper: the CEO's approval is the hire, and firing the key ends it.
//
//   keygen                      create the contractor key once; prints the public key and the hire command
//   remember <room-slug> "<line>" [--api https://<office>] [--dry-run]
//                               file one true line into the room, in the crew's memory format, signed by the
//                               contractor key. The line starts with its type: d: f: n: done: l: due: s:
import "../src/net.ts"; // first: outbound HTTP settings
import path from "node:path";
import { MemWal } from "@mysten-incubation/memwal";
import { generateDelegateKey } from "@mysten-incubation/memwal/account";
import { walruscanBlob, type Room } from "../src/contract.ts";
import { env } from "../src/env.ts";
import { formatMemory, parseCapture, redact } from "../src/memory/format.ts";
import { localParts, sha256 } from "../src/util.ts";
import { ENV_LOCAL, readEnv, SERVER_DIR, setEnv } from "./envfile.ts";

export const ENV_CONTRACTOR = path.join(SERVER_DIR, ".env.contractor.local");
export const CONTRACTOR_LABEL = "Contractor: Claude Code";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const [cmd, slug, line] = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--api");
const dryRun = args.includes("--dry-run");

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

switch (cmd) {
  case "keygen": {
    const have = readEnv(ENV_CONTRACTOR);
    if (have.CONTRACTOR_MEMWAL_KEY) {
      console.log(`The contractor key already exists: ${have.CONTRACTOR_PUBLIC_KEY}`);
    } else {
      const k = await generateDelegateKey();
      setEnv(
        ENV_CONTRACTOR,
        { CONTRACTOR_MEMWAL_KEY: k.privateKey, CONTRACTOR_PUBLIC_KEY: hex(k.publicKey) },
        "# Aquahab CONTRACTOR delegate key (Claude Code). Never commit, never deploy. Fire it with `pnpm account fire-contractor`.",
      );
      console.log(`Created the contractor key: ${hex(k.publicKey)}`);
    }
    console.log(`Hire it (owner key, on-chain): pnpm account hire-contractor "${CONTRACTOR_LABEL}" ${readEnv(ENV_CONTRACTOR).CONTRACTOR_PUBLIC_KEY}`);
    break;
  }
  case "remember": {
    if (!slug || !line) throw new Error('Usage: pnpm contractor remember <room-slug> "done: …" [--api https://<office>] [--dry-run]');
    const parsed = parseCapture(line);
    if (!parsed.type) throw new Error("Start the line with its type: d: f: n: done: l: due: s:");
    if (parsed.type === "preference" || parsed.type === "feedback") throw new Error("Preferences and feedback are the CEO's, not a contractor's.");
    const { text: body } = redact(parsed.body);
    if (!body || body === "[removed]") throw new Error("Nothing left to remember after redaction.");

    const base = (flag("--api") ?? `http://localhost:${env.port()}`).replace(/\/+$/, "");
    const rooms = (await (await fetch(`${base}/api/rooms`, { signal: AbortSignal.timeout(30_000) })).json()) as Room[];
    const room = rooms.find((r) => r.slug === slug);
    if (!room) throw new Error(`No room '${slug}' on ${base}.`);

    const date = localParts(new Date(), env.timezone()).date;
    const text = formatMemory({ type: parsed.type, room: room.slug, date, by: "contractor", body });
    // The same key formula as the Keeper's, so the same memory is never filed twice, whoever files it.
    const idempotencyKey = `aq:${room.slug}:${sha256(`${room.namespace}|${parsed.type}|${body.toLowerCase()}`).slice(0, 16)}`;
    console.log(`${dryRun ? "[dry run] " : ""}${room.namespace} ← ${text}`);
    if (dryRun) break;

    const key = readEnv(ENV_CONTRACTOR).CONTRACTOR_MEMWAL_KEY;
    if (!key) throw new Error("No contractor key. Run `pnpm contractor keygen`, then hire it.");
    const accountId = process.env.MEMWAL_ACCOUNT_ID ?? readEnv(ENV_LOCAL).MEMWAL_ACCOUNT_ID;
    if (!accountId) throw new Error("No MEMWAL_ACCOUNT_ID in .env.local.");
    const memwal = MemWal.create({ key, accountId, serverUrl: env.relayerUrl(), preflightTimeoutMs: 15_000 });
    const r = await memwal.rememberAndWait(text, room.namespace, { idempotencyKey });
    console.log(`Stored on Walrus, signed by the contractor key: ${r.blob_id}`);
    console.log(`  ${walruscanBlob(r.blob_id)}`);
    break;
  }
  default:
    console.error("Usage: pnpm contractor keygen | remember <room-slug> \"<line>\" [--api <office>] [--dry-run]. See the header of scripts/contractor.ts.");
    process.exit(1);
}
process.exit(0);
