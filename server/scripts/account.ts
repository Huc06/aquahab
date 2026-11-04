// pnpm account <command>: the CEO's payroll desk. Every command here is an on-chain act signed by the
// account owner key (server/.env.owner.local, never deployed), submitted through Tatum's Sui gRPC gateway
// with @mysten/sui's SuiGrpcClient on the native transport.
//
//   status            owner address, SUI balance, account id, who is on the payroll (read from Sui)
//   create            create the Aquahab MemWalAccount (one per Sui address)
//   hire-all          register every crew member's delegate key that is not on the account yet
//   hire <role>       register one crew member (label = its name, e.g. "Builder")
//   fire <role>       remove one crew member's key: it can no longer write, or read anything filed after
//   hire-contractor <label> <publicKeyHex>   register an outside key (e.g. a Claude Code plugin key)
//
// Add --direct to use Mysten's public fullnode instead of Tatum.
import "../src/net.ts"; // first: outbound HTTP settings
import { addDelegateKey, createAccount, removeDelegateKey } from "@mysten-incubation/memwal/account";
import { delegateKeyToPublicKey } from "@mysten-incubation/memwal";
import { CREW, ROLES, suiscanObject, suiscanTx, type Role } from "../src/contract.ts";
import { MAINNET_RELAYER, MEMWAL_PACKAGE } from "../src/env.ts";
import { memwalAccount } from "../src/chain/sui.ts";
import { tatumSuiClient } from "../src/chain/tatum.ts";
import { ENV_LOCAL, ENV_OWNER, readEnv, setEnv } from "./envfile.ts";

const [cmd = "status", arg, arg2] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const direct = process.argv.includes("--direct");

const owner = readEnv(ENV_OWNER);
if (!owner.OWNER_SUI_PRIVATE_KEY) {
  console.error("No owner key. Run `pnpm keys` first.");
  process.exit(1);
}
const local = () => readEnv(ENV_LOCAL);
process.env.TATUM_API_KEY ??= local().TATUM_API_KEY;

const cfg = (await (await fetch(`${process.env.MEMWAL_SERVER_URL ?? MAINNET_RELAYER}/config`)).json()) as { packageId: string; registryId: string; network: string };
if (cfg.network !== "mainnet" || cfg.packageId !== MEMWAL_PACKAGE) {
  console.error(`Relayer config is not the mainnet package we expect: ${JSON.stringify(cfg)}`);
  process.exit(1);
}

const viaTatum = !direct && !!process.env.TATUM_API_KEY;
const suiClient = viaTatum ? await tatumSuiClient() : undefined;
const base = { packageId: cfg.packageId, registryId: cfg.registryId, suiPrivateKey: owner.OWNER_SUI_PRIVATE_KEY, suiNetwork: "mainnet" as const, ...(suiClient ? { suiClient } : {}) };
const route = viaTatum ? "via Tatum gRPC" : "via Mysten fullnode";

const pubOf = async (role: Role) => {
  const k = local()[`MEMWAL_KEY_${role.toUpperCase()}`];
  if (!k) throw new Error(`No key for ${role}. Run \`pnpm keys\`.`);
  return Buffer.from(await delegateKeyToPublicKey(k)).toString("hex");
};

const asRole = (s: string | undefined): Role => {
  const r = (s ?? "").toLowerCase() as Role;
  if (!ROLES.includes(r)) {
    console.error(`Role is one of: ${ROLES.join(", ")}`);
    process.exit(1);
  }
  return r;
};

async function onChainKeys(): Promise<Set<string>> {
  const accountId = local().MEMWAL_ACCOUNT_ID;
  if (!accountId) return new Set();
  if (process.env.TATUM_API_KEY) return new Set((await memwalAccount(accountId)).delegateKeys.map((k) => k.publicKeyHex));
  const r: any = await (await fetch(`${MAINNET_RELAYER}/api/accounts/${owner.AQUAHAB_OWNER_ADDRESS}/delegate-keys`)).json();
  return new Set((r.keys ?? []).map((k: any) => k.public_key));
}

async function hire(role: Role) {
  const accountId = local().MEMWAL_ACCOUNT_ID;
  if (!accountId) throw new Error("No account yet. Run `pnpm account create`.");
  const publicKey = await pubOf(role);
  const r = await addDelegateKey({ ...base, accountId, publicKey, label: CREW[role].name });
  console.log(`Hired ${CREW[role].name} (${publicKey}) ${route}: ${suiscanTx(r.digest)}`);
}

switch (cmd) {
  case "status": {
    console.log(`Owner        ${owner.AQUAHAB_OWNER_ADDRESS}`);
    if (suiClient) {
      const b = await suiClient.getBalance({ owner: owner.AQUAHAB_OWNER_ADDRESS });
      console.log(`Balance      ${(Number(b.balance.balance) / 1e9).toFixed(4)} SUI (read ${route})`);
    }
    const accountId = local().MEMWAL_ACCOUNT_ID;
    console.log(`Account      ${accountId ? suiscanObject(accountId) : "not created (pnpm account create)"}`);
    if (accountId) {
      const keys = await onChainKeys();
      const crewKeys = new Set<string>();
      for (const role of ROLES) {
        const pk = await pubOf(role).catch(() => null);
        if (pk) crewKeys.add(pk);
        console.log(`  ${CREW[role].name.padEnd(14)} ${pk && keys.has(pk) ? "on payroll" : "not hired "}  ${pk ?? ""}`);
      }
      const others = [...keys].filter((k) => !crewKeys.has(k)).length;
      if (others) console.log(`  + ${others} other key(s) on the account (contractors, e.g. Claude Code)`);
    }
    break;
  }
  case "create": {
    if (local().MEMWAL_ACCOUNT_ID) {
      console.log(`Account already exists: ${local().MEMWAL_ACCOUNT_ID}`);
      break;
    }
    const r = await createAccount(base);
    setEnv(ENV_LOCAL, { MEMWAL_ACCOUNT_ID: r.accountId });
    console.log(`Created MemWalAccount ${r.accountId} for ${r.owner} ${route}`);
    console.log(`  tx ${suiscanTx(r.digest)}`);
    break;
  }
  case "hire-all": {
    const keys = await onChainKeys();
    for (const role of ROLES) {
      if (keys.has(await pubOf(role))) {
        console.log(`${CREW[role].name} is already on the payroll.`);
        continue;
      }
      await hire(role);
    }
    break;
  }
  case "hire":
    await hire(asRole(arg));
    break;
  case "fire": {
    const role = asRole(arg);
    const accountId = local().MEMWAL_ACCOUNT_ID!;
    const r = await removeDelegateKey({ ...base, accountId, publicKey: await pubOf(role) });
    console.log(`Fired ${CREW[role].name} ${route}: ${suiscanTx(r.digest)}`);
    break;
  }
  case "hire-contractor": {
    if (!arg || !arg2 || !/^[0-9a-f]{64}$/i.test(arg2)) {
      console.error("Usage: pnpm account hire-contractor \"Contractor: Claude Code\" <64-hex public key>");
      process.exit(1);
    }
    const r = await addDelegateKey({ ...base, accountId: local().MEMWAL_ACCOUNT_ID!, publicKey: arg2.toLowerCase(), label: arg.slice(0, 64) });
    console.log(`Hired contractor "${arg}" ${route}: ${suiscanTx(r.digest)}`);
    break;
  }
  default:
    console.error(`Unknown command ${cmd}. See the header of scripts/account.ts.`);
    process.exit(1);
}
process.exit(0);
