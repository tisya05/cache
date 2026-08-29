/**
 * The one shared parsing pipeline. imap.ts, seed.ts, and any future
 * manual-entry path all funnel through the functions in this file, so there
 * is exactly one place the heuristic -> LLM fallback logic lives.
 *
 * Design note — a deliberate deviation from a strict one-message-in,
 * one-event-out `processRawMessage` shape: Gemini must be called in
 * batches of ~10 (see llm/gemini.ts), which is not something a single
 * message can decide on its own — it needs to see the rest of the batch.
 * So this pipeline is two-tiered:
 *
 *   1. `processRawMessage` (sync, one message in, heuristic-only): resolves
 *      type/amount/merchant/category locally wherever possible, and flags
 *      events whose category genuinely needs the (batched, opt-in) LLM step.
 *   2. `processRawMessages` (async, a whole collection in): runs step 1 over
 *      every message, then makes ONE pass of batched LLM calls over
 *      whatever step 1 flagged as eligible, merging results back in.
 *
 * `imap.ts` and `seed.ts` both call `processRawMessages` once per sync/
 * generation run — that is the natural batch boundary (a whole inbox sync,
 * or a whole generated month), not a per-email one.
 */

import { parseTransactionEmail, type ParsedEmailResult } from './heuristics.js';
import { categorizeAmbiguousEvents, type BatchDecisionFn } from './llm/gemini.js';
import { getCategoryGroup, type TransactionEvent } from './types.js';

export interface RawMessage {
  subject: string;
  sender: string;
  bodyText: string;
  /** ISO 8601. Defaults to "now" if omitted — callers with a real received date should always pass it. */
  timestamp?: string;
}

/**
 * Parse a single raw (subject, sender, body) message using local heuristics
 * only. Returns null if the message doesn't look like a transaction from any
 * known sender at all. No network call happens in this function, ever.
 */
export function processRawMessage(message: RawMessage): ParsedEmailResult | null {
  return parseTransactionEmail(message.subject, message.sender, message.bodyText, message.timestamp);
}

export interface ProcessRawMessagesOptions {
  /** Passed through to categorizeAmbiguousEvents — see llm/gemini.ts for the default (auto-consent). */
  decide?: BatchDecisionFn;
  /** Passed through to categorizeAmbiguousEvents. */
  batchSize?: number;
}

/**
 * Run the full pipeline over a collection of raw messages: heuristic parse
 * every message, then make one batched LLM pass over whatever came back
 * genuinely ambiguous (Venmo/Zelle memos only — see heuristics.ts). Returns
 * the final flat list of TransactionEvents, in the same relative order as
 * the messages that produced them, with unrecognized messages simply
 * dropped.
 *
 * If GEMINI_API_KEY is not configured, or a batch is declined via `decide`,
 * those events are returned exactly as the heuristic step left them
 * (typically low-confidence, category "uncategorized") — they are NOT
 * dropped, they just won't have benefited from LLM categorization, and will
 * correctly land in the review queue via review-queue.ts's confidence
 * threshold.
 */
export async function processRawMessages(
  messages: readonly RawMessage[],
  opts: ProcessRawMessagesOptions = {},
): Promise<TransactionEvent[]> {
  const parsed = messages.map((m) => processRawMessage(m)).filter((r): r is ParsedEmailResult => r !== null);

  const events = parsed.map((r) => r.event);
  const ambiguous = parsed.filter((r) => r.llmEligible).map((r) => r.event);

  if (ambiguous.length === 0) {
    return events;
  }

  const { categorized } = await categorizeAmbiguousEvents(ambiguous, {
    decide: opts.decide,
    batchSize: opts.batchSize,
  });

  return events.map((event) => {
    const result = categorized.get(event.id);
    if (!result) return event; // not eligible, key missing, or its batch was declined/failed — leave as-is
    return {
      ...event,
      category: result.category,
      categoryGroup: getCategoryGroup(result.category),
      confidence: result.confidence,
      source: 'llm',
    };
  });
}
