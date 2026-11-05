// The HTTP API (see contract.ts for every shape). The web app proxies /api/* here, same-origin.
import { Hono, type Context } from "hono";
import { getBoard } from "./board.ts";
import { streamSSE } from "hono/streaming";
import type { ApiError, BriefFeedbackRequest, CaptureRequest, ChatRequest, DraftRequest, CreateRoomRequest, DebriefRequest, DecideRequest, RecallResponse, UpdateRoomRequest } from "./contract.ts";
import { MEMORY_TYPES } from "./contract.ts";
import { env } from "./env.ts";
import { q } from "./db.ts";
import { isCeo, startSession, verifySession } from "./auth.ts";
import { ActionError, answerDebrief, capture, decide, listCandidates, rateBrief } from "./actions.ts";
import { getBrief, latestBrief, listBriefs, runBrief } from "./brief.ts";
import { eventsSince, lastEventId, subscribe } from "./events.ts";
import { EmptyMemoryError, getJob, retryJob, toJob } from "./memory/keeper.ts";
import { recall } from "./memory/walrus.ts";
import { createRoom, getRoom, listRooms, RoomError, updateRoom } from "./rooms.ts";
import { tick } from "./scheduler.ts";
import { chat, draft } from "./studio.ts";
import { acceptUpdate, handleUpdate } from "./telegram.ts";
import { crewView, healthView, memoriesView, proofView, receiptView } from "./views.ts";
import { safeEqual } from "./util.ts";

export const app = new Hono();

const fail = (c: Context, status: 400 | 401 | 403 | 404 | 409 | 500 | 503, error: string, detail?: string) =>
  c.json<ApiError>({ error, ...(detail ? { detail } : {}) }, status);

class NotFound extends Error {}

app.onError((e, c) => {
  if (e instanceof NotFound) return fail(c, 404, e.message);
  if (e instanceof RoomError || e instanceof ActionError || e instanceof EmptyMemoryError) return fail(c, 400, e.message);
  console.error(`[api] ${c.req.method} ${c.req.path}: ${e.stack ?? e}`);
  return fail(c, 500, "Internal error", e.message);
});

/** Writes need the CEO. Reads are public, so judges can walk the real office. */
const ceo = async (c: Context, next: () => Promise<void>) => {
  if (!isCeo(c)) return fail(c, 401, "CEO only. Open the office from the Telegram bot's /web link.");
  await next();
};

const body = async <T>(c: Context): Promise<T> => {
  try {
    return (await c.req.json()) as T;
  } catch {
    throw new ActionError("Send a JSON body.");
  }
};

const roomOr404 = async (c: Context) => {
  const room = await getRoom(c.req.param("id")!);
  if (!room) throw new NotFound("No such room.");
  return room;
};

app.get("/api/health", async (c) => c.json(await healthView()));

app.get("/api/session", (c) => c.json({ ceo: isCeo(c) }));

app.get("/api/auth/magic", (c) => {
  if (!verifySession(c.req.query("t"))) return c.text("This link has expired. Send /web to the bot for a new one.", 401);
  startSession(c);
  return c.redirect("/");
});

// ---------- rooms ----------
app.get("/api/rooms", async (c) => c.json(await listRooms()));
app.post("/api/rooms", ceo, async (c) => c.json(await createRoom(await body<CreateRoomRequest>(c)), 201));
app.get("/api/rooms/:id", async (c) => c.json(await roomOr404(c)));
app.patch("/api/rooms/:id", ceo, async (c) => c.json(await updateRoom((await roomOr404(c)).id, await body<UpdateRoomRequest>(c))));

// ---------- briefs ----------
app.get("/api/rooms/:id/brief/latest", async (c) => {
  const b = await latestBrief((await roomOr404(c)).id);
  return b ? c.json(b) : fail(c, 404, "No brief yet.");
});
app.get("/api/rooms/:id/briefs", async (c) => c.json(await listBriefs((await roomOr404(c)).id)));
app.get("/api/rooms/:id/board", async (c) => c.json(await getBoard((await roomOr404(c)).id)));
app.post("/api/rooms/:id/brief", ceo, async (c) => c.json(await runBrief(await roomOr404(c), "manual"), 201));
app.get("/api/briefs/:id", async (c) => {
  const b = await getBrief(c.req.param("id"));
  return b ? c.json(b) : fail(c, 404, "No such brief.");
});
app.post("/api/briefs/:id/feedback", ceo, async (c) => {
  const req = await body<BriefFeedbackRequest>(c);
  if (req.rating !== "up" && req.rating !== "down") throw new ActionError("rating is 'up' or 'down'.");
  return c.json({ job: await rateBrief(c.req.param("id")!, req.rating, req.reason) });
});

