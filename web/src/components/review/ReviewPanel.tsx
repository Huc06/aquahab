"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { CREW, MEMORY_TYPES, type Candidate, type CandidateDecision, type MemoryJob, type MemoryType } from "@/lib/api-types";
import { useActiveRoom, watchJob } from "@/lib/useApi";

const button = "rounded-md border border-line bg-raised px-3 py-1.5 text-sm text-fg focus-visible:outline-focus disabled:opacity-40";

type Draft = Candidate & { keep: boolean };

// Evening debrief: the CEO says how the day went, the crew proposes memories, and only the kept ones are filed.
export function ReviewPanel() {
  const { room, loading } = useActiveRoom();
  const [text, setText] = useState("");
  const [proposing, setProposing] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [jobs, setJobs] = useState<Record<string, MemoryJob>>({});
  const [message, setMessage] = useState<string | null>(null);
  const cancels = useRef<(() => void)[]>([]);

  useEffect(() => () => cancels.current.forEach((c) => c()), []);

  if (loading) return <p className="text-sm text-fg-3">Loading…</p>;
  if (!room) return <p className="text-sm text-fg-3">Create a room first.</p>;

  const propose = async () => {
    setProposing(true);
    setMessage(null);
    try {
      const list = await api.debrief(room.id, text.trim());
      setDrafts(list.map((c) => ({ ...c, keep: true })));
      if (list.length === 0) setMessage("Nothing to remember from today. That is fine.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "The debrief failed.");
    } finally {
      setProposing(false);
    }
  };

  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => prev?.map((d) => (d.id === id ? { ...d, ...patch } : d)) ?? prev);

  const keptCount = drafts?.filter((d) => d.keep).length ?? 0;

  const file = async () => {
    if (!drafts) return;
    const decisions: CandidateDecision[] = drafts.map((d) => ({ id: d.id, keep: d.keep, text: d.text, type: d.type }));
    setMessage(null);
    try {
      const started = await api.decide(decisions);
      setJobs(Object.fromEntries(started.map((j) => [j.jobId, j])));
      started.forEach((j) =>
        cancels.current.push(watchJob(j.jobId, (job) => setJobs((prev) => ({ ...prev, [job.jobId]: job })))),
      );
      setDrafts(null);
      setText("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Filing failed.");
    }
  };

  const jobList = Object.values(jobs);

  return (
    <div className="space-y-5 text-sm text-fg-2">
      <section className="space-y-2">
        <label className="block space-y-1">
          <span>How did {room.name} go today?</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Decided, broke, next…"
            className="w-full rounded-md border border-line bg-deep p-2 text-fg focus-visible:outline-focus"
          />
        </label>
        <button type="button" className={button} onClick={propose} disabled={proposing || !text.trim()}>
          {proposing ? "Reading your day…" : "Propose memories"}
        </button>
      </section>

      {drafts && drafts.length > 0 && (
        <section className="space-y-3" aria-label="Memory candidates">
          <p className="font-mono text-[13px] text-fg-3">{keptCount} of {drafts.length} kept</p>
          {drafts.map((d) => (
            <article key={d.id} className="space-y-2 rounded-md border border-line-decor bg-raised p-3">
              <p className="font-mono text-[13px] text-fg-3">{CREW[d.agent].name}</p>
              <textarea
                aria-label={`Candidate ${d.id} text`}
                value={d.text}
                onChange={(e) => update(d.id, { text: e.target.value })}
                rows={2}
                className="w-full rounded-md border border-line bg-deep p-2 text-fg focus-visible:outline-focus"
              />
              <div className="flex items-center gap-2 font-mono text-[13px]">
                <select
                  aria-label="Type"
                  value={d.type}
                  onChange={(e) => update(d.id, { type: e.target.value as MemoryType })}
                  className="rounded-sm border border-line bg-deep px-1 text-fg"
                >
                  {MEMORY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label className="ml-auto flex items-center gap-1 font-sans text-sm">
                  <input type="checkbox" checked={d.keep} onChange={(e) => update(d.id, { keep: e.target.checked })} />
                  Keep
                </label>
              </div>
            </article>
          ))}
          <button type="button" className={button} onClick={file} disabled={keptCount === 0}>
            File {keptCount} to memory
          </button>
        </section>
      )}

      {jobList.length > 0 && (
        <section aria-label="Filing status" className="space-y-2">
          {jobList.map((j) => (
            <p key={j.jobId} role="status" className="font-mono text-[13px] text-fg-3">
              {j.type} · {j.status}
              {j.status === "stored" && j.blobId ? ` · ${j.blobId.slice(0, 10)}…` : ""}
              {j.status === "failed" ? ` · ${j.error ?? "failed"}` : ""}
            </p>
          ))}
        </section>
      )}

      {message && <p role="alert" className="text-bad">{message}</p>}
    </div>
  );
}
