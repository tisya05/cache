/**
 * Shared event schema for the Cache ingest pipeline.
 *
 * Design note: `categoryGroup` is required on TransactionEvent (not optional,
 * not derivable-later) so it is structurally impossible to produce an event
 * whose category floats free of the needs/wants/savings taxonomy the 50/30/20
 * goal engine depends on (see docs/BUILD-SPEC.md §7 point 5). Every code path
 * that assigns a `category` MUST look up (or register) that category's group
 * in `CATEGORY_TAXONOMY` via `getCategoryGroup` / `registerCategory` below —
 * never hand-write a categoryGroup string next to a category string.
 */

export type EventType = 'income' | 'spend';

export type CategoryGroup = 'needs' | 'wants' | 'savings';

export type EventSource = 'heuristic' | 'llm' | 'seed' | 'manual';

export interface TransactionEvent {
  /** stable id, e.g. hash of source+timestamp+amount */
  id: string;
  type: EventType;
  /** integer minor units (cents). Never a floating-point dollar amount. */
  amountCents: number;
  /** the counterparty/sender business identity, e.g. "Venmo", "Starbucks", "DoorDash" */
  merchant: string;
  /** raw memo/description text, e.g. "Steph 🍕🍺 rent split lol" -- a genuine
   *  human-written message. Empty when none exists; never a stand-in for a
   *  counterparty name (see `counterparty`). */
  memo: string;
  /** The other party's name for a P2P payment (Venmo/Zelle), e.g. "Sean
   *  Braggs" -- distinct from `memo` since a bare name is not a message.
   *  Absent for merchant/card transactions, which have no "other party". */
  counterparty?: string;
  /** e.g. "rent", "food", "subscriptions", "paycheck" — must exist in CATEGORY_TAXONOMY */
  category: string;
  categoryGroup: CategoryGroup;
  /** 0..1 */
  confidence: number;
  /** ISO 8601 */
  timestamp: string;
  source: EventSource;
}

/**
 * The category taxonomy registry. Every category — built-in or dynamically
 * introduced by a user or the LLM — MUST have an entry here before it is used
 * on a TransactionEvent. This is the one place that maps a category name to
 * its needs/wants/savings group.
 *
 * Income categories are a special case: needs/wants/savings is a spend-side
 * allocation model, so there's no literal "need" or "want" for a paycheck.
 * By convention we tag income categories `savings`, since income is capacity
 * that has not yet been allocated to needs or wants — this keeps the 50/30/20
 * math honest (income never gets miscounted as needs/wants spend) without
 * inventing a fourth bucket. This is a deliberate convention, not a spec
 * quote — documented here so it's easy to revisit.
 */
export const CATEGORY_TAXONOMY: Record<string, CategoryGroup> = {
  // --- needs (spend) ---
  rent: 'needs',
  groceries: 'needs',
  utilities: 'needs',
  transport: 'needs',
  tuition: 'needs',
  textbooks: 'needs',
  insurance: 'needs',

  // --- wants (spend) ---
  food: 'wants',
  coffee: 'wants',
  subscriptions: 'wants',
  shopping: 'wants',
  entertainment: 'wants',
  travel: 'wants',
  // Provisional bucket for spend whose category could not be determined
  // confidently. Deliberately placed in `wants` (the least-consequential
  // misclassification for the 50/30/20 math) as a conservative default;
  // it is always paired with low confidence so it is expected to land in
  // the review queue and get corrected, not silently trusted.
  uncategorized: 'wants',

  // --- income, see convention above ---
  paycheck: 'savings',
  financial_aid: 'savings',
  tutoring_income: 'savings',
  reimbursement: 'savings',
  gift_income: 'savings',
};

/**
 * Register a new category with its required group. Throws if the category
 * already exists with a *different* group (prevents silently redefining an
 * established category's group out from under the goal engine). Re-registering
 * the same category with the same group is a harmless no-op.
 */
export function registerCategory(category: string, group: CategoryGroup): void {
  const existing = CATEGORY_TAXONOMY[category];
  if (existing !== undefined && existing !== group) {
    throw new Error(
      `Category "${category}" is already registered as "${existing}"; refusing to redefine it as "${group}".`,
    );
  }
  CATEGORY_TAXONOMY[category] = group;
}

export function isKnownCategory(category: string): boolean {
  return Object.prototype.hasOwnProperty.call(CATEGORY_TAXONOMY, category);
}

/**
 * Look up a category's group. Throws for unknown categories — callers must
 * register a category (with a group) before using it, rather than getting a
 * silently-wrong default back.
 */
export function getCategoryGroup(category: string): CategoryGroup {
  const group = CATEGORY_TAXONOMY[category];
  if (group === undefined) {
    throw new Error(
      `Unknown category "${category}" — register it with registerCategory(category, group) before use.`,
    );
  }
  return group;
}
