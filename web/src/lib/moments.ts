"use client";

import type { Brief, Memory, MemoryJob, MemoryType, Role } from "./api-types";
import { api } from "./api";
import { useApi } from "./useApi";

export interface MomentCitation {
  briefId: string;
  briefCreatedAt: string;
  section: string;
  line: string;
}

export interface MemoryMoment {
  memory: Memory;
  job: MemoryJob | null;
  citations: MomentCitation[];
  impact: "stored" | "verified" | "used";
  /** A local visual walkthrough, never represented as a Walrus-backed memory. */
  preview?: boolean;
}

export interface MomentsData {
  moments: MemoryMoment[];
  citedCount: number;
  verifiedCount: number;
}

function citationsFor(briefs: Brief[]): Map<string, MomentCitation[]> {
  const citations = new Map<string, MomentCitation[]>();
  for (const brief of briefs) {
    for (const section of brief.sections) {
      for (const line of section.lines) {
        for (const blobId of line.cites) {
          const next: MomentCitation = { briefId: brief.id, briefCreatedAt: brief.createdAt, section: section.title, line: line.text };
          citations.set(blobId, [...(citations.get(blobId) ?? []), next]);
        }
      }
    }
  }
  return citations;
}

function jobFor(memories: Memory[], jobs: MemoryJob[]): Map<string, MemoryJob> {
  const jobsByBlob = new Map<string, MemoryJob>();
  for (const job of jobs) if (job.blobId) jobsByBlob.set(job.blobId, job);
  // A memory listed by the relayer is stored. Jobs are supplemental lifecycle data and can be absent
  // after a fresh deployment, so the moment remains valid when this map has no match.
  const matched = new Map<string, MemoryJob>();
  for (const memory of memories) {
    const job = jobsByBlob.get(memory.blobId);
    if (job) matched.set(memory.blobId, job);
  }
  return matched;
}

function momentImpact(memory: Memory, citations: MomentCitation[]): MemoryMoment["impact"] {
  if (citations.length > 0) return "used";
  return memory.verified ? "verified" : "stored";
}

/** Joins stored Walrus memories to their actual write records and cited briefing lines. */
export function useMoments(roomId: string | null) {
  return useApi<MomentsData>(
    roomId
      ? async () => {
          const [memories, briefs, jobs] = await Promise.all([api.memories(roomId), api.briefs(roomId), api.jobs(roomId)]);
          const citations = citationsFor(briefs);
          const jobsByBlob = jobFor(memories.memories, jobs);
          const moments = memories.memories.map((memory) => {
            const cited = citations.get(memory.blobId) ?? [];
            return { memory, job: jobsByBlob.get(memory.blobId) ?? null, citations: cited, impact: momentImpact(memory, cited) };
          });
          return {
            moments,
            citedCount: moments.filter((moment) => moment.citations.length > 0).length,
            verifiedCount: moments.filter((moment) => moment.memory.verified).length,
          };
        }
      : null,
    [roomId],
  );
}

export const MOMENT_TYPE: Record<MemoryType | "memory", { label: string; glyph: string }> = {
  decision: { label: "Decision", glyph: "◇" },
  failure: { label: "Failure", glyph: "!" },
  done: { label: "Completed", glyph: "✓" },
  next: { label: "Next step", glyph: "→" },
  learned: { label: "Learned", glyph: "✦" },
  deadline: { label: "Deadline", glyph: "◷" },
  story: { label: "Story", glyph: "≈" },
  preference: { label: "Preference", glyph: "○" },
  feedback: { label: "Feedback", glyph: "↗" },
  memory: { label: "Memory", glyph: "◌" },
};

export const isDeskRole = (role: Role | null): role is Exclude<Role, "keeper"> => role !== null && role !== "keeper";


/** Lets the empty state demonstrate the animation without inventing a stored Walrus record. */
export const REPLAY_PREVIEW: MemoryMoment = {
  preview: true,
  memory: {
    blobId: "preview-decision-memory",
    type: "decision",
    text: "Lead the launch demo with creator context.",
    agent: "one",
    agentId: null,
    agentLabel: "One",
    roomId: "preview-room",
    namespace: "preview:local-only",
    createdAt: "2026-11-06T09:12:00.000Z",
    expiresAt: null,
    endEpoch: null,
    blobObjectId: null,
    verified: false,
    checkedAt: null,
    supersedes: null,
    supersededBy: null,
    imported: false,
  },
  job: {
    jobId: "preview-job",
    status: "stored",
    blobId: "preview-decision-memory",
    agent: "one",
    roomId: "preview-room",
    namespace: "preview:local-only",
    type: "decision",
    text: "Lead the launch demo with creator context.",
    error: null,
    createdAt: "2026-11-06T09:12:00.000Z",
    storedAt: "2026-11-06T09:14:00.000Z",
    redacted: false,
  },
  citations: [
    {
      briefId: "preview-brief",
      briefCreatedAt: "2026-11-07T08:30:00.000Z",
      section: "Story and demo notes",
      line: "Open the demo with the creator-context problem.",
    },
  ],
  impact: "used",
};
