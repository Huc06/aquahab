"use client";

import { BlobReceiptPopover } from "@/components/receipt/BlobReceiptPopover";
import { useActiveRoom } from "@/lib/useApi";
import { MOMENT_TYPE, REPLAY_PREVIEW, isDeskRole, type MemoryMoment, useMoments } from "@/lib/moments";
import { useHQ } from "@/lib/store";

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
// This flag is set only in the local visual-review build. Railway omits it, so final demos require real evidence.
const SHOW_DESIGN_PREVIEW = process.env.NEXT_PUBLIC_ENABLE_REWIND_PREVIEW === "true";

function statusCopy(moment: MemoryMoment) {
  if (moment.impact === "used") {
    const briefs = new Set(moment.citations.map((citation) => citation.briefId)).size;
    return `Used in ${briefs} briefing${briefs === 1 ? "" : "s"}`;
  }
  if (moment.impact === "verified") return "Verified on Sui";
  return "Stored on Walrus";
}

function MomentCard({ moment }: { moment: MemoryMoment }) {
  const type = MOMENT_TYPE[moment.memory.type ?? "memory"];
  const selectAgent = useHQ((state) => state.selectAgent);
  const setReplayMoment = useHQ((state) => state.setReplayMoment);
  const capturedAt = moment.job?.createdAt ?? moment.memory.createdAt;

  const replay = () => {
    if (isDeskRole(moment.memory.agent)) selectAgent(moment.memory.agent);
    setReplayMoment(moment);
  };

  return (
    <li className="moment-card rounded-md border border-line bg-raised p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[12px] uppercase tracking-wide text-mem">
          <span aria-hidden="true">{type.glyph}</span> {type.label}
        </p>
        <time className="shrink-0 font-mono text-[11px] text-fg-3" dateTime={capturedAt}>
          {timeFormat.format(new Date(capturedAt))}
        </time>
      </div>
      <p className="mt-2 line-clamp-3 text-sm leading-5 text-fg">{moment.memory.text ?? "Memory text is not available in this local index."}</p>
      <p className="mt-2 text-[12px] text-fg-2">
        {moment.memory.agentLabel ?? moment.memory.agent ?? "Unknown filer"} · <span className="text-ok">{statusCopy(moment)}</span>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {moment.citations.length > 0 ? (
          <button type="button" onClick={replay} className="rounded-sm border border-mem bg-deep px-2.5 py-1 text-[12px] font-medium text-mem focus-visible:outline-focus">
            <span aria-hidden="true">▶ </span>Replay learning loop
          </button>
        ) : (
          <span className="rounded-sm border border-line px-2.5 py-1 text-[12px] text-fg-3">Waiting for a cited brief</span>
        )}
        <BlobReceiptPopover blobId={moment.memory.blobId} />
      </div>
    </li>
  );
}

/** Locket-inspired, evidence-backed recap cards. A card is a stored memory, never a mock event. */
export function MomentsPanel() {
  const { room, loading: roomLoading } = useActiveRoom();
  const timeline = useMoments(room?.id ?? null);
  const selectAgent = useHQ((state) => state.selectAgent);
  const setReplayMoment = useHQ((state) => state.setReplayMoment);

  if (roomLoading) return <p className="text-sm text-fg-3">Loading…</p>;
  if (!room) return <p className="text-sm text-fg-3">Create a room first.</p>;
  if (timeline.loading) return <p className="text-sm text-fg-3">Loading moments…</p>;
  if (timeline.error) return <p role="alert" className="text-sm text-bad">{timeline.error}</p>;

  const data = timeline.data;
  const byDay = new Map<string, MemoryMoment[]>();
  for (const moment of data?.moments ?? []) {
    const day = new Date(moment.memory.createdAt).toDateString();
    byDay.set(day, [...(byDay.get(day) ?? []), moment]);
  }

  return (
    <div className="space-y-4 text-sm text-fg-2">
      <div>
        <p className="text-base font-semibold text-fg">The work remembers.</p>
        <p className="mt-1 text-sm text-fg-3">Replay a stored decision and see the exact briefing line it later informed.</p>
      </div>
      <p className="font-mono text-[12px] text-fg-3">
        {room.name} · {data?.moments.length ?? 0} stored · {data?.citedCount ?? 0} used in briefs · {data?.verifiedCount ?? 0} verified
      </p>
      {byDay.size === 0 && (
        <div className="space-y-3 rounded-md border border-line border-dashed p-3 text-fg-3">
          <p>No replay-ready moment yet. A completed replay needs a stored memory and a later briefing line that cites its blob.</p>
          {SHOW_DESIGN_PREVIEW && (
            <>
              <button
                type="button"
                onClick={() => {
                  selectAgent("one");
                  setReplayMoment(REPLAY_PREVIEW);
                }}
                className="rounded-sm border border-mem bg-deep px-2.5 py-1 text-[12px] font-medium text-mem focus-visible:outline-focus"
              >
                <span aria-hidden="true">▶ </span>Preview animation
              </button>
              <p className="text-[12px] text-fg-3">Development-only visual preview. It has no Walrus record, blob, receipt, or briefing evidence.</p>
            </>
          )}
        </div>
      )}
      {[...byDay.entries()].map(([day, moments]) => (
        <section key={day} className="space-y-2" aria-label={`Moments from ${day}`}>
          <h3 className="font-mono text-[12px] uppercase tracking-wide text-fg-3">{dateFormat.format(new Date(moments[0].memory.createdAt))}</h3>
          <ol className="space-y-2">{moments.map((moment) => <MomentCard key={moment.memory.blobId} moment={moment} />)}</ol>
        </section>
      ))}
    </div>
  );
}
