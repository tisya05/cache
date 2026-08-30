import seededMonth from "@/data/seeded-month.json";
import { readJSON } from "@/lib/safe-storage";

export type TransactionEvent = {
  id: string;
  type: "income" | "spend";
  amountCents: number;
  merchant: string;
  /** A genuine human-written message, e.g. a Venmo/Zelle-app memo. Empty
   *  when none exists -- never a stand-in for a counterparty name. */
  memo: string;
  /** The other party's name for a P2P payment -- distinct from `memo`,
   *  since a bare name is not a message. Absent for merchant transactions. */
  counterparty?: string;
  category: string;
  categoryGroup: "needs" | "wants" | "savings";
  confidence: number;
  timestamp: string;
  source: "heuristic" | "llm" | "seed" | "manual";
};

// Must match ingest/src/review-queue.ts's DEFAULT_CONFIDENCE_THRESHOLD --
// duplicated rather than imported since the ingest package isn't set up
// with browser-consumable exports, and it's one primitive value.
const CONFIDENCE_THRESHOLD = 0.8;

const SYNCED_EVENTS_KEY = "cache:synced-events:v1";

/**
 * Once a real email sync has happened, its events replace the seeded month
 * everywhere (this is the one function every screen goes through). Nothing
 * before this call ever writes this key, so its mere presence is the signal
 * that a real sync ran -- an empty result is still real data, not "never
 * synced," and is trusted as-is rather than silently falling back to seed.
 */
export function saveSyncedEvents(events: TransactionEvent[]): void {
  localStorage.setItem(SYNCED_EVENTS_KEY, JSON.stringify(events));
}

export function hasSyncedEvents(): boolean {
  return localStorage.getItem(SYNCED_EVENTS_KEY) !== null;
}

/**
 * The demo/seeded data source — real output of the ingest pipeline (see
 * ingest/scripts/generate-demo-data.ts), not hand-authored fixtures — used
 * until a real email sync (see email-sync.ts) has actually run.
 */
export function loadTransactionEvents(): TransactionEvent[] {
  if (hasSyncedEvents()) return readJSON<TransactionEvent[]>(SYNCED_EVENTS_KEY, []);
  return seededMonth.events as TransactionEvent[];
}

/**
 * Only Venmo/Zelle carry a genuine human-written memo. A merchant's own
 * `memo` field (set by heuristics.ts to its raw email subject, e.g. "Your
 * Starbucks receipt") isn't a message and must never be displayed as one.
 */
export function hasGenuineMemo(event: TransactionEvent): boolean {
  return (event.merchant === "Venmo" || event.merchant === "Zelle") && event.memo.length > 0;
}

export function loadNeedsReviewIds(): Set<string> {
  if (hasSyncedEvents()) {
    const events = readJSON<TransactionEvent[]>(SYNCED_EVENTS_KEY, []);
    return new Set(events.filter((e) => e.confidence < CONFIDENCE_THRESHOLD).map((e) => e.id));
  }
  return new Set(seededMonth.needsReviewIds);
}
