// The crew on Telegram: where the CEO actually lives during the day.
//   morning   the brief arrives, with receipts and 👍 / 👎
//   any time  `d:` `f:` `n:` quick capture, or a free note the crew turns into proposals
//   evening   the debrief question; the reply becomes proposals the CEO keeps or drops
// One CEO per deployment: the first chat that sends `/start <pair code>` is bound, everyone else is refused.
import { timingSafeEqual } from "node:crypto";
import { CREW, walruscanBlob, type Brief, type Candidate, type CompareResponse, type MemoryJob, type Room } from "./contract.ts";
import { env } from "./env.ts";
import { getSetting, q, setSetting } from "./db.ts";
import { subscribe } from "./events.ts";
import { ActionError, answerDebrief, capture, decide, getCandidate, listCandidates, openDebrief, rateBrief } from "./actions.ts";
import { getBrief, latestBrief, runBrief } from "./brief.ts";
import { answerFromMemory } from "./llm.ts";
import { recall } from "./memory/walrus.ts";
import { EmptyMemoryError } from "./memory/keeper.ts";
import { parseCapture, parseMemory } from "./memory/format.ts";
import { createRoom, getRoom, listRooms, RoomError, updateRoom } from "./rooms.ts";
import { magicLink } from "./auth.ts";
import { compare } from "./studio.ts";
import { crewView } from "./views.ts";
import { escapeHtml as esc, isHHMM } from "./util.ts";

type Markup = { inline_keyboard: { text: string; callback_data?: string; url?: string }[][] };

async function tg<T = any>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = env.telegramToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    // A half-open socket after a network drop would otherwise stall the poll loop.
    signal: AbortSignal.timeout(method === "getUpdates" ? ((body.timeout as number) ?? 0) * 1000 + 15_000 : 20_000),
  });
  const j: any = await r.json();
  if (!j.ok && !/message is not modified/.test(j.description ?? "")) throw new Error(`telegram ${method}: ${j.description}`);
  return j.result as T;
}

export async function send(chatId: number, html: string, markup?: Markup, replyTo?: number): Promise<number> {
  const m = await tg<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(markup ? { reply_markup: markup } : {}),
    ...(replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}),
  });
  return m.message_id;
}

async function edit(chatId: number, messageId: number, html: string, markup?: Markup) {
  await tg("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: markup ?? { inline_keyboard: [] },
  }).catch((e) => console.warn(`[telegram] edit: ${(e as Error).message}`));
}

export const ceoChat = () => getSetting<number>("telegram.chat");

async function activeRoom(): Promise<Room | null> {
  const id = await getSetting<string>("telegram.room");
  const room = id ? await getRoom(id) : null;
  return room ?? (await listRooms())[0] ?? null;
}

// ---------- rendering ----------

const shortBlob = (b: string) => `${b.slice(0, 6)}…`;

/** /compare: the answer with no memory, then the answer from Walrus with its receipts. */
export function compareHtml(roomName: string, r: CompareResponse): string {
  return [
    `<b>${esc(roomName)}</b> · ${esc(r.question)}`,
    "",
    "<b>Without memory</b>",
    esc(r.withoutMemory.text),
    "",
    `<b>With memory</b> · ${r.withMemory.recalled} recalled from Walrus`,
    esc(r.withMemory.text),
    ...r.withMemory.cites.map((b, i) => `<i>[${i + 1}] <a href="${walruscanBlob(b)}">${esc(shortBlob(b))}</a></i>`),
  ].join("\n");
}

export function renderBrief(room: Room, b: Brief): { html: string; markup: Markup } {
  const notes: string[] = [];
  const out = [`<b>${esc(room.name)}</b> · day ${b.dayIndex} brief`];
  for (const s of b.sections) {
    out.push("", `<b>${esc(CREW[s.agent].name)}</b> · ${esc(s.title)}`);
    for (const l of s.lines) {
      const refs = l.cites.map((c) => {
        let i = notes.indexOf(c);
        if (i < 0) i = notes.push(c) - 1;
        return i + 1;
      });
      out.push(`• ${esc(l.text)}${refs.length ? ` <i>[${refs.join(",")}]</i>` : ""}`);
    }
  }
  if (b.source === "fallback") out.push("", "<i>Written without the model today; lines are the newest memories of each type.</i>");
  const markup: Markup = {
    inline_keyboard: [
      [
        { text: "👍 Useful", callback_data: `fb:up:${b.id}` },
        { text: "👎 Not useful", callback_data: `fb:down:${b.id}` },
      ],
      ...(notes.length ? [[{ text: `Receipts (${notes.length})`, callback_data: `why:${b.id}` }]] : []),
      [{ text: "Open the office", url: env.appUrl() }],
    ],
  };
  return { html: out.join("\n"), markup };
}

