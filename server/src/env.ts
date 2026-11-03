// Server configuration. Every secret is server-only: the hosted Walrus relayer rejects browser origins,
// and the delegate keys sign every memory, so they never leave this process.
import type { Role } from "./contract.ts";

const read = (name: string) => {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
};

const need = (name: string) => {
  const v = read(name);
  if (!v) throw new Error(`Missing env ${name} (see server/.env.example)`);
  return v;
};

export const MEMWAL_PACKAGE = "0xe7c16fbea0560e7057e2bf7422feaa4fb313749fc69c9e9092fac7a33b81d7f5";
export const WALRUS_BLOB_TYPE = "0xfdc88f7d7cf30afab2f82e8380d11ee8f70efb90e863d1de8616fae1bb09ea77::blob::Blob";
export const MAINNET_RELAYER = "https://relayer.memory.walrus.xyz";

export const env = {
  port: () => Number(read("PORT") ?? 8787),
  /** "mock" runs the whole server against the SDK's in-memory MemWalMock. Never deployed (see guard in main.ts). */
  memoryMode: (): "mainnet" | "mock" => (read("MEMORY_MODE") === "mock" ? "mock" : "mainnet"),
  relayerUrl: () => read("MEMWAL_SERVER_URL") ?? MAINNET_RELAYER,
  accountId: () => need("MEMWAL_ACCOUNT_ID"),
  accountIdOrNull: () => read("MEMWAL_ACCOUNT_ID") ?? null,
  ownerAddress: () => read("AQUAHAB_OWNER_ADDRESS") ?? null,
  /** Delegate private key (hex) of one crew member, or undefined when that member is not hired yet. */
  roleKey: (role: Role) => read(`MEMWAL_KEY_${role.toUpperCase()}`),
  tatumKey: () => read("TATUM_API_KEY"),
  llmModel: () => read("LLM_MODEL") ?? "anthropic/claude-sonnet-5.5",
  llmFastModel: () => read("LLM_FAST_MODEL") ?? "anthropic/claude-haiku-5.5",
  llmEnabled: () => !!(read("AI_GATEWAY_API_KEY") || read("VERCEL_OIDC_TOKEN")),
  telegramToken: () => read("TELEGRAM_BOT_TOKEN"),
  telegramMode: (): "poll" | "webhook" | "off" => {
    const m = read("TELEGRAM_MODE");
    if (m === "webhook" || m === "off") return m;
    return read("TELEGRAM_BOT_TOKEN") ? "poll" : "off";
  },
  telegramWebhookSecret: () => read("TELEGRAM_WEBHOOK_SECRET"),
  /** One-time code the CEO sends as `/start <code>` to bind their Telegram chat. */
  telegramPairCode: () => read("TELEGRAM_PAIR_CODE"),
  appSecret: () => need("APP_SECRET"),
  appUrl: () => read("APP_URL") ?? "http://localhost:3000",
  cronSecret: () => read("CRON_SECRET"),
  timezone: () => read("CEO_TIMEZONE") ?? "Asia/Ho_Chi_Minh",
  databaseUrl: () => read("DATABASE_URL"),
  pgliteDir: () => read("PGLITE_DIR") ?? "./data/pglite",
  /** Run the scheduler loop inside this process (long-lived hosts). Serverless hosts call /api/cron/tick instead. */
  schedulerEnabled: () => read("SCHEDULER") !== "off",
};
