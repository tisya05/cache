import { createHash } from 'node:crypto';

/** Parse a "$1,234.56" (or "1234.56", "1,234.56") style string into integer cents. */
export function parseMoneyToCents(raw: string): number {
  const cleaned = raw.replace(/[$,\s]/g, '');
  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value)) {
    throw new Error(`Could not parse money amount from "${raw}"`);
  }
  // Round rather than truncate to avoid floating point drift (e.g. 12.1 -> 1209.999...).
  return Math.round(value * 100);
}

/** Stable id: a hash of the fields that identify a transaction. Deterministic. */
export function makeEventId(...parts: (string | number)[]): string {
  const hash = createHash('sha256');
  hash.update(parts.join('|'));
  return hash.digest('hex').slice(0, 16);
}

/**
 * Normalize free text memo for canonical-phrase matching: lowercase, strip
 * emoji/punctuation/symbols (keep letters/digits/spaces), collapse whitespace.
 * This is intentionally lossy — it's used only to check "is this memo *exactly*
 * a clean, recognizable phrase" (e.g. "rent"), not for display.
 */
export function normalizeMemo(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    // Strip anything that isn't a basic letter, digit, or whitespace —
    // this removes emoji, punctuation, and other symbols in one pass.
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Deterministic seeded PRNG (mulberry32). Same seed -> same sequence, always. */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick an integer element from an array using a 0..1 random source. */
export function pick<T>(rand: () => number, arr: readonly T[]): T {
  const idx = Math.floor(rand() * arr.length);
  return arr[Math.min(idx, arr.length - 1)];
}

/** Integer in [min, max], inclusive, from a 0..1 random source. */
export function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/** Split an array into chunks of at most `size` elements each. */
export function chunk<T>(arr: readonly T[], size: number): T[][] {
  if (size <= 0) throw new Error('chunk size must be positive');
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}
