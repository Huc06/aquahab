// The room board is not a second list the CEO maintains. Each column is a kind of memory the crew
// already filed, so the board is always what the memory says.
import { q } from "./db.ts";
import type { BoardCard, BoardColumn, BoardResponse, MemoryType } from "./contract.ts";

const COLUMNS: { column: BoardColumn; title: string; type: MemoryType }[] = [
  { column: "backlog", title: "Next", type: "next" },
  { column: "blocked", title: "Blocked", type: "failure" },
  { column: "decided", title: "Decided", type: "decision" },
  { column: "done", title: "Done", type: "done" },
];

export async function getBoard(roomId: string): Promise<BoardResponse> {
  const rows = await q(
    `select id, type, agent, text, blob_id, created_at from memory_jobs
     where room_id = $1 and status = 'stored' and type = any($2::text[])
     order by created_at desc limit 200`,
    [roomId, COLUMNS.map((c) => c.type)],
  );
  const cards: BoardCard[] = rows.map((r) => ({
    jobId: r.id,
    blobId: r.blob_id ?? null,
    type: r.type,
    text: r.text,
    agent: r.agent,
    createdAt: new Date(r.created_at).toISOString(),
  }));
  return {
    roomId,
    columns: COLUMNS.map((c) => ({ column: c.column, title: c.title, cards: cards.filter((card) => card.type === c.type) })),
  };
}