function receiptsHtml(b: Brief): string {
  const notes: string[] = [];
  for (const s of b.sections) for (const l of s.lines) for (const c of l.cites) if (!notes.includes(c)) notes.push(c);
  return [
    "<b>Receipts</b>: the Walrus memories this brief was built from.",
    ...notes.map((c, i) => `[${i + 1}] <a href="${walruscanBlob(c)}">${esc(shortBlob(c))}</a>`),
  ].join("\n");
}

const jobLine = (j: MemoryJob) =>
  j.status === "stored"
    ? `✓ Stored on Walrus · <a href="${walruscanBlob(j.blobId!)}">${esc(shortBlob(j.blobId!))}</a>`
    : j.status === "failed"
      ? `✗ Not stored: ${esc(j.error ?? "error")}`
      : j.status === "pending"
        ? "… Writing to Walrus"
        : "… Queued";

function candidatesView(room: Room, cands: (Candidate & { keep: boolean })[], debriefId: string): { html: string; markup: Markup } {
  if (!cands.length) {
    return { html: `<b>${esc(room.name)}</b> · nothing worth keeping in that note. That's fine.`, markup: { inline_keyboard: [] } };
  }
  const html = [
    `<b>${esc(room.name)}</b> · the crew proposes ${cands.length} ${cands.length === 1 ? "memory" : "memories"}. Tap to keep or drop, then file.`,
    "",
    ...cands.map((c, i) => `${c.keep ? "✅" : "▫️"} ${i + 1}. <b>${c.type}</b> · ${esc(CREW[c.agent].name)}\n${esc(c.text)}`),
  ].join("\n");
  const kept = cands.filter((c) => c.keep).length;
  const markup: Markup = {
    inline_keyboard: [
      cands.map((c, i) => ({ text: `${c.keep ? "✅" : "▫️"} ${i + 1}`, callback_data: `t:${c.id}` })),
      [
        { text: kept ? `File ${kept} to Walrus` : "Drop all", callback_data: `file:${debriefId}` },
      ],
    ],
  };
  return { html, markup };
}

async function proposedWithKeep(roomId: string) {
  const rows = await q(`select id, keep from candidates where room_id = $1 and status = 'proposed' order by created_at asc`, [roomId]);
  const keep = new Map(rows.map((r) => [r.id, !!r.keep]));
  return (await listCandidates(roomId)).map((c) => ({ ...c, keep: keep.get(c.id) ?? true }));
}

// ---------- outbound (scheduler) ----------

export async function deliverBrief(room: Room, b: Brief) {
  const chat = await ceoChat();
  if (!chat || !env.telegramToken()) return;
  const { html, markup } = renderBrief(room, b);
  const mid = await send(chat, html, markup);
  await q(`update briefs set telegram_message_id = $2 where id = $1`, [b.id, mid]);
}

export async function askDebrief(room: Room) {
  const chat = await ceoChat();
  if (!chat || !env.telegramToken()) return;
  const mid = await send(
    chat,
    [
      `<b>${esc(room.name)}</b> · evening debrief`,
      "How did today go? A few lines is plenty: what you decided, what broke, what's next.",
      "<i>Reply to this message. The crew will propose memories and you keep the ones that matter.</i>",
    ].join("\n"),
  );
  await openDebrief(room, mid);
}

// ---------- inbound ----------

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function bind(chatId: number, text: string): Promise<boolean> {
  const bound = await ceoChat();
  if (bound === chatId) return true;
  const code = env.telegramPairCode();
  if (!code) return false; // refuse to pair without a configured secret: fail closed
  const given = text.split(/\s+/)[1] ?? "";
  if (!bound && safeEqual(given, code)) {
    await setSetting("telegram.chat", chatId);
    return true;
  }
  return false;
}

// ---------- menu and onboarding (inline buttons) ----------

/** What the next plain-text message means, when a button asked for input. */
export type Pending =
  | { kind: "feedback"; briefId: string }
  | { kind: "newRoom" }
  | { kind: "newRoomGoal"; name: string }
  | { kind: "newRoomTimes"; name: string; goal?: string }
  | { kind: "times" }
  | { kind: "ask" }
  | { kind: "capture"; prefix: string };

export const CAPTURE_TYPES: [string, string][] = [
  ["d:", "Decision"],
  ["f:", "Failed"],
  ["n:", "Next"],
  ["done:", "Shipped"],
  ["l:", "Learned"],
  ["due:", "Deadline"],
  ["s:", "Story"],
  ["p:", "Briefing style"],
];

/** Brief and debrief pairs offered as buttons. The first one is the room default (`createRoom`). */
export const TIME_PRESETS: [string, string][] = [
  ["08:30", "21:00"],
  ["07:45", "20:30"],
  ["09:00", "22:00"],
];

export const MENU_ACTIONS = ["web", "rooms", "new", "newskip", "newdef", "ask", "capture", "brief", "debrief", "memories", "crew", "times", "timesask", "help", "menu", "done"] as const;

