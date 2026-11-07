"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { BlobReceiptPopover } from "@/components/receipt/BlobReceiptPopover";
import { MOMENT_TYPE, type MemoryMoment } from "@/lib/moments";
import { useHQ } from "@/lib/store";

const shortBlob = (blobId: string) => `${blobId.slice(0, 6)}…${blobId.slice(-4)}`;
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const SLIDE_COUNT = 3;
const CARD_NAMES = ["Captured", "Stored", "Brief changed"];

function ReplayScrubber({ stage, onChange }: { stage: number; onChange: (stage: number) => void }) {
  return (
    <label className="flex w-full max-w-sm items-center gap-3">
      <span className="font-mono text-[11px] text-fg-3">00:00</span>
      <input
        type="range"
        min="0"
        max={SLIDE_COUNT - 1}
        step="1"
        value={stage}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Replay position"
        aria-valuetext={`${CARD_NAMES[stage]}, card ${stage + 1} of ${SLIDE_COUNT}`}
        className="moment-scrubber min-w-0 flex-1 accent-[var(--color-memory)]"
      />
      <span className="font-mono text-[11px] text-fg-3">00:09</span>
    </label>
  );
}

function StoryFrame({ children }: { children: ReactNode }) {
  return <article className="moment-story-card flex h-[min(72svh,640px)] w-[min(88vw,480px)] flex-col overflow-hidden rounded-[24px] border border-mem/70 bg-surface shadow-2xl">{children}</article>;
}

function CapturedCard({ moment }: { moment: MemoryMoment }) {
  const type = MOMENT_TYPE[moment.memory.type ?? "memory"];
  const capturedAt = moment.job?.createdAt ?? moment.memory.createdAt;
  return (
    <StoryFrame>
      <div className="moment-story-glow flex flex-1 flex-col justify-between p-7 text-left">
        <div>
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-mem">Captured</p>
          <div className="mt-8 grid h-14 w-14 place-items-center rounded-full border border-mem bg-deep text-2xl text-mem" aria-hidden="true">{type.glyph}</div>
          <p className="mt-8 text-2xl font-semibold leading-9 text-fg">{moment.memory.text ?? "Stored project memory"}</p>
        </div>
        <div className="border-t border-line-decor pt-4">
          <p className="text-sm text-fg-2">{moment.memory.agentLabel ?? moment.memory.agent ?? "Unknown filer"} captured a {type.label.toLowerCase()}.</p>
          <time className="mt-1 block font-mono text-[12px] text-fg-3" dateTime={capturedAt}>{dateTimeFormat.format(new Date(capturedAt))}</time>
        </div>
      </div>
    </StoryFrame>
  );
}

function StoredCard({ moment }: { moment: MemoryMoment }) {
  const storedAt = moment.job?.storedAt ?? moment.memory.createdAt;
  return (
    <StoryFrame>
      <div className="moment-story-vault flex flex-1 flex-col items-center justify-between p-7 text-center">
        <div className="mt-10">
          <div className="moment-vault-orb mx-auto grid h-28 w-28 place-items-center rounded-full border border-mem bg-deep text-4xl text-mem" aria-hidden="true">✦</div>
          <p className="mt-8 font-mono text-[12px] uppercase tracking-[0.18em] text-mem">{moment.preview ? "Storage preview" : "Stored in the Vault"}</p>
          <p className="mt-3 text-2xl font-semibold text-fg">{moment.preview ? "A decision becomes memory" : `Blob ${shortBlob(moment.memory.blobId)}`}</p>
          <p className="mt-3 text-sm text-fg-2">{moment.preview ? "The live replay replaces this screen with its returned blob and receipt." : `Confirmed ${dateTimeFormat.format(new Date(storedAt))}.`}</p>
        </div>
        {!moment.preview ? <div className="mb-3"><BlobReceiptPopover blobId={moment.memory.blobId} /></div> : <p className="mb-3 text-[12px] text-fg-3">Preview only. No Walrus record is claimed.</p>}
      </div>
    </StoryFrame>
  );
}

