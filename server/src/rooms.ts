// Rooms: one real project each, and exactly one Walrus Memory namespace each.
// Namespace names are public on-chain (the relayer writes `memwal_namespace` into each Blob's metadata),
// so a private room gets an HMAC alias instead of its slug.
import type { CreateRoomRequest, Room, UpdateRoomRequest } from "./contract.ts";
import { env } from "./env.ts";
import { one, q } from "./db.ts";
import { dayIndex, hmac, isHHMM, localParts, newId, slugify } from "./util.ts";

export const CEO_NAMESPACE = "aquahab:ceo";
export const CEO_SLUG = "ceo";

export function namespaceFor(slug: string, isPrivate: boolean): string {
  return isPrivate ? `aquahab:room:p-${hmac(env.appSecret(), `room:${slug}`).slice(0, 12)}` : `aquahab:room:${slug}`;
}

export class RoomError extends Error {}

function toRoom(r: Record<string, any>, memoryCount: number, lastBriefAt: string | null): Room {
  const tz = env.timezone();
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    goal: r.goal ?? null,
    namespace: r.namespace,
    private: !!r.private,
    briefAt: r.brief_at,
    debriefAt: r.debrief_at,
    timezone: tz,
    memoryCount,
    lastBriefAt,
    createdAt: new Date(r.created_at).toISOString(),
    dayIndex: dayIndex(r.start_date, localParts(new Date(), tz).date),
  };
}

const ROOM_STATS = `
  select r.*,
    (select count(*) from memory_jobs m where m.room_id = r.id and m.status = 'stored') as memory_count,
    (select max(created_at) from briefs b where b.room_id = r.id) as last_brief_at
  from rooms r`;

export async function listRooms(): Promise<Room[]> {
  const rows = await q(`${ROOM_STATS} where not r.archived order by r.created_at asc`);
  return rows.map((r) => toRoom(r, Number(r.memory_count), r.last_brief_at ? new Date(r.last_brief_at).toISOString() : null));
}

export async function getRoom(idOrSlug: string): Promise<Room | null> {
  const r = await one(`${ROOM_STATS} where r.id = $1 or r.slug = $1`, [idOrSlug]);
  return r ? toRoom(r, Number(r.memory_count), r.last_brief_at ? new Date(r.last_brief_at).toISOString() : null) : null;
}

export async function createRoom(req: CreateRoomRequest): Promise<Room> {
  const slug = slugify(req.slug || req.name);
  if (!slug || slug === CEO_SLUG) throw new RoomError("Pick a room slug (letters, numbers and dashes), not 'ceo'.");
  const name = (req.name || req.slug).trim().slice(0, 60);
  const briefAt = req.briefAt ?? "08:30";
  const debriefAt = req.debriefAt ?? "21:00";
  if (!isHHMM(briefAt) || !isHHMM(debriefAt)) throw new RoomError("Times are HH:MM, 24-hour.");
  if (await one(`select id from rooms where slug = $1`, [slug])) throw new RoomError(`Room '${slug}' already exists.`);
  const id = newId("room");
  const goal = req.goal?.trim().slice(0, 280) || null;
  await q(`insert into rooms (id, slug, name, namespace, private, brief_at, debrief_at, start_date, goal) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [
    id,
    slug,
    name,
    namespaceFor(slug, !!req.private),
    !!req.private,
    briefAt,
    debriefAt,
    localParts(new Date(), env.timezone()).date,
    goal,
  ]);
  return (await getRoom(id))!;
}

export async function updateRoom(id: string, req: UpdateRoomRequest): Promise<Room> {
  const room = await getRoom(id);
  if (!room) throw new RoomError("No such room.");
  if (req.briefAt && !isHHMM(req.briefAt)) throw new RoomError("briefAt is HH:MM, 24-hour.");
  if (req.debriefAt && !isHHMM(req.debriefAt)) throw new RoomError("debriefAt is HH:MM, 24-hour.");
  await q(`update rooms set name = coalesce($2, name), brief_at = coalesce($3, brief_at), debrief_at = coalesce($4, debrief_at) where id = $1`, [
    room.id,
    req.name?.trim().slice(0, 60) ?? null,
    req.briefAt ?? null,
    req.debriefAt ?? null,
  ]);
  return (await getRoom(room.id))!;
}

/** Which room does a namespace belong to (null for the CEO namespace or a foreign one). */
export async function roomByNamespace(namespace: string): Promise<Room | null> {
  const r = await one(`select id from rooms where namespace = $1`, [namespace]);
  return r ? getRoom(r.id) : null;
}
