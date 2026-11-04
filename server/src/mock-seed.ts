// Mock mode only (`pnpm dev:mock`): give the frontend a room with a few memories and a brief to render.
// These go into the SDK's in-memory MemWalMock, never to Walrus. Refused outside mock mode.
import { capture } from "./actions.ts";
import { runBrief } from "./brief.ts";
import { processQueue } from "./memory/keeper.ts";
import { isMock } from "./memory/walrus.ts";
import { createRoom, listRooms } from "./rooms.ts";

const SAMPLE = [
  "d: Read the crew roster and memory Blobs from Sui through Tatum; Tatum no longer serves Sui JSON-RPC",
  "f: The relayer timed out on a slow resolver; raised the connect timeout to 30 s",
  "n: Wire the Briefing drawer to GET /api/rooms/:id/brief/latest",
  "done: Six crew delegate keys hired on mainnet through Tatum",
  "l: Each memory Blob carries memwal_agent_id on-chain, so authorship comes from Sui",
  "due: Submit Total Recall by 10 Nov 12:00 UTC",
  "s: Show the day-one brief next to the day-eight brief in the video",
];

export async function seedMock() {
  if (!isMock()) throw new Error("mock seed runs only with MEMORY_MODE=mock");
  if ((await listRooms()).length) return;
  const room = await createRoom({ slug: "aquahab", name: "Aquahab" });
  await runBrief(room, "day-one");
  for (const text of SAMPLE) await capture(room, text);
  await processQueue({ sleep: async () => {} });
  await processQueue({ sleep: async () => {} });
  await runBrief(room, "manual");
  console.log(`[mock] seeded room ${room.slug} with ${SAMPLE.length} mock memories and two briefs`);
}
