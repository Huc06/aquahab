import { describe, expect, it } from "vitest";
import { formatMemory, guessType, parseCapture, parseMemory, redact } from "../src/memory/format.ts";
import { blobIdToU256, dayIndex, u256ToBlobId } from "../src/util.ts";
import { isDue } from "../src/scheduler.ts";

describe("memory line format", () => {
  it("round-trips type, room, date, author and supersedes", () => {
    const line = formatMemory({ type: "failure", room: "aquahab", date: "2026-11-03", by: "builder", supersedes: "abc", body: "SuiGrpcClient fails against Tatum gRPC" });
    expect(line).toBe("[failure][aquahab][2026-11-03][by:builder][supersedes:abc] SuiGrpcClient fails against Tatum gRPC");
    const p = parseMemory(line);
    expect(p).toMatchObject({ type: "failure", room: "aquahab", date: "2026-11-03", by: "builder", supersedes: "abc", body: "SuiGrpcClient fails against Tatum gRPC" });
  });

  it("reads free text written by another agent without inventing fields", () => {
    const p = parseMemory("Claude Code: refactored the keeper queue");
    expect(p.type).toBeNull();
    expect(p.by).toBeNull();
    expect(p.body).toBe("Claude Code: refactored the keeper queue");
  });

  it("parses quick-capture prefixes", () => {
    expect(parseCapture("d: use Tatum GraphQL for events")).toEqual({ type: "decision", body: "use Tatum GraphQL for events" });
    expect(parseCapture("F: CI broke on pnpm 9")).toEqual({ type: "failure", body: "CI broke on pnpm 9" });
    expect(parseCapture("done: shipped the brief")).toEqual({ type: "done", body: "shipped the brief" });
    expect(parseCapture("due: submit by 10 Nov 12:00 UTC").type).toBe("deadline");
    expect(parseCapture("just a note").type).toBeNull();
  });

  it("guesses a type without the model", () => {
    expect(guessType("the deploy failed on Vercel")).toBe("failure");
    expect(guessType("we decided to go with Hono")).toBe("decision");
    expect(guessType("shipped the review panel")).toBe("done");
  });
});

describe("redaction before every write", () => {
  it("removes credentials but keeps public on-chain ids", () => {
    const addr = `0x${"ab".repeat(32)}`;
    const { text, removed } = redact(
      `key t-0123456789abcdef01234567-89abcdef0123456789abcdef bot 1234567890:AAFakeTokenForTestsOnly_abcdefghijk delegate ${"cd".repeat(32)} mail me@x.io package ${addr}`,
    );
    expect(text).not.toContain("t-0123");
    expect(text).not.toContain("AAFake");
    expect(text).not.toContain("cdcd");
    expect(text).not.toContain("me@x.io");
    expect(text).toContain(addr);
    expect(removed).toBe(4);
  });
});

describe("Walrus blob ids", () => {
  it("converts relayer base64url ids to the on-chain little-endian u256 and back", () => {
    const id = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1)).toString("base64url");
    const u = blobIdToU256(id);
    expect(BigInt(u) & 0xffn).toBe(1n); // first byte is the least significant
    expect(u256ToBlobId(u)).toBe(id);
  });
});

describe("schedule", () => {
  it("fires once the local time passes, within a grace window", () => {
    expect(isDue("08:30", { hour: 8, minute: 29 })).toBe(false);
    expect(isDue("08:30", { hour: 8, minute: 30 })).toBe(true);
    expect(isDue("08:30", { hour: 11, minute: 30 })).toBe(true);
    expect(isDue("08:30", { hour: 11, minute: 31 })).toBe(false);
  });
  it("counts days from the room's first day", () => {
    expect(dayIndex("2026-11-03", "2026-11-03")).toBe(1);
    expect(dayIndex("2026-11-03", "2026-11-10")).toBe(8);
  });
});
