import { describe, expect, it } from 'vitest';
import { chunk, createSeededRandom, makeEventId, normalizeMemo, parseMoneyToCents } from '../src/util.js';

describe('parseMoneyToCents', () => {
  it('parses a plain decimal string', () => {
    expect(parseMoneyToCents('12.50')).toBe(1250);
  });

  it('parses a string with a dollar sign and commas', () => {
    expect(parseMoneyToCents('$1,234.56')).toBe(123456);
  });

  it('rounds rather than truncates to avoid float drift', () => {
    expect(parseMoneyToCents('12.1')).toBe(1210);
  });

  it('throws on unparseable input', () => {
    expect(() => parseMoneyToCents('not a number')).toThrow();
  });
});

describe('normalizeMemo', () => {
  it('lowercases and strips emoji/punctuation, collapsing whitespace', () => {
    expect(normalizeMemo('🍕🍺 Rent Split, lol!')).toBe('rent split lol');
  });

  it('is idempotent on an already-clean phrase', () => {
    expect(normalizeMemo('rent')).toBe('rent');
  });
});

describe('createSeededRandom', () => {
  it('is deterministic for the same seed', () => {
    const seq1 = Array.from({ length: 5 }, createSeededRandom(7));
    const seq2 = Array.from({ length: 5 }, createSeededRandom(7));
    expect(seq1).toEqual(seq2);
  });

  it('produces values in [0, 1)', () => {
    const rand = createSeededRandom(123);
    for (let i = 0; i < 20; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('makeEventId', () => {
  it('is deterministic for the same inputs', () => {
    expect(makeEventId('Venmo', '2026-02-05T21:00:00.000Z', 2300, 'rent')).toBe(
      makeEventId('Venmo', '2026-02-05T21:00:00.000Z', 2300, 'rent'),
    );
  });

  it('differs when any input differs', () => {
    const base = makeEventId('Venmo', '2026-02-05T21:00:00.000Z', 2300, 'rent');
    expect(makeEventId('Venmo', '2026-02-05T21:00:00.000Z', 2301, 'rent')).not.toBe(base);
  });
});

describe('chunk', () => {
  it('splits an array into groups of the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns one chunk when size >= array length', () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });

  it('throws for a non-positive size', () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});
