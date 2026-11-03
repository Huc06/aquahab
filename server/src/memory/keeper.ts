// The Walrus Keeper: the one code path that writes memories. Every write is
//   1. redacted, 2. typed (the type picks the filing crew member), 3. queued in the ledger,
//   4. submitted, paced, signed by the filing member's own delegate key, with an account-wide idempotency key,
//   5. polled until the relayer reports a blob id, 6. announced (the 3D object appears, Telegram is edited).
// Nothing reaches Walrus without the CEO's approval: captures are typed by the CEO, debrief candidates are
// kept by the CEO, and feedback is the CEO's own rating. No autoSave, no analyze().
import { FILED_BY, type MemoryJob, type MemoryType, type Role } from "../contract.ts";
import { env } from "../env.ts";
import { one, q } from "../db.ts";
import { emit } from "../events.ts";
import { localParts, newId, sha256 } from "../util.ts";
import { formatMemory, redact } from "./format.ts";
import { clientFor } from "./walrus.ts";

export interface FileRequest {
  roomId: string | null; // null = the CEO namespace
  roomSlug: string; // or "ceo"
  namespace: string;
  type: MemoryType;
  body: string;
  source: "capture" | "debrief" | "feedback" | "preference" | "import" | "telegram";
  by?: Role;
  supersedes?: string | null;
  candidateId?: string | null;
  imported?: boolean;
  /** Telegram message to edit when the memory is stored. */
  notify?: { chatId: number; messageId: number } | null;
}

export class EmptyMemoryError extends Error {}

export function toJob(r: Record<string, any>): MemoryJob {
  return {
    jobId: r.id,
    status: r.status,
    blobId: r.blob_id ?? null,
    agent: r.agent,
    roomId: r.room_id ?? null,
    namespace: r.namespace,
    type: r.type,
    text: r.body,
    error: r.error ?? null,
    createdAt: new Date(r.created_at).toISOString(),
    storedAt: r.stored_at ? new Date(r.stored_at).toISOString() : null,
    redacted: !!r.redacted,
  };
}

/** Queue one memory. Returns the existing job when the same memory was already filed (idempotent). */
export async function file(req: FileRequest): Promise<MemoryJob> {
  const { text: body, removed } = redact(req.body);
  if (!body || body === "[removed]") throw new EmptyMemoryError("Nothing left to remember after redaction.");
  const by = req.by ?? FILED_BY[req.type];
  const date = localParts(new Date(), env.timezone()).date;
  const text = formatMemory({ type: req.type, room: req.roomSlug, date, by, supersedes: req.supersedes, imported: req.imported, body });
  // Idempotency keys are account-wide on the relayer, so they carry an app and room prefix.
  const idem = `aq:${req.roomSlug}:${sha256(`${req.namespace}|${req.type}|${body.toLowerCase()}`).slice(0, 16)}`;
  const existing = await one(`select * from memory_jobs where idem_key = $1`, [idem]);
  if (existing) return toJob(existing);
  const row = await one(
    `insert into memory_jobs (id, room_id, namespace, agent, type, body, text, idem_key, source, redacted, supersedes, candidate_id, notify)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
     on conflict (idem_key) do nothing returning *`,
    [
      newId("mj"),
      req.roomId,
      req.namespace,
      by,
      req.type,
      body,
      text,
      idem,
      req.source,
      removed > 0,
      req.supersedes ?? null,
      req.candidateId ?? null,
      req.notify ? JSON.stringify(req.notify) : null,
    ],
  );
  const job = toJob(row ?? (await one(`select * from memory_jobs where idem_key = $1`, [idem]))!);
  await emit({ type: "memory.queued", job });
  return job;
}

// ---------- pacing ----------
// Mainnet allowed about 12 remembers a minute per key and about 24 a minute per account (walrus-memory
// #1116). Extra keys do not raise the account ceiling, so the gate paces both.
const ACCOUNT_GAP_MS = 2_700;
const KEY_GAP_MS = 5_200;
let lastSubmit = 0;
const lastByKey = new Map<string, number>();
let pausedUntil = 0;

export const writesPausedUntil = () => pausedUntil;

function backoffSeconds(attempts: number) {
  return Math.min(600, 15 * 2 ** Math.max(0, attempts - 1));
}

function errInfo(e: unknown): { status: number | null; retryAfter: number | null; message: string } {
  const err = e as { status?: number; retryAfterSeconds?: number; message?: string };
  const message = String(err?.message ?? e).slice(0, 400);
  const status = typeof err?.status === "number" ? err.status : /\b429\b|rate.?limit/i.test(message) ? 429 : /\b503\b|paused/i.test(message) ? 503 : null;
  return { status, retryAfter: err?.retryAfterSeconds ?? null, message };
}

export interface ProcessResult {
  submitted: number;
  stored: MemoryJob[];
  failed: MemoryJob[];
  rateLimited: boolean;
}