const GOAL_PROMPT = "What are you trying to achieve here? One line. Tap <i>Skip goal</i> to leave it out.";
const TIMES_PROMPT = "When should the crew brief and debrief? Type two 24-hour times, for example <code>08:30 21:00</code>, or tap <i>Use default</i>. Add <code>private</code> to hide the room name on-chain.";
const WIZARD_SKIP: Markup = { inline_keyboard: [[{ text: "Skip goal", callback_data: "m:newskip" }]] };
const WIZARD_DEFAULT: Markup = { inline_keyboard: [[{ text: `Use default ${TIME_PRESETS[0].join(" · ")}`, callback_data: "m:newdef" }]] };
const BACK_TO_MENU: Markup = { inline_keyboard: [[{ text: "↻ Menu", callback_data: "m:menu" }]] };

/** The command and capture reference, shown by /help and "How to use". */
export function helpHtml(): string {
  return [
    "<b>Aquahab</b> · your project crew remembers where you left off.",
    "",
    "<b>Capture any time</b> (goes to the current room)",
    CAPTURE_TYPES.map(([p, label]) => `<code>${p}</code> ${label.toLowerCase()}`).join(" · "),
    "Or just write a note, and the crew proposes what to remember.",
    "",
    "<b>Commands</b>",
    "/rooms switch room · /new name [| goal] [| times] [private]",
    "/brief now · /debrief now · /skip tonight's debrief",
    "/ask question · /compare question (without and with memory)",
    "/memories · /crew · /times · /web",
  ].join("\n");
}

/** `08:30 21:00`, one time, or `private` alone. Null when the text is not a time choice. */
export function parseTimes(text: string): { briefAt?: string; debriefAt?: string; private: boolean } | null {
  const isPrivate = /\bprivate\b/i.test(text);
  const rest = text.replace(/\bprivate\b/i, "").trim();
  if (!rest) return { private: isPrivate };
  const m = rest.match(/^(\d{1,2}:\d{2})(?:\s+(\d{1,2}:\d{2}))?$/);
  if (!m || !isHHMM(m[1]) || (m[2] && !isHHMM(m[2]))) return null;
  return { briefAt: m[1], debriefAt: m[2], private: isPrivate };
}

/** Callback data carries times without colons, `tm:0830:2100`, because `:` already separates the fields. */
const compactTime = (hhmm: string) => hhmm.replace(":", "");
const expandTime = (s: string | undefined) => (s && s.length === 4 ? `${s.slice(0, 2)}:${s.slice(2)}` : "");

export function timesMarkup(): Markup {
  return {
    inline_keyboard: [
      ...TIME_PRESETS.map(([b, d]) => [{ text: `${b} · ${d}`, callback_data: `tm:${compactTime(b)}:${compactTime(d)}` }]),
      [{ text: "Type my own", callback_data: "m:timesask" }],
    ],
  };
}

const timesPrompt = (roomName: string) => `Brief and debrief times for <b>${esc(roomName)}</b>. Pick a pair, or type your own.`;

export function menuMarkup(): Markup {
  return {
    inline_keyboard: [
      [{ text: "⚡ Open office", callback_data: "m:web" }],
      [
        { text: "◈ Rooms", callback_data: "m:rooms" },
        { text: "＋ New room", callback_data: "m:new" },
      ],
      [
        { text: "✎ Capture", callback_data: "m:capture" },
        { text: "? Ask memory", callback_data: "m:ask" },
      ],
      [
        { text: "☀ Brief now", callback_data: "m:brief" },
        { text: "☾ Debrief now", callback_data: "m:debrief" },
      ],
      [
        { text: "≡ Memories", callback_data: "m:memories" },
        { text: "⌂ Crew", callback_data: "m:crew" },
      ],
      [
        { text: "⏰ Times", callback_data: "m:times" },
        { text: "i How to use", callback_data: "m:help" },
      ],
      [{ text: "↻ Refresh", callback_data: "m:menu" }],
    ],
  };
}

export function menuHtml(roomName: string | null): string {
  return ["<b>Aquahab</b>", "Select an option below.", roomName ? `Notes go to <b>${esc(roomName)}</b>.` : "Create a room first with ＋ New room."].join("\n");
}

export function onboardingHtml(): string {
  return [
    "<b>Welcome to Aquahab.</b> Your crew remembers where you left off on each project.",
    "",
    "<b>1 · Create a room</b> for a real project. Tap ＋ New room.",
    "<b>2 · Capture</b> what matters. Tap ✎ Capture, pick a type, then type the note. Or type the prefix yourself, for example <code>d: we chose Neon</code>.",
    "<b>3 · Read the brief</b> each morning at 08:30, and answer the debrief at 21:00.",
    "",
    "Tap 👍 or 👎 on a brief. The crew learns from it.",
  ].join("\n");
}

export function onboardingMarkup(): Markup {
  return {
    inline_keyboard: [
      [{ text: "＋ Create my first room", callback_data: "m:new" }],
      [{ text: "✎ Try a capture", callback_data: "m:capture" }],
      [{ text: "Got it", callback_data: "m:done" }],
    ],
  };
}

