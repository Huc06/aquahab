// One CEO. The office is public to read (judges and visitors see the real rooms, crew and receipts);
// anything that writes needs the CEO: a magic link from the Telegram bot sets a signed cookie.
import { getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { env } from "./env.ts";
import { hmac, safeEqual } from "./util.ts";

const COOKIE = "aq_ceo";
const DAYS = 30;

export function signSession(expiresAtMs: number): string {
  return `${expiresAtMs}.${hmac(env.appSecret(), `ceo:${expiresAtMs}`).slice(0, 32)}`;
}

export function verifySession(token: string | undefined | null): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, hmac(env.appSecret(), `ceo:${exp}`).slice(0, 32));
}

/** A one-tap login link for the CEO, valid for 15 minutes; the cookie it sets lasts 30 days. */
export function magicLink(): string {
  const exp = Date.now() + 15 * 60_000;
  return `${env.appUrl()}/api/auth/magic?t=${encodeURIComponent(signSession(exp))}`;
}

export function startSession(c: Context) {
  const exp = Date.now() + DAYS * 86_400_000;
  setCookie(c, COOKIE, signSession(exp), {
    httpOnly: true,
    sameSite: "Lax",
    secure: env.appUrl().startsWith("https://"),
    path: "/",
    maxAge: DAYS * 86_400,
  });
}

export function isCeo(c: Context): boolean {
  if (process.env.AUTH === "off") return true; // local development only; main.ts refuses this in production
  const bearer = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const apiToken = process.env.CEO_API_TOKEN;
  if (bearer && apiToken && safeEqual(bearer, apiToken)) return true;
  return verifySession(getCookie(c, COOKIE));
}
