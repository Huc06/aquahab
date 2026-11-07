// Postgres everywhere: PGlite (embedded) for local development and tests; DATABASE_URL (Railway Postgres
// through node-postgres, or Neon through its HTTP driver) when deployed.
// The database is the server's ledger and cache. Walrus Memory stays the source of truth for memories.
import { mkdirSync } from "node:fs";
import { env } from "./env.ts";

type Row = Record<string, any>;
interface Driver {
  query(text: string, params?: unknown[]): Promise<Row[]>;
  close?(): Promise<void>;
}

let driver: Driver | null = null;
let ready: Promise<void> | null = null;

async function connect(): Promise<Driver> {
  const url = env.databaseUrl();
  // Neon's HTTP driver speaks only to Neon. Any other Postgres (Railway, local) goes through node-postgres.
  if (url && /\.neon\.tech\b/.test(url)) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    return { query: async (text, params = []) => (await sql.query(text, params as any[])) as Row[] };
  }
  if (url) {
    const { default: pg } = await import("pg");
    pg.types.setTypeParser(20, (v: string) => Number(v)); // int8 counts and ids as numbers, like PGlite
    const pool = new pg.Pool({ connectionString: url, max: 5 });
    pool.on("error", (e) => console.warn(`[db] idle client error: ${e.message}`));
    return {
      query: async (text, params = []) => (await pool.query(text, params as any[])).rows as Row[],
      close: () => pool.end(),
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = env.pgliteDir();
  const pg = dir === "memory" ? new PGlite() : (mkdirSync(dir, { recursive: true }), new PGlite(dir));
  return {
    query: async (text, params = []) => (await pg.query<Row>(text, params as any[])).rows,
    close: () => pg.close(),
  };
}

const SCHEMA = [
  `create table if not exists rooms (
     id text primary key,
     slug text not null unique,
     name text not null,
     namespace text not null unique,
     private boolean not null default false,
     brief_at text not null default '08:30',
     debrief_at text not null default '21:00',
     start_date text not null,
     archived boolean not null default false,
     created_at timestamptz not null default now())`,
  `alter table rooms add column if not exists goal text`,
  `alter table rooms add column if not exists context_tags jsonb`,
  `create table if not exists settings (key text primary key, value jsonb not null)`,
  `create table if not exists memory_jobs (
     id text primary key,
     room_id text,
     namespace text not null,
     agent text not null,
     type text not null,
     body text not null,
     text text not null,
     idem_key text not null unique,
     status text not null default 'queued',
     relayer_job_id text,
     signer text,
     blob_id text,
     attempts int not null default 0,
     next_at timestamptz not null default now(),
     error text,
     source text not null,
     redacted boolean not null default false,
     supersedes text,
     candidate_id text,
     notify jsonb,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now(),
     stored_at timestamptz)`,
  `create index if not exists memory_jobs_status on memory_jobs (status)`,
  `create index if not exists memory_jobs_room on memory_jobs (room_id)`,
  `create table if not exists briefs (
     id text primary key,
     room_id text not null,
     kind text not null,
     day_index int not null,
     sections jsonb not null,
     recall jsonb not null,
     source text not null,
     degraded boolean not null default false,
     model text,
     feedback text,
     feedback_reason text,
     telegram_message_id bigint,
     created_at timestamptz not null default now())`,
  `create index if not exists briefs_room on briefs (room_id, created_at desc)`,
  `create table if not exists standups (
     id text primary key,
     room_id text not null,
     day_index int not null,
     turns jsonb not null,
     recalled int not null,
     source text not null,
     model text,
     created_at timestamptz not null default now())`,
  `create index if not exists standups_room on standups (room_id, created_at desc)`,
  `create table if not exists debriefs (
     id text primary key,
     room_id text not null,
     status text not null default 'asked',
     answer text,
     telegram_message_id bigint,
     created_at timestamptz not null default now(),
     answered_at timestamptz)`,
  `create table if not exists candidates (
     id text primary key,
     room_id text not null,
     debrief_id text,
     type text not null,
     agent text not null,
     text text not null,
     source text not null,
     status text not null default 'proposed',
     keep boolean not null default true,
     job_id text,
     supersedes text,
     created_at timestamptz not null default now())`,
  `create index if not exists candidates_room on candidates (room_id, status)`,
  `create table if not exists schedule_runs (
     room_id text not null,
     kind text not null,
     local_date text not null,
     ran_at timestamptz not null default now(),
     primary key (room_id, kind, local_date))`,
  `create table if not exists recall_events (
     id bigserial primary key,
     room_id text,
     purpose text not null,
     query text not null,
     namespace text not null,
     blob_ids jsonb not null,
     latency_ms int not null,
     ok boolean not null,
     created_at timestamptz not null default now())`,
  `create table if not exists memory_texts (
     blob_id text primary key,
     namespace text not null,
     text text not null,
     seen_at timestamptz not null default now())`,
  `create table if not exists events (
     id bigserial primary key,
     type text not null,
     payload jsonb not null,
     created_at timestamptz not null default now())`,
  `create table if not exists cache (key text primary key, value jsonb not null, expires_at timestamptz not null)`,
];

export async function db(): Promise<Driver> {
  if (!driver) driver = await connect();
  if (!ready) {
    const d = driver;
    ready = (async () => {
      for (const stmt of SCHEMA) await d.query(stmt);
    })();
  }
  await ready;
  return driver;
}

export async function q<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await db()).query(text, params) as Promise<T[]>;
}

export async function one<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

export async function closeDb() {
  await driver?.close?.();
  driver = null;
  ready = null;
}

// ---------- small helpers built on the tables above ----------

export async function getSetting<T>(key: string): Promise<T | null> {
  const r = await one<{ value: T }>(`select value from settings where key = $1`, [key]);
  return r ? r.value : null;
}

export async function setSetting(key: string, value: unknown) {
  await q(`insert into settings (key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value`, [
    key,
    JSON.stringify(value),
  ]);
}

/** Read-through cache with a TTL, so pages poll the server and never Tatum or the relayer directly. */
/** `keep` says whether a loaded value is complete enough to cache; an incomplete one is loaded again next time. */
export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>, keep?: (value: T) => boolean): Promise<T> {
  const hit = await one<{ value: T }>(`select value from cache where key = $1 and expires_at > now()`, [key]);
  if (hit) return hit.value;
  const value = await load();
  if (keep && !keep(value)) return value;
  await q(
    `insert into cache (key, value, expires_at) values ($1, $2::jsonb, now() + ($3 || ' seconds')::interval)
     on conflict (key) do update set value = excluded.value, expires_at = excluded.expires_at`,
    [key, JSON.stringify(value), String(ttlSeconds)],
  );
  return value;
}

export async function bust(prefix: string) {
  await q(`delete from cache where key like $1`, [`${prefix}%`]);
}