// Telegram accepts only https links on buttons. Local development falls back to a plain link.
async function sendOfficeLink(chatId: number) {
  const url = magicLink();
  if (url.startsWith("https://")) {
    return void (await send(chatId, "Your office (link valid 15 minutes):", { inline_keyboard: [[{ text: "Open Aquahab as CEO", url }]] }));
  }
  return void (await send(chatId, `Your office (link valid 15 minutes, local URL):\n<code>${esc(url)}</code>`));
}

async function showMenu(chatId: number) {
  if (!(await getSetting<boolean>("telegram.onboarded"))) return void (await send(chatId, onboardingHtml(), onboardingMarkup()));
  const room = await activeRoom();
  await send(chatId, menuHtml(room?.name ?? null), menuMarkup());
}

/** Sets what the next plain-text message means, then asks for it. */
async function ask(chatId: number, pending: Pending, text: string, markup?: Markup) {
  await setSetting("telegram.await", pending);
  await send(chatId, text, markup);
}

/** Opens the room and files the day-one brief. Used by `/new` and by the New room steps. */
async function openRoom(chatId: number, input: { name: string; goal?: string; briefAt?: string; debriefAt?: string; private: boolean }) {
  try {
    const r = await createRoom({ slug: input.name, name: input.name, goal: input.goal, briefAt: input.briefAt, debriefAt: input.debriefAt, private: input.private });
    await setSetting("telegram.room", r.id);
    await send(chatId, `Room <b>${esc(r.name)}</b> is open. Namespace <code>${esc(r.namespace)}</code>. Brief ${r.briefAt}, debrief ${r.debriefAt}.`);
    const b = await runBrief(r, "day-one");
    const { html, markup } = renderBrief(r, b);
    await send(chatId, html, markup);
  } catch (e) {
    await send(chatId, esc((e as Error).message));
  }
}

async function handleMenu(chatId: number, messageId: number, action: string) {
  switch (action) {
    case "menu":
      return void (await showMenu(chatId));
    case "help":
      return void (await send(chatId, helpHtml(), BACK_TO_MENU));
    case "done":
      await setSetting("telegram.onboarded", true);
      return void (await showMenu(chatId));
    case "web":
      return void (await sendOfficeLink(chatId));
    case "rooms":
    case "brief":
    case "debrief":
    case "memories":
    case "crew":
      return void (await handleText(chatId, messageId, `/${action}`, null));
    case "new":
      return void (await ask(chatId, { kind: "newRoom" }, "Name your project. It becomes a room, for example <i>Aquahab</i>."));
    case "newskip":
    case "newdef": {
      // The goal and times buttons only mean something inside the New room steps.
      const pending = await getSetting<Pending | null>("telegram.await");
      if (action === "newskip" && pending?.kind === "newRoomGoal") {
        return void (await ask(chatId, { kind: "newRoomTimes", name: pending.name }, TIMES_PROMPT, WIZARD_DEFAULT));
      }
      if (action === "newdef" && pending?.kind === "newRoomTimes") {
        await setSetting("telegram.await", null);
        return void (await openRoom(chatId, { name: pending.name, goal: pending.goal, private: false }));
      }
      return void (await send(chatId, "That step has passed. Tap ＋ New room to start again.", BACK_TO_MENU));
    }
    case "ask":
      return void (await ask(chatId, { kind: "ask" }, "What do you want to know? The answer comes from this room's memory."));
    case "capture": {
      const rows: Markup["inline_keyboard"] = [];
      for (let i = 0; i < CAPTURE_TYPES.length; i += 2) {
        rows.push(CAPTURE_TYPES.slice(i, i + 2).map(([p, label]) => ({ text: label, callback_data: `c:${p}` })));
      }
      return void (await send(chatId, `Pick a type, then type the note. Or type the prefix yourself, for example <code>d: we chose Neon</code>.`, { inline_keyboard: rows }));
    }
    case "times":
      return void (await sendTimesPicker(chatId));
    case "timesask":
      return void (await ask(chatId, { kind: "times" }, "Type brief and debrief, 24-hour, for example <code>08:30 21:00</code>."));
  }
}

/** The times picker for the active room. Shared by ⏰ Times and `/times` with no arguments. */
async function sendTimesPicker(chatId: number) {
  const room = await activeRoom();
  if (!room) return void (await send(chatId, "Create a room first with ＋ New room.", BACK_TO_MENU));
  return void (await send(chatId, timesPrompt(room.name), timesMarkup()));
}

