import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SEED, generateRawMessages, generateSeedMonth } from '../src/seed.js';
import { partitionByConfidence } from '../src/review-queue.js';

const ORIGINAL_KEY = process.env.GEMINI_API_KEY;

describe('seed data', () => {
  // Force the no-key degradation path so this test is deterministic
  // regardless of whatever is (or isn't) in the developer's local .env —
  // this also happens to be the real state of things today (no key issued
  // yet), so it doubles as a real-world check that the seeded demo works
  // with zero Gemini calls.
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
  });
  afterEach(() => {
    if (ORIGINAL_KEY !== undefined) process.env.GEMINI_API_KEY = ORIGINAL_KEY;
  });

  it('generateRawMessages is deterministic for a given seed', () => {
    const a = generateRawMessages(DEFAULT_SEED);
    const b = generateRawMessages(DEFAULT_SEED);
    expect(a).toEqual(b);
  });

  it('produces a realistic number of events (25-40)', async () => {
    const events = await generateSeedMonth(DEFAULT_SEED);
    expect(events.length).toBeGreaterThanOrEqual(25);
    expect(events.length).toBeLessThanOrEqual(40);
  });

  it('generateSeedMonth is fully deterministic end to end', async () => {
    const a = await generateSeedMonth(DEFAULT_SEED);
    const b = await generateSeedMonth(DEFAULT_SEED);
    expect(a).toEqual(b);
  });

  it('every event is tagged source: "seed"', async () => {
    const events = await generateSeedMonth(DEFAULT_SEED);
    expect(events.every((e) => e.source === 'seed')).toBe(true);
  });

  it('has internally sane totals: total spend does not wildly exceed total income', async () => {
    const events = await generateSeedMonth(DEFAULT_SEED);
    const totalIncome = events.filter((e) => e.type === 'income').reduce((sum, e) => sum + e.amountCents, 0);
    const totalSpend = events.filter((e) => e.type === 'spend').reduce((sum, e) => sum + e.amountCents, 0);

    expect(totalIncome).toBeGreaterThan(0);
    expect(totalSpend).toBeGreaterThan(0);
    // "Doesn't wildly exceed" — spend should be a plausible fraction of
    // income for a saving student, not multiples of it.
    expect(totalSpend).toBeLessThan(totalIncome * 1.5);
  });

  it('earns its keep: running the seed through the review queue produces a non-empty needsReview set', async () => {
    const events = await generateSeedMonth(DEFAULT_SEED);
    const { autoApplied, needsReview } = partitionByConfidence(events);

    expect(autoApplied.length).toBeGreaterThan(0);
    expect(needsReview.length).toBeGreaterThan(0);
    // The ambiguous cases should genuinely be Venmo/Zelle P2P transfers,
    // not some other sender misfiring.
    for (const event of needsReview) {
      expect(['Venmo', 'Zelle']).toContain(event.merchant);
    }
  });

  it('a different seed produces a different (but still deterministic) month', () => {
    const seed1 = generateRawMessages(1);
    const seed2 = generateRawMessages(2);
    expect(seed1).not.toEqual(seed2);
    expect(generateRawMessages(1)).toEqual(seed1);
  });
});
