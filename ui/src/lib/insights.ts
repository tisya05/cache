import { loadTransactionEvents, type TransactionEvent } from "@/lib/transactions";
import { loadHistory } from "@/lib/history";
import { loadGoals, DEFAULT_SPLIT, loadCategoryOverrides } from "@/lib/app-storage";
import { allCategories, categoryGroupFor, type CategoryGroup } from "@/lib/categories";
import { SPENDING_CATEGORY_COLORS, type SpendingCategory } from "@/lib/chart-colors";

export type GroupBreakdown = { needs: number; wants: number; savings: number };

/** A review-queue/transaction-log correction always wins over the pipeline's
 *  own guess -- falls back to the event's own group only when the override
 *  key isn't a real picker category (shouldn't happen, but never silently
 *  drops the transaction from the breakdown). */
function effectiveCategoryGroup(e: TransactionEvent, overrides: Record<string, string>): CategoryGroup {
  const overrideKey = overrides[e.id];
  if (!overrideKey) return e.categoryGroup;
  return categoryGroupFor(overrideKey) ?? e.categoryGroup;
}

/**
 * Needs/wants/savings as percentages of income (not just of spend -- money
 * that's never spent at all is still "savings" and has to show up here).
 * "Savings" is money either explicitly moved there (a spend transaction
 * categorized "savings", e.g. a transfer to a savings account) or simply
 * never spent (income minus everything else) -- never spend-tagged-savings
 * alone, which would silently drop untouched income from the breakdown
 * entirely (this was the bug: Savings always showed 0% because no category
 * was ever tagged "savings", and leftover income was never counted at all).
 */
export function computeSpendBreakdown(): GroupBreakdown {
  const overrides = loadCategoryOverrides();
  let needsCents = 0;
  let wantsCents = 0;
  let explicitSavingsCents = 0;
  let incomeCents = 0;
  for (const e of loadTransactionEvents()) {
    if (e.type === "income") {
      incomeCents += e.amountCents;
      continue;
    }
    const group = effectiveCategoryGroup(e, overrides);
    if (group === "needs") needsCents += e.amountCents;
    else if (group === "wants") wantsCents += e.amountCents;
    else explicitSavingsCents += e.amountCents;
  }
  const spentCents = needsCents + wantsCents + explicitSavingsCents;
  const leftoverCents = Math.max(0, incomeCents - spentCents);
  const savingsCents = explicitSavingsCents + leftoverCents;

  const denomCents = incomeCents > 0 ? incomeCents : spentCents;
  if (denomCents === 0) return { needs: 0, wants: 0, savings: 0 };
  return {
    needs: Math.round((needsCents / denomCents) * 100),
    wants: Math.round((wantsCents / denomCents) * 100),
    savings: Math.round((savingsCents / denomCents) * 100),
  };
}

export function computeGoalSplit(): GroupBreakdown {
  return loadGoals()?.split ?? DEFAULT_SPLIT;
}

// Raw tags from the ingest pipeline (heuristics + Gemini, e.g. "coffee",
// "subscriptions") and from the review-queue picker (e.g. "dining_out")
// both land here -- neither vocabulary matches the display categories
// directly, so this is the one place that reconciles them.
const RAW_CATEGORY_MAP: Record<string, SpendingCategory> = {
  rent: "Rent",
  groceries: "Groceries",
  food: "Dining Out",
  coffee: "Dining Out",
  dining: "Dining Out",
  dining_out: "Dining Out",
  transport: "Transportation",
  transportation: "Transportation",
  utilities: "Utilities",
  utility: "Utilities",
  subscriptions: "Entertainment",
  subscription: "Entertainment",
  entertainment: "Entertainment",
  shopping: "Shopping",
};

/**
 * A user-created category (see categories.ts's "Create new category") shows
 * under its own name here, never silently absorbed into "Other" -- "Other"
 * means "the pipeline couldn't tell," not "you gave it a name we don't
 * recognize." Falls back to the fixed 8-bucket map only for the pipeline's
 * own raw tags (e.g. "coffee"), which were never meant to be category names.
 */
export function toDisplayCategory(rawCategory: string): string {
  const custom = allCategories().find((c) => c.key === rawCategory);
  if (custom) return custom.label;
  return RAW_CATEGORY_MAP[rawCategory.toLowerCase()] ?? "Other";
}

export type CategorySlice = {
  category: string;
  amountCents: number;
  percent: number;
  color: string;
  events: TransactionEvent[];
};

/**
 * The actual payoff of the categorisation pipeline (heuristics + Gemini +
 * user-confirmed corrections from the review queue) -- until this, that
 * work fed needs/wants/savings and nothing else ever surfaced the specific
 * category a transaction landed in. A review-queue correction always wins
 * over the pipeline's own guess.
 */
export function computeSpendingByCategory(): CategorySlice[] {
  const overrides = loadCategoryOverrides();
  const totals = new Map<string, { amountCents: number; events: TransactionEvent[] }>();

  for (const e of loadTransactionEvents()) {
    if (e.type !== "spend") continue;
    const raw = overrides[e.id] ?? e.category;
    const category = toDisplayCategory(raw);
    const bucket = totals.get(category) ?? { amountCents: 0, events: [] };
    bucket.amountCents += e.amountCents;
    bucket.events.push(e);
    totals.set(category, bucket);
  }

  const grandTotal = [...totals.values()].reduce((sum, b) => sum + b.amountCents, 0);
  if (grandTotal === 0) return [];

  return [...totals.entries()]
    .map(([category, bucket]) => ({
      category,
      amountCents: bucket.amountCents,
      percent: Math.round((bucket.amountCents / grandTotal) * 100),
      // A user-created category has no validated hue of its own (see the
      // dataviz skill) -- it shares "Other"'s neutral gray rather than an
      // invented, unvalidated color, and stays distinguishable by its label.
      color: SPENDING_CATEGORY_COLORS[category as SpendingCategory] ?? SPENDING_CATEGORY_COLORS.Other,
      events: bucket.events.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

export type TrendPoint = { label: string; incomeCents: number; spendCents: number };

/** Income/spend over real history periods plus the current (in-progress) month. */
export function computeTrend(): TrendPoint[] {
  const history = [...loadHistory()].reverse(); // oldest first
  const points: TrendPoint[] = history.map((h, i) => ({
    label: `M${i + 1}`,
    incomeCents: h.incomeCents,
    spendCents: h.spendCents,
  }));
  const current = loadTransactionEvents().reduce(
    (acc, e) => {
      if (e.type === "income") acc.incomeCents += e.amountCents;
      else acc.spendCents += e.amountCents;
      return acc;
    },
    { incomeCents: 0, spendCents: 0 },
  );
  points.push({ label: "Now", ...current });
  return points;
}
