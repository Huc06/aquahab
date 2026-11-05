import { describe, expect, it } from "vitest";
import { CAPTURE_TYPES, helpHtml, MENU_ACTIONS, parseTimes, TIME_PRESETS, timesMarkup } from "../src/telegram.ts";

describe("New room and times choices", () => {
  it("parses a brief and debrief pair, one time, or private alone", () => {
    expect(parseTimes("08:30 21:00")).toEqual({ briefAt: "08:30", debriefAt: "21:00", private: false });
    expect(parseTimes("07:45")).toEqual({ briefAt: "07:45", debriefAt: undefined, private: false });
    expect(parseTimes("private")).toEqual({ private: true });
    expect(parseTimes("08:30 21:00 private")).toEqual({ briefAt: "08:30", debriefAt: "21:00", private: true });
  });

  it("rejects text that is not a time choice", () => {
    expect(parseTimes("7:45")).toBeNull();
    expect(parseTimes("25:00 21:00")).toBeNull();
    expect(parseTimes("tomorrow morning")).toBeNull();
  });

  it("every preset button fits Telegram's limit and is a known menu or time callback", () => {
    for (const row of timesMarkup().inline_keyboard) {
      for (const b of row) {
        expect(Buffer.byteLength(b.callback_data ?? "")).toBeLessThanOrEqual(64);
        const [kind, action] = (b.callback_data ?? "").split(":");
        if (kind === "m") expect(MENU_ACTIONS).toContain(action);
        if (kind === "tm") expect(b.callback_data).toMatch(/^tm:\d{4}:\d{4}$/);
      }
    }
  });

  it("the first preset is the room default used by createRoom", () => {
    expect(TIME_PRESETS[0]).toEqual(["08:30", "21:00"]);
  });

  it("the help reference lists every capture prefix and the /skip command", () => {
    const html = helpHtml();
    for (const [prefix] of CAPTURE_TYPES) expect(html).toContain(`<code>${prefix}</code>`);
    expect(html).toContain("/skip");
    expect(html).toContain("[private]");
  });
});