function ChangedCard({ moment }: { moment: MemoryMoment }) {
  const citation = moment.citations[0] ?? null;
  return (
    <StoryFrame>
      <div className="moment-story-brief flex flex-1 flex-col justify-between p-7 text-left">
        <div>
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-mem">{citation ? "The work changed" : "Waiting for impact"}</p>
          {citation ? (
            <>
              <p className="mt-8 text-[13px] font-semibold uppercase tracking-wide text-fg-2">{citation.section}</p>
              <p className="mt-4 border-l-2 border-mem pl-4 text-2xl font-semibold leading-9 text-fg">“{citation.line}”</p>
            </>
          ) : (
            <p className="mt-8 text-2xl font-semibold leading-9 text-fg">This memory has not shaped a briefing yet.</p>
          )}
        </div>
        <div className="border-t border-line-decor pt-4">
          {citation ? (
            <>
              <p className="text-sm text-ok">A real brief cited this exact memory.</p>
              <p className="mt-1 text-[12px] text-fg-3">{dateTimeFormat.format(new Date(citation.briefCreatedAt))}</p>
              {!moment.preview && <div className="mt-3"><BlobReceiptPopover blobId={moment.memory.blobId} /></div>}
            </>
          ) : <p className="text-sm text-fg-2">Run a brief after this memory is stored to make its effect visible.</p>}
        </div>
      </div>
    </StoryFrame>
  );
}

function StoryCard({ stage, moment }: { stage: number; moment: MemoryMoment }) {
  if (stage === 0) return <CapturedCard moment={moment} />;
  if (stage === 1) return <StoredCard moment={moment} />;
  return <ChangedCard moment={moment} />;
}

function MomentReplayPlayer({ moment, onClose }: { moment: MemoryMoment; onClose: () => void }) {
  const [stage, setStage] = useState(0);
  const titleId = useId();

  useEffect(() => {
    if (stage === SLIDE_COUNT - 1) return;
    const timer = window.setTimeout(() => setStage((current) => Math.min(current + 1, SLIDE_COUNT - 1)), 3100);
    return () => window.clearTimeout(timer);
  }, [stage]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setStage((current) => Math.min(current + 1, SLIDE_COUNT - 1));
      if (event.key === "ArrowLeft") setStage((current) => Math.max(current - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="pointer-events-auto absolute inset-0 z-40 grid place-items-center overflow-hidden bg-deep/90 p-4 backdrop-blur-md">
      <div className="absolute inset-0 moment-replay-water" aria-hidden="true" />
      <div className="relative z-10 flex h-full w-full max-w-5xl flex-col items-center justify-between py-3">
        <header className="flex w-full items-center justify-between gap-4">
          <div><p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mem">{moment.preview ? "Rewind · design preview" : "Rewind · memory replay"}</p><h2 id={titleId} className="sr-only">Memory Replay</h2></div>
          <div className="flex items-center gap-3"><span className="font-mono text-[11px] text-fg-3">{stage + 1} / {SLIDE_COUNT}</span><button type="button" onClick={onClose} aria-label="Close replay" className="rounded-full border border-line bg-surface/90 px-3 py-1.5 text-sm text-fg-2 focus-visible:outline-focus">×</button></div>
        </header>
        <div className="flex flex-1 items-center justify-center py-5" aria-live="polite"><div key={stage} className="moment-story-enter"><StoryCard stage={stage} moment={moment} /></div></div>
        <footer className="flex w-full items-center justify-between gap-3">
          <button type="button" onClick={() => setStage((current) => Math.max(current - 1, 0))} disabled={stage === 0} className="rounded-full border border-line bg-surface/90 px-4 py-2 text-sm text-fg-2 focus-visible:outline-focus disabled:opacity-30">← Back</button>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5"><ReplayScrubber stage={stage} onChange={setStage} /><p className="text-center text-[11px] text-fg-3">{CARD_NAMES[stage]}</p></div>
          <button type="button" onClick={() => setStage((current) => Math.min(current + 1, SLIDE_COUNT - 1))} disabled={stage === SLIDE_COUNT - 1} className="rounded-full border border-mem bg-surface/90 px-4 py-2 text-sm text-mem focus-visible:outline-focus disabled:opacity-30">Next →</button>
        </footer>
      </div>
    </section>
  );
}

/** Full-screen, one-card-at-a-time replay. The final card uses only an actual briefing citation. */
export function MomentReplayOverlay() {
  const moment = useHQ((state) => state.replayMoment);
  const setReplayMoment = useHQ((state) => state.setReplayMoment);
  if (!moment) return null;
  return <MomentReplayPlayer key={moment.memory.blobId} moment={moment} onClose={() => setReplayMoment(null)} />;
}
