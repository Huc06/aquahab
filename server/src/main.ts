// Long-lived entry point: HTTP API + scheduler + Telegram, in one process.
import "./net.ts"; // first: outbound HTTP settings
import { serve } from "@hono/node-server";
import { app } from "./app.ts";
import { env } from "./env.ts";
import { db } from "./db.ts";
import { startScheduler } from "./scheduler.ts";
import { startPolling, watchStored } from "./telegram.ts";
import { hiredRoles, isMock } from "./memory/walrus.ts";
import { seedMock } from "./mock-seed.ts";

// The submission must run on mainnet memory: refuse to deploy a mock, or an open write API.
if (process.env.NODE_ENV === "production") {
  if (env.memoryMode() === "mock") throw new Error("MEMORY_MODE=mock is for local development only. Refusing to start in production.");
  if (process.env.AUTH === "off") throw new Error("AUTH=off is for local development only. Refusing to start in production.");
}

await db();
if (isMock() && process.env.MOCK_SEED === "1") await seedMock();
watchStored();
if (env.schedulerEnabled()) startScheduler();
if (env.telegramMode() === "poll" && !env.telegramPairCode()) console.warn("[telegram] TELEGRAM_PAIR_CODE is not set: the bot stays off until it is.");
else if (env.telegramMode() === "poll") await startPolling().catch((e) => console.warn(`[telegram] ${(e as Error).message}`));

serve({ fetch: app.fetch, port: env.port() }, (info) => {
  console.log(`Aquahab crew server on http://localhost:${info.port}`);
  console.log(`  memory: ${isMock() ? "MOCK (in-memory, nothing reaches Walrus)" : `mainnet via ${env.relayerUrl()}`}`);
  console.log(`  crew keys: ${hiredRoles().join(", ") || "none (run pnpm keys)"}`);
  console.log(`  tatum: ${env.tatumKey() ? "key set" : "no key"} · llm: ${env.llmEnabled() ? `${env.llmProvider()} ${env.llmModel()}` : "off (fallbacks)"} · telegram: ${env.telegramMode()}`);
});
