import { describe, expect, it } from 'vitest';
import {
  bucketAmountCents,
  buildDisclosureBatch,
  buildDisclosurePayloadItem,
  disclosureBatchesMatch,
  assertBatchConsentMatches,
  stripLikelyNames,
  BUCKET_SIZE_CENTS,
} from '../src/disclosure.js';
import type { TransactionEvent } from '../src/types.js';

function makeEvent(overrides: Partial<TransactionEvent> = {}): TransactionEvent {
  return {
    id: 'evt-1',
    type: 'spend',
    amountCents: 2300,
    merchant: 'Venmo',
    memo: 'rent split',
    category: 'uncategorized',
    categoryGroup: 'wants',
    confidence: 0.35,
    timestamp: '2026-02-05T21:00:00.000Z',
    source: 'heuristic',
    ...overrides,
  };
}

describe('bucketAmountCents', () => {
  it('buckets an amount within a bracket', () => {
    expect(bucketAmountCents(3720)).toBe('$25–50'); // $37.20 -> $25-50 bracket
  });

  it('buckets an amount exactly at a bracket boundary into the upper bracket', () => {
    expect(bucketAmountCents(BUCKET_SIZE_CENTS)).toBe('$25–50'); // exactly $25.00
  });

  it('buckets an amount just below a bracket boundary into the lower bracket', () => {
    expect(bucketAmountCents(BUCKET_SIZE_CENTS - 1)).toBe('$0–25'); // $24.99
  });

  it('buckets an amount just above a bracket boundary into the same upper bracket', () => {
    expect(bucketAmountCents(BUCKET_SIZE_CENTS + 1)).toBe('$25–50'); // $25.01
  });

  it('buckets zero into the first bracket', () => {
    expect(bucketAmountCents(0)).toBe('$0–25');
  });

  it('rejects a negative amount', () => {
    expect(() => bucketAmountCents(-1)).toThrow();
  });
});

describe('stripLikelyNames', () => {
  it('redacts a two-word capitalized sequence that looks like a full name', () => {
    expect(stripLikelyNames('happy bday Steph Lee see you soon')).toBe('happy bday [name] see you soon');
  });

  it('keeps a single-word merchant/brand name untouched', () => {
    expect(stripLikelyNames('paid via Venmo for coffee')).toBe('paid via Venmo for coffee');
  });

  it('keeps an allowlisted multi-word brand name untouched', () => {
    expect(stripLikelyNames('lunch from Uber Eats today')).toBe('lunch from Uber Eats today');
  });

  it('leaves plain lowercase memo text alone', () => {
    expect(stripLikelyNames('🍕🍺 rent split lol')).toBe('🍕🍺 rent split lol');
  });
});

describe('buildDisclosurePayloadItem', () => {
  it('contains ONLY memo and amountBucket — no merchant, no exact amount, no id, no timestamp, no category', () => {
    const event = makeEvent({ memo: 'dinner with Steph Lee', amountCents: 4599 });
    const payload = buildDisclosurePayloadItem(event);
    expect(Object.keys(payload).sort()).toEqual(['amountBucket', 'memo']);
    expect(payload.amountBucket).toBe('$25–50');
    expect(payload.memo).toBe('dinner with [name]');
  });

  it('strips a real full name typed directly into the memo', () => {
    const event = makeEvent({ memo: "for Jordan Kim's birthday gift" });
    const payload = buildDisclosurePayloadItem(event);
    expect(payload.memo).not.toContain('Jordan');
    expect(payload.memo).not.toContain('Kim');
  });
});

describe('buildDisclosureBatch / assertBatchConsentMatches', () => {
  it('builds a batch preview matching a fresh rebuild for the same events', () => {
    const events = [makeEvent({ id: 'a' }), makeEvent({ id: 'b', memo: 'tuition', amountCents: 100000 })];
    const preview1 = buildDisclosureBatch(events);
    const preview2 = buildDisclosureBatch(events);
    expect(disclosureBatchesMatch(preview1, preview2)).toBe(true);
    expect(() => assertBatchConsentMatches(events, preview2)).not.toThrow();
  });

  it('throws when the consented batch is stale (event data changed since the preview was built)', () => {
    const events = [makeEvent({ id: 'a', memo: 'original memo' })];
    const staleConsent = buildDisclosureBatch(events);

    const mutatedEvents = [{ ...events[0], memo: 'a completely different memo' }];

    expect(() => assertBatchConsentMatches(mutatedEvents, staleConsent)).toThrow(/stale|mismatch/i);
  });

  it('throws when the consented batch is for different events entirely', () => {
    const events = [makeEvent({ id: 'a' })];
    const otherEvents = [makeEvent({ id: 'b', memo: 'something else' })];
    const consentForOther = buildDisclosureBatch(otherEvents);

    expect(() => assertBatchConsentMatches(events, consentForOther)).toThrow();
  });

  it('throws when batch lengths differ', () => {
    const events = [makeEvent({ id: 'a' }), makeEvent({ id: 'b' })];
    const shortConsent = buildDisclosureBatch([events[0]]);
    expect(() => assertBatchConsentMatches(events, shortConsent)).toThrow();
  });
});
