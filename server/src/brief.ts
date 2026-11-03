// The morning brief: recall first, then write, then prove. Three recalls per brief (weight 1 each):
//   1. the room, newest first          (where did we leave off?)
//   2. the room, by relevance to blockers and failures (what must not be forgotten?)
//   3. the CEO namespace               (how does the CEO want to be briefed?)
// Every line keeps the Walrus blob ids it was built from. Lines that cite nothing real are dropped.
import { CREW, type Brief, type BriefSection, type Role, type Room } from "./contract.ts";
import { env } from "./env.ts";
import { one, q } from "./db.ts";
import { emit } from "./events.ts";
import { composeBrief, type CodedMemory } from "./llm.ts";
import { recall } from "./memory/walrus.ts";
import { CEO_NAMESPACE } from "./rooms.ts";
import { localParts, newId } from "./util.ts";

const ROOM_RECENT_QUERY = "decisions, failures, shipped work, next steps and deadlines for this project";
const ROOM_RISK_QUERY = "open blockers, failures, bugs and unfinished next steps";
const CEO_QUERY = "how the CEO wants to be briefed: length, tone, format, preferences and feedback on briefs";

export interface RecalledSet {
  room: CodedMemory[];
  ceo: CodedMemory[];
  degraded: boolean;
}

/** Recall everything a brief needs. Falls back to the Keeper's ledger when Walrus recall returns nothing. */
export async function recallForBrief(room: Room): Promise<RecalledSet> {
  const [recent, risk, ceo] = [
    await recall({ namespace: room.namespace, query: ROOM_RECENT_QUERY, sort: "recent", limit: 30, purpose: "brief", roomId: room.id, as: "one" }),
    await recall({ namespace: room.namespace, query: ROOM_RISK_QUERY, sort: "relevance", limit: 12, purpose: "brief", roomId: room.id, as: "one" }),
    await recall({ namespace: CEO_NAMESPACE, query: CEO_QUERY, sort: "recent", limit: 10, purpose: "brief", roomId: null, as: "keeper" }),
  ];
  const seen = new Set<string>();
  let roomHits = [...recent.hits, ...risk.hits].filter((h) => (seen.has(h.blob_id) ? false : (seen.add(h.blob_id), true)));
  let degraded = false;
  if (!roomHits.length) {
    // An empty answer is "unknown", not "nothing": cross-check the ledger of what the Keeper stored.
    const stored = await q(`select blob_id, text from memory_jobs where namespace = $1 and status = 'stored' order by stored_at desc limit 40`, [room.namespace]);
    if (stored.length) {
      degraded = true;
      roomHits = stored.map((s) => ({ blob_id: s.blob_id, text: s.text, distance: 0 }));
    }
  }
  roomHits.sort((a, b) => dateOf(b.text).localeCompare(dateOf(a.text)));
  return {
    room: roomHits.slice(0, 40).map((h, i) => ({ code: `m${i + 1}`, blobId: h.blob_id, text: h.text })),
    ceo: ceo.hits.map((h, i) => ({ code: `c${i + 1}`, blobId: h.blob_id, text: h.text })),
    degraded,
  };
}

const dateOf = (text: string) => text.match(/\[(\d{4}-\d{2}-\d{2})\]/)?.[1] ?? "";

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: env.timezone() });

export function emptyBrief(room: Room): BriefSection[] {
  return [
    {
      agent: "one",
      title: CREW.one.section,
      lines: [
        { text: `This is day ${room.dayIndex} and I don't know ${room.name} yet. I have no memories to brief you from.`, cites: [] },
        { text: `Tonight at ${room.debriefAt} I'll ask how the day went. Tell me what you decided, what broke and what's next.`, cites: [] },
        { text: "Or capture it now: d: for a decision, f: for something that failed, n: for a next step.", cites: [] },
      ],
    },
  ];
}

