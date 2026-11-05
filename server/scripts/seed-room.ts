// File a prepared set of memories into a room, for reproducible demo prep:
//
//   pnpm seed-room <room-slug> <file> [--api https://<office>] [--dry-run]
//
// Each line goes through the server's normal capture path: redacted, typed by its prefix, signed by the crew
// member that files that type, and written to Walrus mainnet. So every line must be true. One memory per
// line; blank lines and lines starting with # are skipped. Needs CEO_API_TOKEN (in .env.local).
import "../src/net.ts";
import { readFileSync } from "node:fs";
import type { MemoryJob, Room } from "../src/contract.ts";
import { env } from "../src/env.ts";
import { parseSeedFile } from "./seed-lib.ts";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const dryRun = args.includes("--dry-run");
const [slug, file] = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--api");
if (!slug || !file) throw new Error("Usage: pnpm seed-room <room-slug> <file> [--api https://<office>] [--dry-run]");

const { lines, errors } = parseSeedFile(readFileSync(file, "utf8"));
if (errors.length) throw new Error(`Fix the seed file first:\n${errors.join("\n")}`);
if (!lines.length) throw new Error("The seed file has no memories.");

const base = (flag("--api") ?? `http://localhost:${env.port()}`).replace(/\/+$/, "");
const token = process.env.CEO_API_TOKEN;
if (!token && !dryRun) throw new Error("Set CEO_API_TOKEN (the server's bearer for write endpoints).");

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const j = (await r.json().catch(() => ({}))) as any;
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${j.error ?? ""}`);
  return j as T;
}

const room = (await api<Room[]>("GET", "/api/rooms")).find((r) => r.slug === slug);
if (!room) throw new Error(`No room '${slug}' on ${base}. Create it first (Telegram ＋ New room, or the office).`);
console.log(`${dryRun ? "[dry run] " : ""}${lines.length} memories → ${room.name} (${room.namespace}) on ${base}`);
for (const l of lines) console.log(`  ${String(l.line).padStart(3)}  ${l.type.padEnd(10)} ${l.text.slice(0, 90)}`);
if (dryRun) process.exit(0);

const jobs: MemoryJob[] = [];
for (const l of lines) jobs.push(await api<MemoryJob>("POST", `/api/rooms/${room.id}/capture`, { text: l.text }));
console.log(`queued ${jobs.length}. The Keeper paces writes (about 3 s each); waiting for blob ids…`);

const deadline = Date.now() + Math.max(120_000, jobs.length * 20_000);
const done = new Map<string, MemoryJob>();
while (done.size < jobs.length && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 4000));
  for (const j of jobs) {
    if (done.has(j.jobId)) continue;
    const now = await api<MemoryJob>("GET", `/api/memory-jobs/${j.jobId}`);
    if (now.status === "stored" || now.status === "failed") {
      done.set(j.jobId, now);
      console.log(`  ${now.status === "stored" ? "stored" : "FAILED"}  ${now.type.padEnd(10)} ${now.blobId ?? now.error ?? ""}`);
    }
  }
}
const stored = [...done.values()].filter((j) => j.status === "stored").length;
console.log(`${stored}/${jobs.length} stored${done.size < jobs.length ? `; ${jobs.length - done.size} still pending (check /api/memory-jobs)` : ""}.`);
