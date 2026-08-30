import { saveSyncedEvents, loadNeedsReviewIds, type TransactionEvent } from "@/lib/transactions";

export type EmailSyncResult = { ok: true; count: number; needsReview: number } | { ok: false; error: string };

/**
 * DEMO-ONLY HACK: the connected inbox has no real income emails to parse
 * (no direct-deposit / payroll notifications land there), so there's nothing
 * to show for the income side of the goal math. Injects one hardcoded $2,000
 * "Salary" income event alongside the real, email-derived spend events so
 * the demo has income to work with. Remove this once a real income source
 * (payroll email, manual entry, etc.) exists -- everything else in this
 * file still pulls entirely from the real inbox.
 */
function demoIncomeEvent(): TransactionEvent {
  const now = new Date();
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12));
  return {
    id: `demo-salary-${now.getUTCFullYear()}-${now.getUTCMonth() + 1}`,
    type: "income",
    amountCents: 200_000,
    merchant: "Salary",
    memo: "",
    category: "paycheck",
    categoryGroup: "savings",
    confidence: 1,
    timestamp: firstOfMonth.toISOString(),
    source: "manual",
  };
}

/**
 * Calls the local ingest bridge (ingest/scripts/serve.ts) through the same
 * relative-path + Vite-proxy pattern as the proof server (see vite.config.ts,
 * /email-server) -- works both on localhost and through the phone tunnel,
 * no CORS needed since it's always same-origin from the browser's side.
 */
export async function syncEmailInbox(): Promise<EmailSyncResult> {
  let res: Response;
  try {
    res = await fetch("/email-server/sync");
  } catch {
    return { ok: false, error: "Couldn't reach the email sync server. Is it running?" };
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    return { ok: false, error: data?.error ?? `Sync failed (${res.status})` };
  }

  const events = [...(data.events as TransactionEvent[]), demoIncomeEvent()];
  saveSyncedEvents(events);
  return { ok: true, count: events.length, needsReview: loadNeedsReviewIds().size };
}
