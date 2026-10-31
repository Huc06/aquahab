"use client";

import { useEffect, useRef, useState } from "react";
import {
  fileCandidates,
  isCredentialLike,
  proposeCandidates,
  type Candidate,
  type CandidateScope,
  type CandidateType,
  type FilingStatus,
  type Rating,
} from "@/lib/feedback";

// The task under review. Mock until the backend serves task output (docs/features/feedback-loop.md).
const TASK = {
  agent: "Researcher",
  title: "Market brief",
  output: "Sui wallet interest in Vietnam centers on mobile payments. Four sources, two official and two blog posts.",
};

const RATINGS: { value: Rating; label: string }[] = [
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
];

const STATUS_LABEL: Record<FilingStatus, string> = {
  queued: "queued",
  pending: "pending",
  stored: "stored (mock, not on Walrus)",
};

const buttonClass =
  "rounded-md border border-line bg-raised px-3 py-1.5 text-sm text-fg focus-visible:outline-focus disabled:opacity-40";

// Review a task output, rate it, and turn the feedback into memory candidates.
// Nothing is filed until the CEO presses File. Only kept candidates are filed.
export function ReviewPanel() {
  const [rating, setRating] = useState<Rating | null>(null);
  const [comment, setComment] = useState("");
  const [instruction, setInstruction] = useState("");
  const [proposing, setProposing] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [statuses, setStatuses] = useState<Record<string, FilingStatus>>({});
  const cancelRef = useRef<() => void>(() => {});

  useEffect(() => () => cancelRef.current(), []);

  const commentRequired = rating === "neutral" || rating === "negative";
  const canPropose = rating !== null && (!commentRequired || comment.trim().length > 0) && !proposing;

  const propose = () => {
    if (!rating || !canPropose) return;
    setProposing(true);
    setTimeout(() => {
      setCandidates(proposeCandidates(rating, comment, instruction));
      setProposing(false);
    }, 400);
  };

  const updateCandidate = (id: string, patch: Partial<Candidate>) =>
    setCandidates((prev) => prev?.map((c) => (c.id === id ? { ...c, ...patch } : c)) ?? prev);

  const editText = (id: string, text: string) =>
    updateCandidate(id, { text, blocked: isCredentialLike(text), kept: !isCredentialLike(text) });

  const keptIds = candidates?.filter((c) => c.kept).map((c) => c.id) ?? [];
  const filing = Object.values(statuses).some((s) => s !== "stored");
  const filed = keptIds.length > 0 && keptIds.every((id) => statuses[id]);

  const file = () => {
    if (keptIds.length === 0 || filing || filed) return;
    cancelRef.current();
    setStatuses(Object.fromEntries(keptIds.map((id) => [id, "queued" as FilingStatus])));
    cancelRef.current = fileCandidates(keptIds, (id, status) => setStatuses((prev) => ({ ...prev, [id]: status })));
  };

  return (
    <div className="space-y-5 text-sm text-fg-2">
      <section className="space-y-2">
        <p className="font-semibold text-fg">
          {TASK.agent}: {TASK.title}
        </p>
        <p className="rounded-md border border-line-decor bg-raised p-3 text-fg">{TASK.output}</p>
        <p className="text-fg-3">Recalled memory for this task: none yet. Memory is not connected.</p>
      </section>

      <section className="space-y-2" aria-labelledby="rating-heading">
        <h3 id="rating-heading" className="font-semibold text-fg">
          Rate this output
        </h3>
        <div className="flex gap-2">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={rating === r.value}
              onClick={() => setRating(r.value)}
              className={`${buttonClass} ${rating === r.value ? "border-line bg-deep text-fg" : ""}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <label className="block space-y-1">
          <span>
            Comment{commentRequired ? " (required)" : " (optional)"}
          </span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-line bg-deep p-2 text-fg focus-visible:outline-focus"
          />
        </label>
        <label className="block space-y-1">
          <span>What should the agent do differently? (optional)</span>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-line bg-deep p-2 text-fg focus-visible:outline-focus"
          />
        </label>
        <button type="button" onClick={propose} disabled={!canPropose} className={buttonClass}>
          {proposing ? "Reading your feedback…" : "Propose memories"}
        </button>
      </section>

      {candidates && (
        <section className="space-y-3" aria-labelledby="candidates-heading">
          <div className="flex items-center justify-between">
            <h3 id="candidates-heading" className="font-semibold text-fg">
              Memory candidates
            </h3>
            <span className="font-mono text-[13px] text-fg-3">
              {keptIds.length} of {candidates.length} kept
            </span>
          </div>

          {candidates.length === 0 && <p className="text-fg-3">Nothing to remember from this review. That is fine.</p>}

          {candidates.map((c) => (
            <article key={c.id} className="space-y-2 rounded-md border border-line-decor bg-raised p-3">
              <textarea
                aria-label={`Candidate ${c.id} text`}
                value={c.text}
                onChange={(e) => editText(c.id, e.target.value)}
                rows={2}
                disabled={!!statuses[c.id]}
                className="w-full rounded-md border border-line bg-deep p-2 text-fg focus-visible:outline-focus disabled:opacity-60"
              />
              {c.blocked && <p className="text-bad">Removed a credential-like line. Edit to continue.</p>}
              <div className="flex flex-wrap items-center gap-2 font-mono text-[13px]">
                <select
                  aria-label="Type"
                  value={c.type}
                  disabled={!!statuses[c.id]}
                  onChange={(e) => updateCandidate(c.id, { type: e.target.value as CandidateType })}
                  className="rounded-sm border border-line bg-deep px-1 text-fg"
                >
                  <option value="preference">preference</option>
                  <option value="feedback">feedback</option>
                  <option value="decision">decision</option>
                </select>
                <select
                  aria-label="Scope"
                  value={c.scope}
                  disabled={!!statuses[c.id]}
                  onChange={(e) => updateCandidate(c.id, { scope: e.target.value as CandidateScope })}
                  className="rounded-sm border border-line bg-deep px-1 text-fg"
                >
                  <option value="agent">agent</option>
                  <option value="company">company</option>
                </select>
                <span>{Math.round(c.confidence * 100)}%</span>
                <label className="ml-auto flex items-center gap-1 font-sans text-sm">
                  <input
                    type="checkbox"
                    checked={c.kept}
                    disabled={c.blocked || !!statuses[c.id]}
                    onChange={(e) => updateCandidate(c.id, { kept: e.target.checked })}
                  />
                  Keep
                </label>
              </div>
              {statuses[c.id] && (
                <p className="font-mono text-[13px] text-fg-3" role="status">
                  {STATUS_LABEL[statuses[c.id]]}
                </p>
              )}
            </article>
          ))}

          {candidates.length > 0 && (
            <button type="button" onClick={file} disabled={keptIds.length === 0 || filing || filed} className={buttonClass}>
              File to memory (mock)
            </button>
          )}
        </section>
      )}
    </div>
  );
}
