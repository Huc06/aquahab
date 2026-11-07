// Pure helpers for seed-room.ts (tested in test/studio.test.ts).
import type { MemoryType } from "../src/contract.ts";
import { parseCapture } from "../src/memory/format.ts";

export interface SeedLine {
  line: number;
  text: string;
  type: MemoryType;
}

/**
 * One memory per line, each with a capture prefix (d: f: n: done: l: due: s:), so the type is the author's
 * choice and not a guess. Blank lines and lines starting with # are skipped.
 *
 * `p:` is refused: a preference is filed in the CEO namespace (`aquahab:ceo`), which every room's brief
 * recalls, so a seeded preference would leak into the CEO's real rooms. A room's voice goes in `s:`.
 */
export function parseSeedFile(content: string): { lines: SeedLine[]; errors: string[] } {
  const lines: SeedLine[] = [];
  const errors: string[] = [];
  content.split(/\r?\n/).forEach((raw, i) => {
    const text = raw.trim();
    if (!text || text.startsWith("#")) return;
    const { type, body } = parseCapture(text);
    if (!type) errors.push(`line ${i + 1}: start with a prefix (d: f: n: done: l: due: s:), got "${text.slice(0, 40)}"`);
    else if (!body) errors.push(`line ${i + 1}: nothing after the prefix`);
    else if (type === "preference")
      errors.push(`line ${i + 1}: p: goes to the CEO namespace, which every room's brief reads. Put the room's voice in s:, or send the preference to the bot yourself`);
    else lines.push({ line: i + 1, text, type });
  });
  return { lines, errors };
}
