import { describe, expect, it } from "vitest";
import { insertSql, rowParams, TABLES } from "../scripts/db-copy-lib.ts";
import { acceptUpdate, webhookUrl } from "../src/telegram.ts";

const table = (name: string) => TABLES.find((t) => t.name === name)!;

describe("db copy", () => {
  it("sends jsonb as JSON text, so strings and arrays round-trip", () => {
    const t = table("settings");
    expect(insertSql(t, ["key", "value"])).toBe("insert into settings (key, value) values ($1, $2::jsonb) on conflict do nothing returning 1");
    expect(rowParams(t, ["key", "value"], { key: "telegram.room", value: "room_abc" })).toEqual(["telegram.room", '"room_abc"']);
    expect(rowParams(table("briefs"), ["sections"], { sections: [{ agent: "one" }] })).toEqual(['[{"agent":"one"}]']);
  });

  it("keeps timestamps and nulls, and skips the polling offset and bigserial ids", () => {
    const at = new Date("2026-11-04T08:48:03.706Z");
    expect(rowParams(table("rooms"), ["created_at", "goal"], { created_at: at, goal: null })).toEqual(["2026-11-04T08:48:03.706Z", null]);
    expect(table("settings").where).toContain("telegram.offset");
    expect(table("recall_events").skip).toEqual(["id"]);
    expect(TABLES.map((t) => t.name)).not.toContain("events");
  });
});

describe("telegram webhook", () => {
  it("defaults to the office proxy at APP_URL", () => {
    process.env.APP_URL = "https://aquahab.example.app/";
    delete process.env.TELEGRAM_WEBHOOK_URL;
    expect(webhookUrl()).toBe("https://aquahab.example.app/telegram/webhook");
    process.env.TELEGRAM_WEBHOOK_URL = "https://server.example.app/telegram/webhook";
    expect(webhookUrl()).toBe("https://server.example.app/telegram/webhook");
    delete process.env.TELEGRAM_WEBHOOK_URL;
    delete process.env.APP_URL;
  });

  it("drops an update Telegram resends", () => {
    expect(acceptUpdate({ update_id: 9001 })).toBe(true);
    expect(acceptUpdate({ update_id: 9001 })).toBe(false);
    expect(acceptUpdate({})).toBe(true);
  });
});
