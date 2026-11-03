// Tiny helpers for the local env files. Values are never printed by these helpers.
//   server/.env.local        what the server loads (delegate keys, Tatum, Telegram, LLM, secrets)
//   server/.env.owner.local  the account OWNER key: used only by `pnpm account` on the CEO's machine,
//                            never loaded by the server and never deployed
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ENV_LOCAL = path.join(SERVER_DIR, ".env.local");
export const ENV_OWNER = path.join(SERVER_DIR, ".env.owner.local");

export function readEnv(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return out;
}

/** Set keys in an env file, keeping every other line (and its comments) as it was. */
export function setEnv(file: string, values: Record<string, string>, header?: string) {
  const lines = existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/) : header ? [header, ""] : [];
  const pending = new Map(Object.entries(values));
  const next = lines.map((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (m && pending.has(m[1])) {
      const v = pending.get(m[1])!;
      pending.delete(m[1]);
      return `${m[1]}=${v}`;
    }
    return line;
  });
  while (next.length && next[next.length - 1] === "") next.pop();
  for (const [k, v] of pending) next.push(`${k}=${v}`);
  writeFileSync(file, `${next.join("\n")}\n`, { mode: 0o600 });
}
