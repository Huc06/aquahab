import { describe, expect, it } from "vitest";
import { CAPTURE_TYPES, MENU_ACTIONS, menuMarkup, onboardingMarkup } from "../src/telegram.ts";

const buttons = (m: { inline_keyboard: { text: string; callback_data?: string; url?: string }[][] }) => m.inline_keyboard.flat();

describe("telegram menu", () => {
  it("every menu callback is a known action and fits Telegram's 64-byte limit", () => {
    for (const b of [...buttons(menuMarkup()), ...buttons(onboardingMarkup())]) {
      if (!b.callback_data) continue;
      expect(Buffer.byteLength(b.callback_data)).toBeLessThanOrEqual(64);
      const [kind, action] = b.callback_data.split(":");
      if (kind === "m") expect(MENU_ACTIONS).toContain(action);
    }
  });

  it("capture type buttons carry their prefix in callback data", () => {
    for (const [prefix] of CAPTURE_TYPES) {
      expect(`c:${prefix}`.length).toBeLessThanOrEqual(64);
      expect(`c:${prefix}`.slice(2)).toBe(prefix);
    }
  });

  it("menu rows have at most two buttons each, except the full-width rows", () => {
    for (const row of menuMarkup().inline_keyboard) expect(row.length).toBeLessThanOrEqual(2);
  });
});