async function keeperSection(room: Room, recalled: number, degraded: boolean): Promise<BriefSection> {
  const s = await one<{ total: string; week: string; last: string | null }>(
    `select count(*) as total,
            count(*) filter (where stored_at > now() - interval '7 days') as week,
            max(stored_at) as last
       from memory_jobs where namespace = $1 and status = 'stored'`,
    [room.namespace],
  );
  const lines = [
    {
      text: `${Number(s?.total ?? 0)} memories in this room, ${Number(s?.week ?? 0)} filed this week. I recalled ${recalled} from Walrus for this brief.`,
      cites: [],
    },
  ];
  if (degraded) lines.push({ text: "Walrus recall came back empty, so this brief was built from my filing ledger. Retrying next time.", cites: [] });
  return { agent: "keeper", title: CREW.keeper.section, lines };
}

export async function runBrief(room: Room, kind: Brief["kind"] = "manual"): Promise<Brief> {
  const recalledSet = await recallForBrief(room);
  const local = localParts(new Date(), env.timezone());
  const codes = new Map([...recalledSet.room, ...recalledSet.ceo].map((m) => [m.code, m.blobId]));

  let sections: BriefSection[];
  let source: Brief["source"];
  let model: string | null = null;
  if (!recalledSet.room.length) {
    sections = emptyBrief(room);
    source = "empty";
    if (kind === "manual" && room.dayIndex === 1) kind = "day-one";
  } else {
    const draft = await composeBrief({
      roomName: room.name,
      today: local.date,
      weekday: WEEKDAY.format(new Date()),
      dayIndex: room.dayIndex,
      memories: recalledSet.room,
      ceo: recalledSet.ceo,
    });
    source = draft.source;
    model = draft.model;
    sections = draft.sections
      .map((s) => ({
        agent: s.agent,
        title: CREW[s.agent].section,
        lines: s.lines
          .map((l) => ({ text: l.text.trim(), cites: [...new Set(l.cites.map((c) => codes.get(c)).filter((b): b is string => !!b))] }))
          // Receipts or it didn't happen: a line with no valid citation is dropped.
          .filter((l) => l.text && l.cites.length),
      }))
      .filter((s) => s.lines.length);
    if (!sections.length) sections = emptyBrief(room);
  }
  sections.push(await keeperSection(room, recalledSet.room.length, recalledSet.degraded));

  const order: Role[] = ["one", "builder", "researcher", "hippo", "lofi", "keeper"];
  sections.sort((a, b) => order.indexOf(a.agent) - order.indexOf(b.agent));

  const id = newId("brief");
  await q(
    `insert into briefs (id, room_id, kind, day_index, sections, recall, source, degraded, model) values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9)`,
    [
      id,
      room.id,
      kind,
      room.dayIndex,
      JSON.stringify(sections),
      JSON.stringify({ room: recalledSet.room.map((m) => m.blobId), ceo: recalledSet.ceo.map((m) => m.blobId) }),
      source,
      recalledSet.degraded,
      model,
    ],
  );
  await emit({ type: "brief.created", roomId: room.id, briefId: id });
  return (await getBrief(id))!;
}

export function toBrief(r: Record<string, any>): Brief {
  const recallSet = r.recall ?? {};
  return {
    id: r.id,
    roomId: r.room_id,
    createdAt: new Date(r.created_at).toISOString(),
    dayIndex: Number(r.day_index),
    kind: r.kind,
    recalled: (recallSet.room ?? []).length,
    source: r.source,
    degraded: !!r.degraded,
    sections: r.sections,
    feedback: r.feedback ?? null,
  };
}

export async function getBrief(id: string): Promise<Brief | null> {
  const r = await one(`select * from briefs where id = $1`, [id]);
  return r ? toBrief(r) : null;
}

export async function latestBrief(roomId: string): Promise<Brief | null> {
  const r = await one(`select * from briefs where room_id = $1 order by created_at desc limit 1`, [roomId]);
  return r ? toBrief(r) : null;
}

export async function listBriefs(roomId: string, limit = 30): Promise<Brief[]> {
  return (await q(`select * from briefs where room_id = $1 order by created_at desc limit $2`, [roomId, limit])).map(toBrief);
}