// ---------- capture and debrief ----------
app.post("/api/rooms/:id/capture", ceo, async (c) => c.json(await capture(await roomOr404(c), (await body<CaptureRequest>(c)).text ?? ""), 202));
app.post("/api/rooms/:id/debrief", ceo, async (c) => c.json(await answerDebrief(await roomOr404(c), (await body<DebriefRequest>(c)).text ?? "")));
// Creator studio. Both recall first and store nothing; the CEO commits a one-line memory through /capture.
app.post("/api/rooms/:id/draft", ceo, async (c) => c.json(await draft(await roomOr404(c), await body<DraftRequest>(c))));
app.post("/api/rooms/:id/chat", ceo, async (c) => c.json(await chat(await roomOr404(c), await body<ChatRequest>(c))));
app.get("/api/rooms/:id/candidates", async (c) => c.json(await listCandidates((await roomOr404(c)).id)));
app.post("/api/candidates/decide", ceo, async (c) => {
  const req = await body<DecideRequest>(c);
  if (!Array.isArray(req.decisions)) throw new ActionError("decisions must be an array.");
  for (const d of req.decisions) if (d.type && !MEMORY_TYPES.includes(d.type)) throw new ActionError(`Unknown memory type '${d.type}'.`);
  return c.json(await decide(req.decisions), 202);
});

// ---------- the write lifecycle ----------
app.get("/api/memory-jobs/:jobId", async (c) => {
  const j = await getJob(c.req.param("jobId"));
  return j ? c.json(j) : fail(c, 404, "No such job.");
});
app.get("/api/memory-jobs", async (c) => {
  const roomId = c.req.query("roomId") ?? null;
  const rows = await q(`select * from memory_jobs where ($1::text is null or room_id = $1) order by created_at desc limit 50`, [roomId]);
  return c.json(rows.map(toJob));
});
app.post("/api/memory-jobs/:jobId/retry", ceo, async (c) => {
  const j = await retryJob(c.req.param("jobId")!);
  return j ? c.json(j) : fail(c, 409, "Only failed jobs can be retried.");
});

// ---------- memories ----------
app.get("/api/rooms/:id/memories", async (c) => c.json(await memoriesView(await roomOr404(c))));
app.get("/api/rooms/:id/recall", async (c) => {
  const room = await roomOr404(c);
  const query = (c.req.query("q") ?? "").trim();
  if (!query) throw new ActionError("Add ?q=");
  const res = await recall({ namespace: room.namespace, query, sort: "relevance", limit: 12, purpose: "search", roomId: room.id, as: "researcher" });
  return c.json<RecallResponse>({
    roomId: room.id,
    query,
    hits: res.hits.map((h) => ({ blobId: h.blob_id, text: h.text, distance: h.distance, createdAt: h.created_at ?? null })),
    latencyMs: res.latencyMs,
  });
});
app.get("/api/memories/:blobId/receipt", async (c) => c.json(await receiptView(c.req.param("blobId"))));

// ---------- crew and proof (Sui via Tatum) ----------
app.get("/api/crew", async (c) => c.json(await crewView()));
app.get("/api/proof", async (c) => c.json(await proofView()));

// ---------- live events ----------
app.get("/api/events", (c) =>
  streamSSE(c, async (stream) => {
    let last = Number(c.req.header("last-event-id") ?? c.req.query("since") ?? (await lastEventId()));
    const flush = async () => {
      for (const { id, event } of await eventsSince(last)) {
        last = id;
        await stream.writeSSE({ id: String(id), event: event.type, data: JSON.stringify(event) });
      }
    };
    let wake: () => void = () => {};
    const unsub = subscribe(() => wake());
    stream.onAbort(unsub);
    const until = Date.now() + 280_000; // serverless hosts cap a response; EventSource reconnects with Last-Event-ID
    while (!stream.aborted && Date.now() < until) {
      await flush();
      await Promise.race([new Promise<void>((r) => (wake = r)), stream.sleep(2000)]);
    }
    unsub();
  }),
);

// ---------- scheduler and Telegram ----------
app.post("/api/cron/tick", async (c) => {
  const secret = env.cronSecret();
  const given = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !safeEqual(given, secret)) return fail(c, 403, "Forbidden");
  return c.json(await tick());
});

app.post("/telegram/webhook", async (c) => {
  const secret = env.telegramWebhookSecret();
  if (!secret || !safeEqual(c.req.header("x-telegram-bot-api-secret-token") ?? "", secret)) return fail(c, 403, "Forbidden");
  const update = await c.req.json();
  // A brief can take longer than Telegram waits; handle it after answering so Telegram does not resend.
  if (acceptUpdate(update)) void handleUpdate(update);
  return c.json({ ok: true });
});

// Liveness for the host (Railway health check): no Walrus, Tatum or database call.
app.get("/healthz", (c) => c.json({ ok: true }));

app.get("/", (c) => c.text("Aquahab crew server. API under /api, contract in server/src/contract.ts."));