/** `/new Name | goal | 07:45 20:30`: the goal and the times are optional, in that order. */
export function parseNewRoom(arg: string): { name: string; goal?: string; briefAt?: string; debriefAt?: string; private: boolean } {
  const isPrivate = /\bprivate\b/i.test(arg);
  const parts = arg.replace(/\bprivate\b/i, "").split("|").map((p) => p.trim()).filter((p) => p.length > 0);
  const name = parts[0] ?? "";
  let rest = parts.slice(1);
  let briefAt: string | undefined;
  let debriefAt: string | undefined;
  const last = rest[rest.length - 1];
  const times = last?.match(/^(\d{1,2}:\d{2})(?:\s+(\d{1,2}:\d{2}))?$/);
  if (times) {
    briefAt = times[1];
    debriefAt = times[2];
    rest = rest.slice(0, -1);
  }
  const goal = rest.join(" | ") || undefined;
  return { name, goal, briefAt, debriefAt, private: isPrivate };
}

async function handleText(chatId: number, messageId: number, text: string, replyTo: number | null) {
  const t = text.trim();
  if (t.startsWith("/start")) {
    if (!(await bind(chatId, t))) return void (await send(chatId, "This crew works for one CEO. Ask the owner for the pair code."));
    return void (await showMenu(chatId));
  }
  if ((await ceoChat()) !== chatId) return void (await send(chatId, "This crew works for one CEO."));

  const [cmd, ...rest] = t.split(/\s+/);
  const arg = rest.join(" ").trim();
  const room = await activeRoom();

  switch (cmd.split("@")[0]) {
    case "/help":
      return void (await send(chatId, helpHtml(), BACK_TO_MENU));
    case "/menu":
      return void (await showMenu(chatId));
    case "/new": {
      const room0 = parseNewRoom(arg);
      if (!room0.name) return void (await send(chatId, "Name the project: <code>/new Aquahab | what you are trying to achieve | 08:30 21:00</code>. The goal and the times are optional; add <code>private</code> to hide the name on-chain. Or tap ＋ New room in the menu for step-by-step."));
      return void (await openRoom(chatId, room0));
    }
    case "/rooms": {
      const rooms = await listRooms();
      if (!rooms.length) return void (await send(chatId, "No rooms yet. <code>/new Aquahab</code>"));
      return void (await send(chatId, "Pick the room your notes go to:", {
        inline_keyboard: rooms.map((r) => [{ text: `${r.id === room?.id ? "● " : ""}${r.name} · ${r.memoryCount} memories`, callback_data: `room:${r.id}` }]),
      }));
    }
    case "/room": {
      const r = arg ? await getRoom(arg) : null;
      if (!r) return void (await send(chatId, "No such room. /rooms lists them."));
      await setSetting("telegram.room", r.id);
      return void (await send(chatId, `Notes now go to <b>${esc(r.name)}</b>.`));
    }
  }
  if (!room) return void (await send(chatId, "Create a room first: <code>/new Aquahab</code>"));

  switch (cmd.split("@")[0]) {
    case "/brief": {
      const wait = await send(chatId, `<i>${esc(room.name)}: recalling from Walrus…</i>`);
      const b = await runBrief(room, "manual");
      const { html, markup } = renderBrief(room, b);
      await edit(chatId, wait, html, markup);
      await q(`update briefs set telegram_message_id = $2 where id = $1`, [b.id, wait]);
      return;
    }
    case "/debrief":
      return void (await askDebrief(room));
    case "/skip":
      await q(`update debriefs set status='skipped' where room_id=$1 and status='asked'`, [room.id]);
      return void (await send(chatId, "Skipped tonight's debrief."));
    case "/ask": {
      if (!arg) return void (await send(chatId, "Ask something: <code>/ask what did we decide about Tatum?</code>"));
      const res = await recall({ namespace: room.namespace, query: arg, sort: "relevance", limit: 8, purpose: "ask", roomId: room.id, as: "researcher" });
      const coded = res.hits.map((h, i) => ({ code: `m${i + 1}`, blobId: h.blob_id, text: h.text }));
      const a = await answerFromMemory(arg, room.name, coded);
      const cited = a.cites.map((c) => coded.find((m) => m.code === c)).filter(Boolean) as typeof coded;
      return void (await send(
        chatId,
        [`<b>${esc(room.name)}</b> · ${esc(arg)}`, "", esc(a.answer), ...cited.map((m, i) => `<i>[${i + 1}] <a href="${walruscanBlob(m.blobId)}">${esc(shortBlob(m.blobId))}</a></i>`)].join("\n"),
      ));
    }
    case "/compare": {
      if (!arg) return void (await send(chatId, "Ask one question twice: <code>/compare what did we decide about Tatum?</code>"));
      const wait = await send(chatId, `<i>${esc(room.name)}: asking once with no memory, once from Walrus…</i>`);
      try {
        return void (await edit(chatId, wait, compareHtml(room.name, await compare(room, { question: arg }))));
      } catch (e) {
        if (e instanceof ActionError) return void (await edit(chatId, wait, esc(e.message)));
        throw e;
      }
    }
    case "/memories": {
      const rows = await q(`select * from memory_jobs where room_id = $1 order by created_at desc limit 10`, [room.id]);
      if (!rows.length) return void (await send(chatId, `${esc(room.name)} has no memories yet.`));
      return void (await send(
        chatId,
        [`<b>${esc(room.name)}</b> · latest memories`, ...rows.map((r) => `• <b>${r.type}</b> · ${esc(r.body)}\n  <i>${r.status === "stored" ? `stored ${shortBlob(r.blob_id)}` : r.status}</i>`)].join("\n"),
      ));
    }
    case "/crew": {
      const crew = await crewView();
      return void (await send(
        chatId,
        [
          `<b>Crew</b> · read from Sui (${crew.source})`,
          ...crew.agents.map((a) => `• <b>${esc(a.name)}</b>${a.title ? ` · ${esc(a.title)}` : ""} · ${a.memoryCount} memories${a.hiredAt ? ` · hired ${a.hiredAt.slice(0, 10)}` : ""}`),
          ...(crew.vacancies.length ? [`Vacant: ${crew.vacancies.map((r) => CREW[r].name).join(", ")}`] : []),
        ].join("\n"),
      ));
    }
    case "/times": {
      if (!rest.length) return void (await sendTimesPicker(chatId));
      const [briefAt, debriefAt] = rest;
      if (!briefAt || !isHHMM(briefAt) || (debriefAt && !isHHMM(debriefAt))) return void (await send(chatId, "Use 24-hour times: <code>/times 08:30 21:00</code>"));
      const r = await updateRoom(room.id, { briefAt, debriefAt });
      return void (await send(chatId, `${esc(r.name)}: brief at ${r.briefAt}, debrief at ${r.debriefAt} (${esc(r.timezone)}).`));
    }
    case "/web":
      return void (await sendOfficeLink(chatId));
  }
  if (cmd.startsWith("/")) return void (await showMenu(chatId));

  // Plain text: a reply to the feedback question, a debrief answer, a quick capture, or a free note.
  const pending = await getSetting<Pending | null>("telegram.await");
  if (pending && pending.kind !== "feedback") {
    await setSetting("telegram.await", null);
    if (pending.kind === "newRoom") return void (await ask(chatId, { kind: "newRoomGoal", name: t }, GOAL_PROMPT, WIZARD_SKIP));
    if (pending.kind === "newRoomGoal") return void (await ask(chatId, { kind: "newRoomTimes", name: pending.name, goal: t }, TIMES_PROMPT, WIZARD_DEFAULT));
    if (pending.kind === "newRoomTimes") {
      const times = parseTimes(t);
      if (!times) return void (await ask(chatId, pending, `Use 24-hour times like <code>08:30 21:00</code>, or tap <i>Use default</i>.`, WIZARD_DEFAULT));
      return void (await openRoom(chatId, { name: pending.name, goal: pending.goal, ...times }));
    }
    if (pending.kind === "times") return handleText(chatId, messageId, `/times ${t}`, replyTo);
    if (pending.kind === "ask") return handleText(chatId, messageId, `/ask ${t}`, replyTo);
    return handleText(chatId, messageId, `${pending.prefix} ${t}`, replyTo);
  }
  const awaiting = pending;
  if (awaiting?.kind === "feedback") {
    await setSetting("telegram.await", null);
    await rateBrief(awaiting.briefId, "down", t, null);
    return void (await send(chatId, "Noted. The Keeper filed it, and the next brief will follow it."));
  }

  const debrief = replyTo
    ? (await q(`select d.id, d.room_id from debriefs d where d.telegram_message_id = $1 and d.status = 'asked'`, [replyTo]))[0]
    : (await q(`select id, room_id from debriefs where status = 'asked' and created_at > now() - interval '6 hours' order by created_at desc limit 1`))[0];
  const target = debrief ? ((await getRoom(debrief.room_id)) ?? room) : room;

  if (!debrief && parseCapture(t).type) {
    const wait = await send(chatId, `<i>Filing to ${esc(target.name)}…</i>`, undefined, messageId);
    try {
      const job = await capture(target, t, { chatId, messageId: wait });
      await edit(chatId, wait, `<b>${job.type}</b> · filed by ${esc(CREW[job.agent].name)} in ${esc(target.name)}\n${jobLine(job)}`);
    } catch (e) {
      await edit(chatId, wait, esc(e instanceof EmptyMemoryError || e instanceof ActionError ? e.message : `Could not file that: ${(e as Error).message}`));
    }
    return;
  }

  const wait = await send(chatId, `<i>${esc(target.name)}: the crew is reading your note…</i>`, undefined, messageId);
  const cands = await answerDebrief(target, t, debrief?.id ?? null);
  const latest = (await q(`select debrief_id from candidates where room_id = $1 and status = 'proposed' limit 1`, [target.id]))[0]?.debrief_id ?? debrief?.id ?? "none";
  const view = candidatesView(target, cands.map((c) => ({ ...c, keep: true })), latest);
  await edit(chatId, wait, view.html, view.markup);
}

