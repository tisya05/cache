import seededMonth from "@/data/seeded-month.json";

export type TransactionEvent = {
  id: string;
  type: "income" | "spend";
  amountCents: number;
  merchant: string;
  memo: string;
  category: string;
  categoryGroup: "needs" | "wants" | "savings";
  confidence: number;
  timestamp: string;
  source: "heuristic" | "llm" | "seed" | "manual";
};

/**
 * The demo/seeded data source — real output of the ingest pipeline (see
 * ingest/scripts/generate-demo-data.ts), not hand-authored fixtures. Once the
 * IMAP bridge exists this is where a live-fetched event list would replace
 * the static import; every screen consuming this goes through this one
 * function so that swap stays a one-line change.
 */
export function loadTransactionEvents(): TransactionEvent[] {
  return seededMonth.events as TransactionEvent[];
}

export function loadNeedsReviewIds(): Set<string> {
  return new Set(seededMonth.needsReviewIds);
}
