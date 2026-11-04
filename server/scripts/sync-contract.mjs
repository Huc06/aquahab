// pnpm contract:sync copies the API contract to the web app; `--check` fails when the copies differ (CI).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "../src/contract.ts");
const dst = path.resolve(here, "../../web/src/lib/api-types.ts");
const banner = "// GENERATED from server/src/contract.ts by `pnpm contract:sync` in server/. Do not edit here.\n";
const want = banner + readFileSync(src, "utf8");

if (process.argv.includes("--check")) {
  let have = "";
  try {
    have = readFileSync(dst, "utf8");
  } catch {}
  if (have.replace(/\r\n/g, "\n") !== want.replace(/\r\n/g, "\n")) {
    console.error("web/src/lib/api-types.ts is out of date. Run `pnpm contract:sync` in server/.");
    process.exit(1);
  }
  console.log("API contract in sync.");
} else {
  writeFileSync(dst, want);
  console.log(`Wrote ${path.relative(process.cwd(), dst)}`);
}