/** One pass of the write queue: submit due jobs (paced), then settle pending ones. Safe to call often. */
export async function processQueue(opts: { maxSubmit?: number; sleep?: (ms: number) => Promise<void> } = {}): Promise<ProcessResult> {
  const pause = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const result: ProcessResult = { submitted: 0, stored: [], failed: [], rateLimited: false };

  if (Date.now() >= pausedUntil) {
    const due = await q(`select * from memory_jobs where status = 'queued' and next_at <= now() order by created_at asc limit $1`, [opts.maxSubmit ?? 6]);
    for (const j of due) {
      const { client, signer } = clientFor(j.agent as Role);
      const wait = Math.max(0, lastSubmit + ACCOUNT_GAP_MS - Date.now(), (lastByKey.get(signer) ?? 0) + KEY_GAP_MS - Date.now());
      if (wait) await pause(wait);
      lastSubmit = Date.now();
      lastByKey.set(signer, lastSubmit);
      try {
        const acc = await client.remember(j.text, j.namespace, { idempotencyKey: j.idem_key });
        await q(`update memory_jobs set status='pending', relayer_job_id=$2, signer=$3, attempts=attempts+1, error=null, updated_at=now() where id=$1`, [
          j.id,
          acc.job_id,
          signer,
        ]);
        result.submitted++;
      } catch (e) {
        const { status, retryAfter, message } = errInfo(e);
        if (status === 429 || status === 503) {
          // Honour the relayer's retry_after; a 503 means writes are paused relayer-side.
          const secs = retryAfter ?? (status === 503 ? 60 : 30);
          pausedUntil = Date.now() + secs * 1000;
          await q(`update memory_jobs set error=$2, next_at=now() + ($3 || ' seconds')::interval, updated_at=now() where id=$1`, [j.id, message, String(secs)]);
          result.rateLimited = true;
          break;
        }
        const attempts = Number(j.attempts) + 1;
        if (attempts >= 6) {
          const row = await one(`update memory_jobs set status='failed', attempts=$2, error=$3, updated_at=now() where id=$1 returning *`, [j.id, attempts, message]);
          const job = toJob(row!);
          result.failed.push(job);
          await emit({ type: "memory.failed", job });
        } else {
          await q(`update memory_jobs set attempts=$2, error=$3, next_at=now() + ($4 || ' seconds')::interval, updated_at=now() where id=$1`, [
            j.id,
            attempts,
            message,
            String(backoffSeconds(attempts)),
          ]);
        }
      }
    }
  }

  const pending = await q(`select * from memory_jobs where status = 'pending' and relayer_job_id is not null order by created_at asc limit 60`);
  const bySigner = new Map<string, Record<string, any>[]>();
  for (const p of pending) {
    const s = p.signer ?? p.agent;
    bySigner.set(s, [...(bySigner.get(s) ?? []), p]);
  }
  for (const [signer, jobs] of bySigner) {
    try {
      const { client } = clientFor(signer as Role);
      const st = await client.getRememberBulkStatus(jobs.map((j) => j.relayer_job_id));
      const byId = new Map(st.results.map((r) => [r.job_id, r]));
      for (const j of jobs) {
        const r = byId.get(j.relayer_job_id);
        if (!r) continue;
        if (r.status === "done" && r.blob_id) {
          const row = await one(`update memory_jobs set status='stored', blob_id=$2, error=null, stored_at=now(), updated_at=now() where id=$1 returning *`, [j.id, r.blob_id]);
          await q(`insert into memory_texts (blob_id, namespace, text) values ($1,$2,$3) on conflict (blob_id) do nothing`, [r.blob_id, j.namespace, j.text]);
          if (j.candidate_id) await q(`update candidates set status='kept', job_id=$2 where id=$1`, [j.candidate_id, j.id]);
          const job = toJob(row!);
          result.stored.push(job);
          await emit({ type: "memory.stored", job });
        } else if (r.status === "failed" || r.status === "not_found") {
          // Requeue: the idempotency key makes the retry safe (it cannot mint a second blob).
          const attempts = Number(j.attempts);
          if (attempts >= 5) {
            const row = await one(`update memory_jobs set status='failed', error=$2, updated_at=now() where id=$1 returning *`, [j.id, r.error ?? r.status]);
            const job = toJob(row!);
            result.failed.push(job);
            await emit({ type: "memory.failed", job });
          } else {
            await q(`update memory_jobs set status='queued', error=$2, next_at=now() + ($3 || ' seconds')::interval, updated_at=now() where id=$1`, [
              j.id,
              r.error ?? r.status,
              String(backoffSeconds(attempts)),
            ]);
          }
        }
      }
    } catch (e) {
      const { status, retryAfter } = errInfo(e);
      if (status === 429) pausedUntil = Date.now() + (retryAfter ?? 30) * 1000;
      // Status endpoint hiccup: try again on the next pass.
    }
  }
  return result;
}

export async function queueCounts(): Promise<{ queued: number; pending: number; failed: number; stored: number }> {
  const rows = await q<{ status: string; n: string }>(`select status, count(*) as n from memory_jobs group by status`);
  const by = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
  return { queued: by.queued ?? 0, pending: by.pending ?? 0, failed: by.failed ?? 0, stored: by.stored ?? 0 };
}

export async function getJob(id: string): Promise<MemoryJob | null> {
  const r = await one(`select * from memory_jobs where id = $1`, [id]);
  return r ? toJob(r) : null;
}

/** Retry a failed job from scratch (same idempotency key). */
export async function retryJob(id: string): Promise<MemoryJob | null> {
  const r = await one(`update memory_jobs set status='queued', attempts=0, error=null, next_at=now(), updated_at=now() where id=$1 and status='failed' returning *`, [id]);
  return r ? toJob(r) : null;
}
