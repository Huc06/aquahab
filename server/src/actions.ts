// What the CEO does: capture a note, answer the evening debrief, keep or drop the crew's proposals, and rate
// a brief. These are the only ways memories enter Aquahab, and every one goes through the Keeper.
import { FILED_BY, type Candidate, type CandidateDecision, type MemoryJob, type MemoryType, type Room } from "./contract.ts";
import { one, q } from "./db.ts";
import { classifyCapture, extractCandidates, type CodedMemory } from "./llm.ts";
import { file } from "./memory/keeper.ts";
import { parseCapture } from "./memory/format.ts";
import { recall } from "./memory/walrus.ts";
import { CEO_NAMESPACE, CEO_SLUG, getRoom } from "./rooms.ts";
import { getBrief } from "./brief.ts";
import { newId } from "./util.ts";

export class ActionError extends Error {}

/** `d: …`, `f: …`, `n: …` (or free text, classified by the crew). Preferences go to the CEO namespace. */
export async function capture(room: Room, text: string, notify?: { chatId: number; messageId: number } | null): Promise<MemoryJob> {
  const parsed = parseCapture(text);
  if (!parsed.body) throw new ActionError("Write something after the prefix, for example `d: ship the brief first`.");
  const type = parsed.type ?? (await classifyCapture(parsed.body));
  if (type === "preference") {
    return file({ roomId: null, roomSlug: CEO_SLUG, namespace: CEO_NAMESPACE, type, body: parsed.body, source: "capture", notify });
  }
  return file({ roomId: room.id, roomSlug: room.slug, namespace: room.namespace, type, body: parsed.body, source: "capture", notify });
}

export async function openDebrief(room: Room, telegramMessageId?: number | null): Promise<string> {
  const id = newId("deb");
  await q(`insert into debriefs (id, room_id, telegram_message_id) values ($1,$2,$3)`, [id, room.id, telegramMessageId ?? null]);
  return id;
}

export async function pendingDebrief(roomId: string): Promise<{ id: string } | null> {
  return one(`select id from debriefs where room_id = $1 and status = 'asked' and created_at > now() - interval '20 hours' order by created_at desc limit 1`, [roomId]);
}

function toCandidate(r: Record<string, any>): Candidate {
  return {
    id: r.id,
    roomId: r.room_id,
    type: r.type,
    agent: r.agent,
    text: r.text,
    source: r.source,
    status: r.status,
    jobId: r.job_id ?? null,
    supersedes: r.supersedes ?? null,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

/** The CEO's note about the day → the crew's proposed memories (nothing is filed yet). */
export async function answerDebrief(room: Room, note: string, debriefId?: string | null): Promise<Candidate[]> {
  if (!note.trim()) throw new ActionError("Tell the crew how the day went first.");
  const context = await recall({
    namespace: room.namespace,
    query: "recent decisions, failures, next steps and deadlines",
    sort: "recent",
    limit: 25,
    purpose: "debrief",
    roomId: room.id,
    as: "one",
  });
  const existing: CodedMemory[] = context.hits.map((h, i) => ({ code: `m${i + 1}`, blobId: h.blob_id, text: h.text }));
  const codes = new Map(existing.map((m) => [m.code, m.blobId]));
  const drafts = await extractCandidates(note, room.name, existing);
  const debrief = debriefId ?? (await pendingDebrief(room.id))?.id ?? (await openDebrief(room));
  await q(`update debriefs set status='answered', answer=$2, answered_at=now() where id=$1`, [debrief, note.slice(0, 4000)]);
  // A new answer replaces the crew's previous unreviewed proposals for this room.
  await q(`update candidates set status='dropped' where room_id=$1 and status='proposed'`, [room.id]);
  const out: Candidate[] = [];
  for (const d of drafts) {
    const r = await one(
      `insert into candidates (id, room_id, debrief_id, type, agent, text, source, supersedes) values ($1,$2,$3,$4,$5,$6,'debrief',$7) returning *`,
      [newId("cand"), room.id, debrief, d.type, FILED_BY[d.type], d.text.trim(), d.supersedes ? codes.get(d.supersedes) ?? null : null],
    );
    out.push(toCandidate(r!));
  }
  return out;
}

export async function listCandidates(roomId: string): Promise<Candidate[]> {
  return (await q(`select * from candidates where room_id = $1 and status = 'proposed' order by created_at asc`, [roomId])).map(toCandidate);
}

export async function getCandidate(id: string): Promise<Candidate | null> {
  const r = await one(`select * from candidates where id = $1`, [id]);
  return r ? toCandidate(r) : null;
}

/** Keep or drop each proposal. Kept ones are filed by the Keeper, signed by the member whose type it is. */
export async function decide(decisions: CandidateDecision[], notify?: { chatId: number; messageId: number } | null): Promise<MemoryJob[]> {
  const jobs: MemoryJob[] = [];
  for (const d of decisions) {
    const c = await getCandidate(d.id);
    if (!c || c.status !== "proposed") continue;
    if (!d.keep) {
      await q(`update candidates set status='dropped' where id=$1`, [c.id]);
      continue;
    }
    const type: MemoryType = d.type ?? c.type;
    const text = (d.text ?? c.text).trim();
    const room = await getRoom(c.roomId);
    if (!room) continue;
    const job =
      type === "preference"
        ? await file({ roomId: null, roomSlug: CEO_SLUG, namespace: CEO_NAMESPACE, type, body: text, source: "debrief", candidateId: c.id, notify })
        : await file({ roomId: room.id, roomSlug: room.slug, namespace: room.namespace, type, body: text, source: "debrief", supersedes: c.supersedes, candidateId: c.id, notify });
    await q(`update candidates set status='kept', type=$2, agent=$3, text=$4, job_id=$5 where id=$1`, [c.id, type, FILED_BY[type], text, job.jobId]);
    jobs.push(job);
  }
  return jobs;
}

/** A feedback reason is one line a later brief can quote: no line breaks, at most REASON_MAX characters. */
export const REASON_MAX = 200;
export const isOneLineReason = (s: string) => !/[\r\n]/.test(s.trim()) && s.trim().length <= REASON_MAX;

/** 👍 / 👎 on a brief becomes a feedback memory in the CEO namespace, which shapes every later brief. */
export async function rateBrief(briefId: string, rating: "up" | "down", reason?: string, notify?: { chatId: number; messageId: number } | null): Promise<MemoryJob | null> {
  if (reason?.trim() && !isOneLineReason(reason)) throw new ActionError(`Keep the reason to one line, ${REASON_MAX} characters at most.`);
  const brief = await getBrief(briefId);
  if (!brief) throw new ActionError("No such brief.");
  const room = await getRoom(brief.roomId);
  await q(`update briefs set feedback=$2, feedback_reason=coalesce($3, feedback_reason) where id=$1`, [briefId, rating, reason ?? null]);
  const where = `the ${room?.name ?? "project"} brief (day ${brief.dayIndex})`;
  const why = reason?.trim();
  if (rating === "up" && !why) return null; // a bare 👍 is recorded on the brief, not worth a memory
  const body = rating === "up" ? `CEO found ${where} useful: ${why}` : why ? `CEO found ${where} not useful: ${why}` : `CEO found ${where} not useful.`;
  return file({ roomId: null, roomSlug: CEO_SLUG, namespace: CEO_NAMESPACE, type: "feedback", body, source: "feedback", notify });
}