async function handleCallback(chatId: number, messageId: number, data: string, callbackId: string) {
  const ack = (text?: string) => tg("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text } : {}) }).catch(() => {});
  if ((await ceoChat()) !== chatId) return void (await ack("Not your crew."));
  const [kind, a, b] = data.split(":");

  if (kind === "m") {
    await ack();
    return void (await handleMenu(chatId, messageId, a));
  }
  if (kind === "c") {
    const prefix = data.slice(2);
    await setSetting("telegram.await", { kind: "capture", prefix });
    await ack();
    return void (await send(chatId, `Type the note. It is filed as <code>${esc(prefix)}</code>.`));
  }
  if (kind === "room") {
    const r = await getRoom(a);
    if (r) await setSetting("telegram.room", r.id);
    await ack(r ? `Notes go to ${r.name}` : "Room not found");
    return;
  }
  if (kind === "fb") {
    const rating = a as "up" | "down";
    if (rating === "down") {
      await setSetting("telegram.await", { kind: "feedback", briefId: b });
      await ack();
      await send(chatId, "What should change? One line, for example <i>too long, keep it to five lines</i>.", undefined, messageId);
      return;
    }
    await rateBrief(b, "up");
    return void (await ack("Thanks. Recorded."));
  }
  if (kind === "why") {
    const brief = await getBrief(a);
    await ack();
    if (brief) await send(chatId, receiptsHtml(brief), undefined, messageId);
    return;
  }
  if (kind === "tm") {
    const room = await activeRoom();
    const briefAt = expandTime(a);
    const debriefAt = expandTime(b);
    if (!room || !isHHMM(briefAt) || !isHHMM(debriefAt)) return void (await ack("Time not valid"));
    const r = await updateRoom(room.id, { briefAt, debriefAt });
    await ack(`Set ${r.briefAt} · ${r.debriefAt}`);
    return void (await edit(chatId, messageId, `${esc(r.name)}: brief at ${r.briefAt}, debrief at ${r.debriefAt} (${esc(r.timezone)}).`));
  }
  if (kind === "t") {
    await q(`update candidates set keep = not keep where id = $1 and status = 'proposed'`, [a]);
    const c = await getCandidate(a);
    await ack();
    if (!c) return;
    const room = await getRoom(c.roomId);
    if (!room) return;
    const debriefId = (await q(`select debrief_id from candidates where id = $1`, [a]))[0]?.debrief_id ?? "none";
    const view = candidatesView(room, await proposedWithKeep(room.id), debriefId);
    await edit(chatId, messageId, view.html, view.markup);
    return;
  }
  if (kind === "file") {
    const rows = await q(`select id, keep, room_id from candidates where status = 'proposed' and (debrief_id = $1 or $1 = 'none') order by created_at asc`, [a]);
    await ack();
    if (!rows.length) return void (await edit(chatId, messageId, "Already filed."));
    const room = await getRoom(rows[0].room_id);
    const jobs = await decide(rows.map((r) => ({ id: r.id, keep: !!r.keep })), { chatId, messageId });
    await q(`update memory_jobs set notify = $2::jsonb where id = any($1::text[])`, [jobs.map((j) => j.jobId), JSON.stringify({ chatId, messageId, batch: true })]);
    await renderBatch(chatId, messageId, room?.name ?? "Room", jobs.map((j) => j.jobId));
  }
}

async function renderBatch(chatId: number, messageId: number, roomName: string, jobIds: string[]) {
  const rows = jobIds.length ? await q(`select * from memory_jobs where id = any($1::text[]) order by created_at asc`, [jobIds]) : [];
  if (!rows.length) return void (await edit(chatId, messageId, `<b>${esc(roomName)}</b> · nothing filed.`));
  const { toJob } = await import("./memory/keeper.ts");
  await edit(
    chatId,
    messageId,
    [`<b>${esc(roomName)}</b> · the Keeper is filing ${rows.length} ${rows.length === 1 ? "memory" : "memories"}`, ...rows.map((r) => `• <b>${r.type}</b> · ${esc(r.body)}\n  ${jobLine(toJob(r))}`)].join("\n"),
  );
}

/** When the Keeper stores a memory, update the Telegram message that asked for it. */
export function watchStored() {
  return subscribe((_, e) => {
    if (e.type !== "memory.stored" && e.type !== "memory.failed") return;
    void (async () => {
      const r = (await q(`select notify, room_id from memory_jobs where id = $1`, [e.job.jobId]))[0];
      const n = r?.notify as { chatId: number; messageId: number; batch?: boolean } | null;
      if (!n || !env.telegramToken()) return;
      if (n.batch) {
        const ids = (await q(`select id from memory_jobs where notify->>'messageId' = $1 order by created_at asc`, [String(n.messageId)])).map((x) => x.id);
        const room = r.room_id ? await getRoom(r.room_id) : null;
        await renderBatch(n.chatId, n.messageId, room?.name ?? "CEO", ids);
      } else {
        const room = e.job.roomId ? await getRoom(e.job.roomId) : null;
        await edit(n.chatId, n.messageId, `<b>${e.job.type}</b> · filed by ${esc(CREW[e.job.agent].name)} in ${esc(room?.name ?? "your preferences")}\n${jobLine(e.job)}`);
      }
    })().catch((err) => console.warn(`[telegram] notify: ${(err as Error).message}`));
  });
}

export async function handleUpdate(u: any) {
  try {
    if (u.message?.text) {
      await handleText(u.message.chat.id, u.message.message_id, u.message.text, u.message.reply_to_message?.message_id ?? null);
    } else if (u.callback_query?.data && u.callback_query.message) {
      await handleCallback(u.callback_query.message.chat.id, u.callback_query.message.message_id, u.callback_query.data, u.callback_query.id);
    }
  } catch (e) {
    console.error(`[telegram] update failed: ${(e as Error).stack ?? e}`);
    const chat = u.message?.chat?.id ?? u.callback_query?.message?.chat?.id;
    if (chat) await send(chat, "Something went wrong on our side. The note was not lost if it was already queued; try again in a minute.").catch(() => {});
  }
}

let polling = false;

const COMMANDS = [
  { command: "brief", description: "Brief me on the current room now" },
  { command: "debrief", description: "Start tonight's debrief now" },
  { command: "rooms", description: "Switch room" },
  { command: "new", description: "Open a room for a project" },
  { command: "ask", description: "Ask the room's memory" },
  { command: "compare", description: "One question, without and with memory" },
  { command: "memories", description: "Latest memories in this room" },
  { command: "crew", description: "Who works here (from Sui)" },
  { command: "times", description: "Set brief and debrief times" },
  { command: "skip", description: "Skip tonight's debrief" },
  { command: "web", description: "Open the office" },
  { command: "menu", description: "Open the menu" },
  { command: "help", description: "How to use the crew" },
];

/** Where Telegram posts updates: TELEGRAM_WEBHOOK_URL, else the office's own proxy at APP_URL. */
export function webhookUrl(): string {
  return env.telegramWebhookUrl() ?? `${env.appUrl().replace(/\/+$/, "")}/telegram/webhook`;
}

/** Deployed: register the webhook (and the command list) with Telegram on every boot. */
export async function startWebhook(): Promise<void> {
  if (!env.telegramToken()) return;
  const secret = env.telegramWebhookSecret();
  const url = webhookUrl();
  if (!secret) return void console.warn("[telegram] TELEGRAM_WEBHOOK_SECRET is not set: the webhook stays off.");
  if (!url.startsWith("https://")) return void console.warn(`[telegram] the webhook needs an https URL, got ${url}: set APP_URL or TELEGRAM_WEBHOOK_URL.`);
  try {
    await tg("setWebhook", { url, secret_token: secret, allowed_updates: ["message", "callback_query"], drop_pending_updates: false });
  } catch (e) {
    console.warn(`[telegram] setWebhook: ${(e as Error).message}; retrying in 15s`);
    setTimeout(() => void startWebhook(), 15_000);
    return;
  }
  await tg("setMyCommands", { commands: COMMANDS }).catch(() => {});
  console.log(`[telegram] webhook set to ${url}`);
}

// Telegram resends an update when the webhook answers late, so answer at once and drop repeats.
const seenUpdates = new Set<number>();
export function acceptUpdate(u: { update_id?: number }): boolean {
  if (typeof u.update_id !== "number") return true;
  if (seenUpdates.has(u.update_id)) return false;
  seenUpdates.add(u.update_id);
  if (seenUpdates.size > 500) seenUpdates.delete(seenUpdates.values().next().value!);
  return true;
}

/** Local development: long-poll getUpdates (removes any webhook first). */
export async function startPolling() {
  if (polling || !env.telegramToken()) return;
  polling = true;
  try {
    await tg("deleteWebhook", { drop_pending_updates: false });
  } catch (e) {
    // A network blip at boot must not leave the bot dead: reset the flag and try again.
    polling = false;
    console.warn(`[telegram] ${(e as Error).message}; retrying in 15s`);
    setTimeout(() => void startPolling(), 15_000);
    return;
  }
  await tg("setMyCommands", { commands: COMMANDS }).catch(() => {});
  let offset = (await getSetting<number>("telegram.offset")) ?? 0;
  console.log("[telegram] polling for updates");
  void (async () => {
    while (polling) {
      try {
        const updates = await tg<any[]>("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query"] });
        for (const u of updates) {
          offset = u.update_id + 1;
          await setSetting("telegram.offset", offset);
          await handleUpdate(u);
        }
      } catch (e) {
        console.warn(`[telegram] poll: ${(e as Error).message}`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  })();
}

export const stopPolling = () => {
  polling = false;
};
