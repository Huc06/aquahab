// One-time cut-over: copy the local ledger (PGlite) into the deployed Postgres, so the deployed server keeps
// the rooms (and their day count), the briefs (day one included), the board, the debriefs and the Telegram
// pairing. Memories themselves live on Walrus and need no copy.
//
//   1. stop the local server (PGlite allows one process per data directory)
//   2. DATABASE_URL=<the Postgres public URL> pnpm db:copy [--from ./data/pglite]
//
// Re-running is safe: rows that already exist are skipped.
import "../src/net.ts";
import { existsSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { closeDb, q } from "../src/db.ts";
import { env } from "../src/env.ts";
import { TABLES, insertSql, rowParams } from "./db-copy-lib.ts";

const fromFlag = process.argv.indexOf("--from");
const from = fromFlag > 0 ? process.argv[fromFlag + 1] : env.pgliteDir();

if (!env.databaseUrl()) throw new Error("Set DATABASE_URL to the target Postgres (the deployed database's public URL).");
if (!from || from === "memory" || !existsSync(from)) throw new Error(`No local PGlite directory at ${from}. Pass --from <dir>.`);
const running = await fetch(`http://localhost:${env.port()}/api/health`, { signal: AbortSignal.timeout(2000) }).then(() => true, () => false);
if (running) throw new Error(`A server answers on localhost:${env.port()}. Stop it first: PGlite allows one process per directory.`);

const src = new PGlite(from);
console.log(`copying ${from} → ${env.databaseUrl()!.replace(/\/\/[^@]*@/, "//***@")}`);

for (const t of TABLES) {
  const rows = (await src.query<Record<string, unknown>>(`select * from ${t.name}${t.where ? ` where ${t.where}` : ""}`)).rows;
  if (t.appendOnly) {
    const [{ n }] = await q<{ n: number }>(`select count(*)::int as n from ${t.name}`);
    if (n > 0) {
      console.log(`  ${t.name}: target already has ${n} rows, skipped`);
      continue;
    }
  }
  let copied = 0;
  for (const row of rows) {
    const cols = Object.keys(row).filter((c) => !t.skip?.includes(c));
    const res = await q(insertSql(t, cols), rowParams(t, cols, row));
    copied += res.length;
  }
  console.log(`  ${t.name}: ${copied} copied, ${rows.length - copied} already there`);
}

await src.close();
await closeDb();
console.log("done. Start the deployed server; it reads the same rooms, briefs and pairing.");
