// Live cues for the office (a memory lands, a recall lights up its sources, the crew changes).
// Events are written to the database so SSE works on a long-lived host and on serverless alike:
// the stream tails the table, and clients resume with Last-Event-ID.
import type { AquahabEvent } from "./contract.ts";
import { q } from "./db.ts";

type Listener = (id: number, e: AquahabEvent) => void;
const listeners = new Set<Listener>();

export async function emit(e: AquahabEvent) {
  const rows = await q<{ id: string }>(`insert into events (type, payload) values ($1, $2::jsonb) returning id`, [e.type, JSON.stringify(e)]);
  const id = Number(rows[0]?.id ?? 0);
  for (const l of listeners) l(id, e);
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export async function eventsSince(lastId: number, limit = 100): Promise<{ id: number; event: AquahabEvent }[]> {
  const rows = await q(`select id, payload from events where id > $1 order by id asc limit $2`, [lastId, limit]);
  return rows.map((r) => ({ id: Number(r.id), event: r.payload as AquahabEvent }));
}

export async function lastEventId(): Promise<number> {
  const r = await q<{ id: string | null }>(`select max(id) as id from events`);
  return Number(r[0]?.id ?? 0);
}
