// The office reads /api/events through the web app's proxy (Next rewrites). Next gzips a proxied response unless
// it says no-transform, which holds the events in the gzip buffer, and it sends no headers before the first body
// byte. So the stream must be marked no-transform and open with a byte at once.
import { afterAll, expect, it } from "vitest";
import { app } from "../src/app.ts";
import { closeDb } from "../src/db.ts";

afterAll(closeDb);

it("opens the event stream at once, and proxies must not compress it", async () => {
  const r = await app.request("/api/events");
  expect(r.headers.get("content-type")).toBe("text/event-stream");
  expect(r.headers.get("cache-control")).toContain("no-transform");
  const reader = r.body!.getReader();
  const first = await Promise.race([reader.read(), new Promise<null>((done) => setTimeout(() => done(null), 1000))]);
  expect(first && new TextDecoder().decode(first.value)).toMatch(/^:/);
  await reader.cancel();
});
