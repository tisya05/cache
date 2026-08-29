/**
 * LLM categorization via Google Gemini Flash (free tier), for the small
 * subset of transactions that heuristics genuinely cannot resolve locally:
 * ambiguous Venmo/Zelle memos. See heuristics.ts and senders.ts for why
 * every other known sender never reaches this file at all.
 *
 * Privacy-critical constraints, enforced in code, not just by convention:
 *   - The API key is read ONLY via process.env.GEMINI_API_KEY, never hard-
 *     coded, logged, printed, or echoed — including in error messages.
 *   - Calls are BATCHED (~10 transactions per call) — Gemini's free tier is
 *     rate-limited to roughly 10-15 req/min, so one-call-per-transaction
 *     would throttle the demo mid-run.
 *   - Per-transaction payload is ONLY { memo, amountBucket } (see
 *     disclosure.ts) — no merchant, no exact amount, no identity, no running
 *     totals.
 *   - `categorizeBatchWithLLM` cannot be called with a payload that wasn't
 *     just built by `buildDisclosureBatch` for these exact events — see
 *     disclosure.ts `assertBatchConsentMatches`.
 *   - `categorizeAmbiguousEvents` (the orchestration entry point used by the
 *     rest of ingest) degrades gracefully — and silently, with zero API
 *     calls and zero throws — when GEMINI_API_KEY is absent, and supports
 *     declining an entire preview batch, in which case those transactions
 *     are routed to needsReview with zero API calls made for them.
 *
 * The exact free-tier model id is a moving target; keep it isolated to this
 * one constant so it's a one-line change if Google renames/retires it.
 */

import {
  buildDisclosureBatch,
  assertBatchConsentMatches,
  type DisclosureBatchPreview,
  type DisclosurePayloadItem,
} from '../disclosure.js';
import { CATEGORY_TAXONOMY, isKnownCategory, type TransactionEvent } from '../types.js';
import { chunk } from '../util.js';

// Verified against the live API on 2026-08-29 (models.list for this key) --
// gemini-2.0-flash no longer exists. See the file-level comment: this is a
// moving target, kept isolated to this one constant on purpose.
export const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Max transactions per Gemini call, to stay well under the free-tier rate limit. */
export const MAX_BATCH_SIZE = 10;

