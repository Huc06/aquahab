import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const hmac = (key: string, s: string) => createHmac("sha256", key).update(s).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const newId = (prefix: string) => `${prefix}_${randomBytes(6).toString("base64url")}`;

/** Reject after `ms`. Recall can hang while the relayer builds a Seal session (walrus-memory #1367). */
export async function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t);
  }
}

// ---------- Walrus blob ids ----------
// The relayer returns blob ids as base64url strings. The on-chain Walrus Blob stores the same 32 bytes as a
// little-endian u256 (decimal string in JSON). Convert before matching.

export function blobIdToU256(b64url: string): string {
  const bytes = Buffer.from(b64url, "base64url");
  let n = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]);
  return n.toString();
}

export function u256ToBlobId(decimal: string): string {
  let n = BigInt(decimal);
  const out = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out.toString("base64url");
}

// ---------- local time ----------

/** Parts of `date` in an IANA timezone. */
export function localParts(date: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}

export const isHHMM = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Whole days between two local dates (YYYY-MM-DD), plus one: the day a room is created is day 1. */
export function dayIndex(startLocalDate: string, todayLocalDate: string): number {
  const a = Date.parse(`${startLocalDate}T00:00:00Z`);
  const b = Date.parse(`${todayLocalDate}T00:00:00Z`);
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
