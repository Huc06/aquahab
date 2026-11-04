// pnpm keys: generate the Aquahab account owner (a new Sui address) and one Ed25519 delegate key per crew
// member. Existing keys are never overwritten. Prints only public values.
import "../src/net.ts"; // first: outbound HTTP settings
import { randomBytes } from "node:crypto";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { generateDelegateKey } from "@mysten-incubation/memwal/account";
import { CREW, ROLES } from "../src/contract.ts";
import { ENV_LOCAL, ENV_OWNER, readEnv, setEnv } from "./envfile.ts";

const local = readEnv(ENV_LOCAL);
const owner = readEnv(ENV_OWNER);
const rand = (n: number) => randomBytes(n).toString("base64url");

if (!owner.OWNER_SUI_PRIVATE_KEY) {
  const kp = Ed25519Keypair.generate();
  setEnv(
    ENV_OWNER,
    { OWNER_SUI_PRIVATE_KEY: kp.getSecretKey(), AQUAHAB_OWNER_ADDRESS: kp.getPublicKey().toSuiAddress() },
    "# Aquahab account OWNER key. Signs hires and fires only. Keep it on the CEO's machine: never commit, never deploy.",
  );
  console.log("Generated a new owner address.");
}
const ownerAddress = readEnv(ENV_OWNER).AQUAHAB_OWNER_ADDRESS;

const updates: Record<string, string> = {};
const fresh: string[] = [];
for (const role of ROLES) {
  const name = `MEMWAL_KEY_${role.toUpperCase()}`;
  if (local[name]) continue;
  const k = await generateDelegateKey();
  updates[name] = k.privateKey;
  fresh.push(role);
}
updates.AQUAHAB_OWNER_ADDRESS = ownerAddress;
if (!local.APP_SECRET) updates.APP_SECRET = rand(32);
if (!local.CRON_SECRET) updates.CRON_SECRET = rand(24);
if (!local.CEO_API_TOKEN) updates.CEO_API_TOKEN = rand(24);
if (!local.TELEGRAM_PAIR_CODE) updates.TELEGRAM_PAIR_CODE = rand(6);
if (!local.TELEGRAM_WEBHOOK_SECRET) updates.TELEGRAM_WEBHOOK_SECRET = rand(24);
setEnv(ENV_LOCAL, updates, "# Aquahab server secrets. Never commit. See .env.example for every variable.");

const { delegateKeyToPublicKey } = await import("@mysten-incubation/memwal");
const env = readEnv(ENV_LOCAL);
console.log(`\nOwner (Sui address, fund it with ~0.5 SUI): ${ownerAddress}`);
console.log("Crew delegate keys (public keys; each is a MEMWAL_AGENT_ID candidate):");
for (const role of ROLES) {
  const pk = Buffer.from(await delegateKeyToPublicKey(env[`MEMWAL_KEY_${role.toUpperCase()}`])).toString("hex");
  console.log(`  ${CREW[role].name.padEnd(14)} ${pk}${fresh.includes(role) ? "  (new)" : ""}`);
}
console.log("\nNext: send SUI to the owner address, then `pnpm account create` and `pnpm account hire-all`.");
