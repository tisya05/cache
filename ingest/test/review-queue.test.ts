import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIDENCE_THRESHOLD, partitionByConfidence } from '../src/review-queue.js';
import type { TransactionEvent } from '../src/types.js';

function makeEvent(confidence: number, id: string): TransactionEvent {
  return {
    id,
    type: 'spend',
    amountCents: 1000,
    merchant: 'Starbucks',
    memo: 'coffee',
    category: 'coffee',
    categoryGroup: 'wants',
    confidence,
    timestamp: '2026-02-05T21:00:00.000Z',
    source: 'heuristic',
  };
}

describe('partitionByConfidence', () => {
  it('uses 0.8 as the default threshold', () => {
    expect(DEFAULT_CONFIDENCE_THRESHOLD).toBe(0.8);
  });

  it('auto-applies an event exactly at the threshold', () => {
    const { autoApplied, needsReview } = partitionByConfidence([makeEvent(0.8, 'at')]);
    expect(autoApplied.map((e) => e.id)).toEqual(['at']);
    expect(needsReview).toHaveLength(0);
  });

  it('auto-applies an event just above the threshold', () => {
    const { autoApplied, needsReview } = partitionByConfidence([makeEvent(0.81, 'above')]);
    expect(autoApplied.map((e) => e.id)).toEqual(['above']);
    expect(needsReview).toHaveLength(0);
  });

  it('sends an event just below the threshold to needsReview', () => {
    const { autoApplied, needsReview } = partitionByConfidence([makeEvent(0.79, 'below')]);
    expect(needsReview.map((e) => e.id)).toEqual(['below']);
    expect(autoApplied).toHaveLength(0);
  });

  it('sends confidence 1.0 to autoApplied and 0 to needsReview', () => {
    const { autoApplied, needsReview } = partitionByConfidence([makeEvent(1.0, 'full'), makeEvent(0, 'none')]);
    expect(autoApplied.map((e) => e.id)).toEqual(['full']);
    expect(needsReview.map((e) => e.id)).toEqual(['none']);
  });

  it('respects a custom threshold', () => {
    const events = [makeEvent(0.5, 'a'), makeEvent(0.6, 'b')];
    const result = partitionByConfidence(events, 0.6);
    expect(result.autoApplied.map((e) => e.id)).toEqual(['b']);
    expect(result.needsReview.map((e) => e.id)).toEqual(['a']);
  });

  it('preserves relative order within each partition', () => {
    const events = [makeEvent(0.9, 'a'), makeEvent(0.2, 'b'), makeEvent(0.95, 'c'), makeEvent(0.1, 'd')];
    const { autoApplied, needsReview } = partitionByConfidence(events);
    expect(autoApplied.map((e) => e.id)).toEqual(['a', 'c']);
    expect(needsReview.map((e) => e.id)).toEqual(['b', 'd']);
  });
});
