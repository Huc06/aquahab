import { defineConfig } from "vitest/config";

// Tests never touch mainnet: the SDK's MemWalMock, an in-memory Postgres, no LLM, no Telegram, no Tatum.
export default defineConfig({
  test: {
    env: {
      MEMORY_MODE: "mock",
      PGLITE_DIR: "memory",
      APP_SECRET: "test-secret",
      AUTH: "off",
      SCHEDULER: "off",
      TELEGRAM_MODE: "off",
      CEO_TIMEZONE: "Asia/Ho_Chi_Minh",
      AI_GATEWAY_API_KEY: "",
      TATUM_API_KEY: "",
      TELEGRAM_BOT_TOKEN: "",
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
