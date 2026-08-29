/**
 * The disclosure preview. This is thematically load-bearing, not a nice-to-have:
 * Cache's pitch is "nobody ever sees your money," and the one place that isn't
 * strictly true is the batched Gemini categorization call for genuinely
 * ambiguous Venmo/Zelle memos. This module makes the EXACT payload for that
 * call constructible and inspectable as a pure, pre-call step, so a future UI
 * can show a human exactly what a batch is about to send, and let them
 * decline the whole batch, before any network call happens.
 *
 * Per the updated design (see llm/gemini.ts for the full rationale):
 *   - Per-transaction payload is ONLY { memo, amountBucket } — no merchant,
 *     no exact amount, no timestamp, no id, no running totals, no category.
 *   - A "batch" is the whole array of up to ~10 such payloads that go into a
 *     single Gemini call together.
 *   - Only Venmo/Zelle events with an unresolved category are ever built into
 *     a disclosure payload at all (see senders.ts `llmFallbackEligible` and
 *     heuristics.ts `llmEligible`) — everything else never reaches this file.
 */

import type { TransactionEvent } from './types.js';

export interface DisclosurePayloadItem {
  memo: string;
  amountBucket: string;
}

export interface DisclosureBatchPreview {
  items: DisclosurePayloadItem[];
  /**
   * Ids of the source events, in the same order as `items`, used ONLY
   * locally to remap a Gemini response back onto events. Never serialized
   * into the request sent to Gemini.
   */
  eventIds: string[];
}

/**
 * Bucket granularity, in cents. $25 brackets: an amount is reported only as
 * "which $25 bracket does it fall in", e.g. $37.20 -> "$25–50". This is a
 * deliberate choice, not a spec-mandated number — $25 is coarse enough that
 * the exact figure can't be reverse-engineered from the bucket, while still
 * giving the model a rough magnitude signal (a $0–25 Venmo note reads very
 * differently than a $600–625 one for category purposes, e.g. rent).
 */
export const BUCKET_SIZE_CENTS = 2500;

/**
 * Bucket an amount into a human-readable "$LOW–HIGH" range string. Buckets
 * are half-open on the low bound and closed-ish on the high bound label
 * only: cents in [n*BUCKET, (n+1)*BUCKET) all report the same label. The
 * boundary itself (e.g. exactly $25.00) falls into the bracket starting at
 * that boundary, not the one below it.
 */
export function bucketAmountCents(amountCents: number): string {
  if (!Number.isFinite(amountCents) || amountCents < 0) {
    throw new Error(`bucketAmountCents requires a non-negative finite amount, got ${amountCents}`);
  }
  const bracketIndex = Math.floor(amountCents / BUCKET_SIZE_CENTS);
  const lowDollars = (bracketIndex * BUCKET_SIZE_CENTS) / 100;
  const highDollars = ((bracketIndex + 1) * BUCKET_SIZE_CENTS) / 100;
  return `$${lowDollars}–${highDollars}`;
}

// ---------------------------------------------------------------------------
// Name stripping
// ---------------------------------------------------------------------------

/**
 * Multi-word brand/merchant phrases that should survive stripping even
 * though they match the "two-or-more capitalized words" shape a personal
 * full name also matches (e.g. "Uber Eats", "Whole Foods"). Single-word
 * brand names (e.g. "Venmo", "Starbucks") never need this list — the
 * stripping regex only matches sequences of 2+ capitalized words, so a lone
 * capitalized word is never touched in the first place.
 */
const MULTI_WORD_BRAND_ALLOWLIST = new Set(
  [
    'Uber Eats',
    'Whole Foods',
    'Trader Joes',
    'Trader Joe',
    'Stop Shop',
    'Bank Of America',
    'Wells Fargo',
    'Capital One',
    'Financial Aid',
  ].map((s) => s.toLowerCase()),
);

// Matches sequences of 2+ consecutive Capitalized words, e.g. "Steph Lee",
// "Uber Eats", "New York". Single capitalized words never match.
const CAPITALIZED_SEQUENCE = /\b[A-Z][a-zA-Z'-]*(?:\s+[A-Z][a-zA-Z'-]*)+\b/g;

/**
 * Strip anything that looks like a full name. Heuristic: redact any run of
 * 2+ consecutive Capitalized words, UNLESS that exact phrase is a known
 * multi-word brand/merchant name — those are not personal identity and are
 * left intact (e.g. "Uber Eats" survives, "Steph Lee" does not).
 */
export function stripLikelyNames(text: string): string {
  return text.replace(CAPITALIZED_SEQUENCE, (match) => {
    return MULTI_WORD_BRAND_ALLOWLIST.has(match.toLowerCase()) ? match : '[name]';
  });
}

// ---------------------------------------------------------------------------
// Payload construction
// ---------------------------------------------------------------------------

/**
 * Build the exact single-transaction payload that would be sent to Gemini.
 * Pure function: same input always produces the same output, no side effects,
 * no network. This is what a future UI calls to render "here is exactly what
 * is about to be sent" before any opt-in.
 */
export function buildDisclosurePayloadItem(event: Pick<TransactionEvent, 'memo' | 'amountCents'>): DisclosurePayloadItem {
  return {
    memo: stripLikelyNames(event.memo),
    amountBucket: bucketAmountCents(event.amountCents),
  };
}

/**
 * Build the full batch preview for a set of ambiguous events (up to ~10 —
 * batching size is enforced by the caller in llm/gemini.ts, not here; this
 * function is happy to build a preview of any size since "show me what would
 * be sent" should never itself fail).
 */
export function buildDisclosureBatch(events: readonly TransactionEvent[]): DisclosureBatchPreview {
  return {
    items: events.map((e) => buildDisclosurePayloadItem(e)),
    eventIds: events.map((e) => e.id),
  };
}

/**
 * Structural equality check between two disclosure batch previews (order
 * matters — items must line up 1:1 for response remapping to be correct).
 */
export function disclosureBatchesMatch(a: DisclosureBatchPreview, b: DisclosureBatchPreview): boolean {
  if (a.eventIds.length !== b.eventIds.length) return false;
  for (let i = 0; i < a.eventIds.length; i++) {
    if (a.eventIds[i] !== b.eventIds[i]) return false;
    if (a.items[i].memo !== b.items[i].memo) return false;
    if (a.items[i].amountBucket !== b.items[i].amountBucket) return false;
  }
  return true;
}

/**
 * Assert that `consentedBatch` is exactly what `buildDisclosureBatch(events)`
 * would currently produce. Throws a descriptive error otherwise. This is the
 * structural gate that makes it impossible to call the LLM with a payload
 * the preview step didn't actually show: the caller must have built (and, in
 * a real UI, displayed and gotten consent for) precisely this batch, right
 * now, for these exact events.
 */
export function assertBatchConsentMatches(events: readonly TransactionEvent[], consentedBatch: DisclosureBatchPreview): void {
  const current = buildDisclosureBatch(events);
  if (!disclosureBatchesMatch(current, consentedBatch)) {
    throw new Error(
      'Stale or mismatched consent: the batch payload that was consented to does not match ' +
        'the payload that would be sent for these events right now. Rebuild the disclosure ' +
        'preview with buildDisclosureBatch(events) and get fresh consent before calling the LLM.',
    );
  }
}