export interface CategoryResult {
  category: string;
  confidence: number;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function buildPrompt(items: DisclosurePayloadItem[]): string {
  const allowedCategories = Object.keys(CATEGORY_TAXONOMY);
  const lines = items
    .map((it, i) => `${i + 1}. memo: "${it.memo}" | amount range: ${it.amountBucket}`)
    .join('\n');
  return [
    'You are categorizing short, anonymized personal-finance transaction notes for a student budgeting app.',
    'Each numbered item has a free-text memo (personal names already redacted as "[name]") and a bucketed dollar amount range — never the exact amount.',
    `Choose exactly one category per item from this fixed list: ${allowedCategories.join(', ')}.`,
    'Respond with ONLY a JSON array and nothing else (no prose, no markdown fences). Each element must be:',
    '{"index": <1-based item number>, "category": "<one of the allowed categories>", "confidence": <number 0 to 1>}',
    'If you are unsure, respond with category "uncategorized" and a low confidence rather than guessing.',
    '',
    lines,
  ].join('\n');
}

/**
 * Low-level network call: send exactly `items` (already-built disclosure
 * payloads — no event data, no ids) to Gemini and return one CategoryResult
 * per item, in the same order. Never throws with the API key embedded in the
 * error message.
 */
async function callGeminiBatch(items: DisclosurePayloadItem[]): Promise<CategoryResult[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const url = `${GEMINI_ENDPOINT_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const requestBody = {
    contents: [{ parts: [{ text: buildPrompt(items) }] }],
    generationConfig: { responseMimeType: 'application/json' },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch {
    // Deliberately do not include the caught error's own message: some fetch
    // implementations attach the request URL (which contains the API key)
    // to network-error objects.
    throw new Error('Gemini request failed: network error');
  }

  if (!response.ok) {
    throw new Error(`Gemini request failed with HTTP status ${response.status}`);
  }

  const data: unknown = await response.json();
  const text = (data as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    throw new Error('Gemini response did not contain the expected text payload');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Gemini response was not valid JSON');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Gemini response JSON was not an array');
  }

  return items.map((_, i) => {
    const entry: any = parsed.find((p: any) => p && p.index === i + 1) ?? parsed[i];
    if (!entry || typeof entry.category !== 'string') {
      return { category: 'uncategorized', confidence: 0 };
    }
    if (!isKnownCategory(entry.category)) {
      // The model invented a category we don't recognize — classify as
      // needing human review rather than trusting an unregistered category.
      return { category: 'uncategorized', confidence: 0 };
    }
    const confidence =
      typeof entry.confidence === 'number' && Number.isFinite(entry.confidence)
        ? Math.max(0, Math.min(1, entry.confidence))
        : 0.5;
    return { category: entry.category, confidence };
  });
}

/**
 * The actual Gemini-calling function. Requires an explicit consent flag that
 * only makes sense if the caller has already gone through the disclosure
 * preview step: `consentedBatch` must deep-equal what
 * `buildDisclosureBatch(events)` would produce right now, or this throws
 * before any network call is made. This makes it structurally impossible to
 * call the LLM with a payload the preview step didn't actually show.
 *
 * Low-level and strict on purpose: throws on missing config, on a stale/
 * mismatched consent batch, and on more than MAX_BATCH_SIZE events. The
 * graceful, non-throwing "no key configured -> skip" behavior lives one
 * level up, in `categorizeAmbiguousEvents`, which is what the rest of ingest
 * should call.
 */
export async function categorizeBatchWithLLM(
  events: readonly TransactionEvent[],
  opts: { consentedBatch: DisclosureBatchPreview },
): Promise<CategoryResult[]> {
  if (events.length === 0) return [];
  if (events.length > MAX_BATCH_SIZE) {
    throw new Error(`categorizeBatchWithLLM received ${events.length} events; max batch size is ${MAX_BATCH_SIZE}`);
  }

  // Structural gate: this throws BEFORE any network call if the consented
  // payload doesn't match what would be built for these events right now.
  assertBatchConsentMatches(events, opts.consentedBatch);

  if (!isGeminiConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  return callGeminiBatch(opts.consentedBatch.items);
}

// ---------------------------------------------------------------------------
// High-level orchestration
// ---------------------------------------------------------------------------

/**
 * A decision function for one batch preview: return true to consent (send
 * the batch to Gemini) or false to decline it (those events fall back to
 * needsReview, with zero API calls for them). The default, used by
 * unattended automation (seed data, an IMAP sync with no one watching),
 * auto-consents — a real interactive UI supplies a function that shows the
 * batch preview to a human and awaits their tap.
 */
export type BatchDecisionFn = (preview: DisclosureBatchPreview) => boolean | Promise<boolean>;

export interface CategorizeAmbiguousResult {
  /** eventId -> category result, for every event that was successfully categorized. */
  categorized: Map<string, CategoryResult>;
  /**
   * Events that did NOT get an LLM category: either GEMINI_API_KEY was
   * absent, a batch was declined, or that batch's call failed. All of these
   * should be routed to needsReview by the caller.
   */
  skipped: TransactionEvent[];
  /** How many Gemini API calls were actually made (0 if the key is absent or every batch was declined). */
  apiCallsMade: number;
}

/**
 * The orchestration entry point the rest of ingest should use. Chunks
 * `events` into batches of at most `batchSize` (default MAX_BATCH_SIZE),
 * builds a disclosure preview per batch, asks `decide` for consent, and
 * either calls Gemini for that batch or routes it to `skipped`.
 *
 * Graceful degradation: if GEMINI_API_KEY is absent or empty, this returns
 * immediately with every event in `skipped` and `apiCallsMade: 0` — no
 * throw, no network attempt at all. A transient failure calling Gemini for
 * one batch (rate limit, network blip) is caught and that batch's events are
 * added to `skipped` too, so one bad batch can't crash an entire ingest run.
 */
export async function categorizeAmbiguousEvents(
  events: readonly TransactionEvent[],
  opts: { decide?: BatchDecisionFn; batchSize?: number } = {},
): Promise<CategorizeAmbiguousResult> {
  const categorized = new Map<string, CategoryResult>();
  const skipped: TransactionEvent[] = [];

  if (events.length === 0) {
    return { categorized, skipped, apiCallsMade: 0 };
  }

  if (!isGeminiConfigured()) {
    return { categorized, skipped: [...events], apiCallsMade: 0 };
  }

  const decide = opts.decide ?? (() => true);
  const batchSize = opts.batchSize ?? MAX_BATCH_SIZE;
  let apiCallsMade = 0;

  for (const batch of chunk(events, batchSize)) {
    const preview = buildDisclosureBatch(batch);
    const consented = await decide(preview);
    if (!consented) {
      skipped.push(...batch);
      continue;
    }
    try {
      const results = await categorizeBatchWithLLM(batch, { consentedBatch: preview });
      apiCallsMade++;
      batch.forEach((ev, i) => categorized.set(ev.id, results[i]));
    } catch (err) {
      // Do not let one bad batch (rate limit, transient network error) take
      // down the whole ingest run. Log a non-sensitive message only — never
      // the raw error, which could in principle carry request details.
      console.error(
        `Gemini categorization failed for a batch of ${batch.length}; routing to review. Reason: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
      skipped.push(...batch);
    }
  }

  return { categorized, skipped, apiCallsMade };
}
