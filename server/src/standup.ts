// The crew standup: the members talk to each other about one room, from its memories. It runs after the morning
// brief (scheduler.ts) or on demand, and the office plays it in place of small talk.
// Recall first (one recall, newest first), then the model writes the turns, then every turn is checked against the
// recall: a turn that cites nothing real, or a member stating facts outside its domain, is dropped.
// The standup is kept in the ledger, never on Walrus: it is a conversation about memories, not a new memory.
import type { MemoryType, Room, Standup, StandupTurn } from "./contract.ts";
import { env } from "./env.ts";
import { one, q } from "./db.ts";
import { emit } from "./events.ts";
import { crewStandup, DOMAIN, fallbackStandup, SPEAKERS, type CodedMemory, type Speaker, type StandupDraft } from "./llm.ts";
import { parseMemory } from "./memory/format.ts";
import { recall } from "./memory/walrus.ts";
import { localParts, newId } from "./util.ts";

const STANDUP_QUERY = "next steps, decisions, shipped work, failures, lessons, deadlines and story notes for this project";
const MAX_TURNS = 8;
const MAX_TEXT = 300;

/** one runs the standup; every other member joins when the room has memories of its own types. */
export function standupSpeakers(memories: CodedMemory[]): Speaker[] {
  const types = new Set(memories.map((m) => parseMemory(m.text).type));
  return SPEAKERS.filter((s) => s === "one" || DOMAIN[s].some((t) => types.has(t)));
}

/**
 * Receipts or it didn't happen. Keeps a turn only when its speaker is in the standup and it cites recalled
 * memories (codes become blob ids); outside one, at least one cite must be of the speaker's own types.
 * An answer to someone who is not in the standup, or to oneself, becomes a turn to the whole crew.
 */
export function checkTurns(turns: StandupDraft["turns"], memories: CodedMemory[], speakers: Speaker[]): StandupTurn[] {
  const byCode = new Map(memories.map((m) => [m.code, m]));
  const here = new Set<Speaker>(speakers);
  const out: StandupTurn[] = [];
  for (const t of turns) {
    const text = t.text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
    if (!here.has(t.agent) || !text) continue;
    const cited = [...new Set(t.cites)].map((c) => byCode.get(c)).filter((m): m is CodedMemory => !!m);
    if (!cited.length) continue;
    if (t.agent !== "one" && !cited.some((m) => DOMAIN[t.agent].includes(parseMemory(m.text).type as MemoryType))) continue;
    const to = t.to && t.to !== t.agent && here.has(t.to) ? t.to : null;
    out.push({ agent: t.agent, to, text, cites: [...new Set(cited.map((m) => m.blobId))] });
    if (out.length === MAX_TURNS) break;
  }
  return out;
}

/** Hold a standup for the room. Null when there is not enough to talk about (one, and nobody else with memories). */
export async function runStandup(room: Room): Promise<Standup | null> {
  const res = await recall({ namespace: room.namespace, query: STANDUP_QUERY, sort: "recent", limit: 24, purpose: "standup", roomId: room.id, as: "one" });
  const memories: CodedMemory[] = res.hits.map((h, i) => ({ code: `m${i + 1}`, blobId: h.blob_id, text: h.text }));
  const speakers = standupSpeakers(memories);
  if (!memories.length || speakers.length < 2) return null;

  const input = { roomName: room.name, today: localParts(new Date(), env.timezone()).date, dayIndex: room.dayIndex, goal: room.goal, lens: room.contextTags, memories, speakers };
  const draft = await crewStandup(input);
  let turns = checkTurns(draft.turns, memories, speakers);
  let source = draft.source;
  let model = draft.model;
  if (turns.length < 2 && source === "llm") {
    // The model's turns did not survive the checks: read the memories out instead of showing half a conversation.
    turns = checkTurns(fallbackStandup(input).turns, memories, speakers);
    source = "fallback";
    model = null;
  }
  if (!turns.length) return null;

  const id = newId("standup");
  await q(`insert into standups (id, room_id, day_index, turns, recalled, source, model) values ($1,$2,$3,$4::jsonb,$5,$6,$7)`, [
    id,
    room.id,
    room.dayIndex,
    JSON.stringify(turns),
    memories.length,
    source,
    model,
  ]);
  await emit({ type: "standup.created", roomId: room.id, standupId: id });
  return (await getStandup(id))!;
}

function toStandup(r: Record<string, any>): Standup {
  return {
    id: r.id,
    roomId: r.room_id,
    createdAt: new Date(r.created_at).toISOString(),
    dayIndex: Number(r.day_index),
    turns: r.turns,
    recalled: Number(r.recalled),
    source: r.source,
    model: r.model ?? null,
  };
}

export async function getStandup(id: string): Promise<Standup | null> {
  const r = await one(`select * from standups where id = $1`, [id]);
  return r ? toStandup(r) : null;
}

export async function latestStandup(roomId: string): Promise<Standup | null> {
  const r = await one(`select * from standups where room_id = $1 order by created_at desc limit 1`, [roomId]);
  return r ? toStandup(r) : null;
}
