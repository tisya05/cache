/**
 * Confidence-threshold partitioning. Without this, a user would swipe
 * through every ingested transaction on every boot and the feature becomes a
 * chore — so this is not cosmetic, and the boundary behavior is exact:
 * confidence >= threshold auto-applies, confidence < threshold needs review.
 */

import type { TransactionEvent } from './types.js';

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.8;

export interface ReviewPartition {
  autoApplied: TransactionEvent[];
  needsReview: TransactionEvent[];
}

export function partitionByConfidence(
  events: readonly TransactionEvent[],
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD,
): ReviewPartition {
  const autoApplied: TransactionEvent[] = [];
  const needsReview: TransactionEvent[] = [];

  for (const event of events) {
    if (event.confidence >= threshold) {
      autoApplied.push(event);
    } else {
      needsReview.push(event);
    }
  }

  return { autoApplied, needsReview };
}
