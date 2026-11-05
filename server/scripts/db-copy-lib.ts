// Pure helpers for db-copy.ts (tested in test/db-copy.test.ts).

export interface CopyTable {
  name: string;
  /** jsonb columns: sent as JSON text, since a string or an array would otherwise not round-trip. */
  jsonb?: string[];
  /** Columns the target assigns itself (bigserial ids). */
  skip?: string[];
  where?: string;
  /** No natural key: copy only into an empty target table, so a re-run does not duplicate. */
  appendOnly?: boolean;
}

// Not copied: `events` (the SSE tail, ephemeral) and `cache`. `telegram.offset` only matters to polling.
export const TABLES: CopyTable[] = [
  { name: "rooms" },
  { name: "settings", jsonb: ["value"], where: "key <> 'telegram.offset'" },
  { name: "memory_jobs", jsonb: ["notify"] },
  { name: "briefs", jsonb: ["sections", "recall"] },
  { name: "debriefs" },
  { name: "candidates" },
  { name: "schedule_runs" },
  { name: "recall_events", jsonb: ["blob_ids"], skip: ["id"], appendOnly: true },
  { name: "memory_texts" },
];

export function insertSql(t: CopyTable, cols: string[]): string {
  const values = cols.map((c, i) => (t.jsonb?.includes(c) ? `$${i + 1}::jsonb` : `$${i + 1}`));
  return `insert into ${t.name} (${cols.join(", ")}) values (${values.join(", ")}) on conflict do nothing returning 1`;
}

export function rowParams(t: CopyTable, cols: string[], row: Record<string, unknown>): unknown[] {
  return cols.map((c) => {
    const v = row[c];
    if (v === null || v === undefined) return null;
    if (t.jsonb?.includes(c)) return JSON.stringify(v);
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "bigint") return v.toString();
    return v;
  });
}
