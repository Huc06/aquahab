// Typed client for the crew server (shapes in ./api-types.ts, generated from server/src/contract.ts).
// Every call goes to same-origin /api, which next.config.ts proxies to the server.
//
// Local UI work without mainnet: run the server with MEMORY_MODE=mock AUTH=off (see server/README.md).
// That is the real API over an in-memory Walrus mock, so the UI never drifts from the contract.
import type {
  AquahabEvent,
  BoardResponse,
  Brief,
  BriefFeedbackRequest,
  Candidate,
  CandidateDecision,
  CreateRoomRequest,
  CrewResponse,
  HealthResponse,
  MemoriesResponse,
  MemoryJob,
  MemoryReceipt,
  ProofResponse,
  RecallResponse,
  Room,
  Standup,
  UpdateRoomRequest,
} from "./api-types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (json as { error?: string }).error ?? res.statusText);
  return json as T;
}

const enc = encodeURIComponent;

export const api = {
  health: () => call<HealthResponse>("GET", "/health"),
  session: () => call<{ ceo: boolean }>("GET", "/session"),

  rooms: () => call<Room[]>("GET", "/rooms"),
  room: (id: string) => call<Room>("GET", `/rooms/${enc(id)}`),
  createRoom: (req: CreateRoomRequest) => call<Room>("POST", "/rooms", req),
  updateRoom: (id: string, req: UpdateRoomRequest) => call<Room>("PATCH", `/rooms/${enc(id)}`, req),

  board: (roomId: string) => call<BoardResponse>("GET", `/rooms/${enc(roomId)}/board`),

  latestBrief: (roomId: string) => call<Brief>("GET", `/rooms/${enc(roomId)}/brief/latest`),
  briefs: (roomId: string) => call<Brief[]>("GET", `/rooms/${enc(roomId)}/briefs`),
  runBrief: (roomId: string) => call<Brief>("POST", `/rooms/${enc(roomId)}/brief`),
  rateBrief: (briefId: string, req: BriefFeedbackRequest) => call<{ job: MemoryJob | null }>("POST", `/briefs/${enc(briefId)}/feedback`, req),

  /** The crew talking to each other about the room (held after the morning brief). 404 until the first one. */
  latestStandup: (roomId: string) => call<Standup>("GET", `/rooms/${enc(roomId)}/standup/latest`),
  /** CEO only. 409 when fewer than two members have memories in the room. */
  runStandup: (roomId: string) => call<Standup>("POST", `/rooms/${enc(roomId)}/standup`),

  /** `d:` decision · `f:` failure · `n:` next · `done:` · `l:` learned · `due:` deadline · `s:` story · `p:` preference. */
  capture: (roomId: string, text: string) => call<MemoryJob>("POST", `/rooms/${enc(roomId)}/capture`, { text }),
  debrief: (roomId: string, text: string) => call<Candidate[]>("POST", `/rooms/${enc(roomId)}/debrief`, { text }),
  candidates: (roomId: string) => call<Candidate[]>("GET", `/rooms/${enc(roomId)}/candidates`),
  decide: (decisions: CandidateDecision[]) => call<MemoryJob[]>("POST", "/candidates/decide", { decisions }),

  job: (jobId: string) => call<MemoryJob>("GET", `/memory-jobs/${enc(jobId)}`),
  jobs: (roomId?: string) => call<MemoryJob[]>("GET", `/memory-jobs${roomId ? `?roomId=${enc(roomId)}` : ""}`),
  retryJob: (jobId: string) => call<MemoryJob>("POST", `/memory-jobs/${enc(jobId)}/retry`),

  memories: (roomId: string) => call<MemoriesResponse>("GET", `/rooms/${enc(roomId)}/memories`),
  recall: (roomId: string, q: string) => call<RecallResponse>("GET", `/rooms/${enc(roomId)}/recall?q=${enc(q)}`),
  receipt: (blobId: string) => call<MemoryReceipt>("GET", `/memories/${enc(blobId)}/receipt`),

  crew: () => call<CrewResponse>("GET", "/crew"),
  proof: () => call<ProofResponse>("GET", "/proof"),
};

/**
 * Live cues for the 3D office: `memory.stored` (an object appears), `recall.used` (cited objects glow),
 * `brief.created`, `standup.created`, `crew.changed`. EventSource reconnects on its own and resumes from the last event id.
 */
export function onEvents(handler: (e: AquahabEvent) => void): () => void {
  const es = new EventSource("/api/events");
  const types: AquahabEvent["type"][] = ["memory.queued", "memory.stored", "memory.failed", "recall.used", "brief.created", "standup.created", "crew.changed"];
  const listener = (m: MessageEvent<string>) => {
    try {
      handler(JSON.parse(m.data) as AquahabEvent);
    } catch {
      // ignore a malformed frame
    }
  };
  for (const t of types) es.addEventListener(t, listener as EventListener);
  return () => es.close();
}
