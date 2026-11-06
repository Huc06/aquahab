// The clock that makes the crew message first. One `tick()`:
//   1. moves the Keeper's write queue (submit paced writes, settle pending ones)
//   2. sends each room's morning brief and evening debrief once per local day, at the CEO's times;
//      after the brief, the crew holds its standup in the office (standup.ts)
// A long-lived host calls tick() on an interval; a serverless host calls POST /api/cron/tick.
import { env } from "./env.ts";
import { q } from "./db.ts";
import { processQueue } from "./memory/keeper.ts";
import { runBrief } from "./brief.ts";
import { runStandup } from "./standup.ts";
import { askDebrief, deliverBrief } from "./telegram.ts";
import { listRooms } from "./rooms.ts";
import { localParts, minutesOf } from "./util.ts";
import type { Room } from "./contract.ts";

/** Fire a daily job when its local time has passed today, at most 3 hours late (so a restart at noon skips the 08:30 brief). */
export function isDue(at: string, now: { hour: number; minute: number }, graceMinutes = 180): boolean {
  const nowMin = now.hour * 60 + now.minute;
  const target = minutesOf(at);
  return nowMin >= target && nowMin - target <= graceMinutes;
}

async function claim(roomId: string, kind: "brief" | "debrief", localDate: string): Promise<boolean> {
  const r = await q(`insert into schedule_runs (room_id, kind, local_date) values ($1,$2,$3) on conflict do nothing returning room_id`, [roomId, kind, localDate]);
  return r.length > 0;
}

export interface TickResult {
  memory: { submitted: number; stored: number; failed: number; rateLimited: boolean };
  briefs: string[];
  debriefs: string[];
  errors: string[];
  ms: number;
}

let running = false;

export async function tick(now = new Date()): Promise<TickResult> {
  const t0 = Date.now();
  const out: TickResult = { memory: { submitted: 0, stored: 0, failed: 0, rateLimited: false }, briefs: [], debriefs: [], errors: [], ms: 0 };
  if (running) return out; // the previous tick is still writing; this one has nothing to add
  running = true;
  try {
    try {
      const m = await processQueue();
      out.memory = { submitted: m.submitted, stored: m.stored.length, failed: m.failed.length, rateLimited: m.rateLimited };
    } catch (e) {
      out.errors.push(`queue: ${(e as Error).message}`);
    }
    const local = localParts(now, env.timezone());
    for (const room of await listRooms()) {
      await runDaily(room, "brief", local, out);
      await runDaily(room, "debrief", local, out);
    }
  } finally {
    running = false;
  }
  out.ms = Date.now() - t0;
  return out;
}

async function runDaily(room: Room, kind: "brief" | "debrief", local: ReturnType<typeof localParts>, out: TickResult) {
  const at = kind === "brief" ? room.briefAt : room.debriefAt;
  if (!isDue(at, local)) return;
  if (!(await claim(room.id, kind, local.date))) return;
  try {
    if (kind === "brief") {
      const b = await runBrief(room, "morning");
      await deliverBrief(room, b);
      out.briefs.push(room.slug);
      // Then the crew talks it over in the office. A failed standup never fails the brief.
      await runStandup(room).catch((e) => out.errors.push(`standup ${room.slug}: ${(e as Error).message}`));
    } else {
      await askDebrief(room);
      out.debriefs.push(room.slug);
    }
  } catch (e) {
    out.errors.push(`${kind} ${room.slug}: ${(e as Error).message}`);
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Long-lived mode: every 20 s while writes are in flight, which also keeps confirmations snappy. */
export function startScheduler(everyMs = 20_000) {
  if (timer) return;
  const run = () =>
    tick()
      .then((r) => {
        if (r.memory.submitted || r.memory.stored || r.memory.failed || r.briefs.length || r.debriefs.length || r.errors.length) {
          console.log(`[tick] ${JSON.stringify(r)}`);
        }
      })
      .catch((e) => console.error(`[tick] ${(e as Error).message}`));
  timer = setInterval(run, everyMs);
  void run();
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
