/**
 * The manual category picker's options -- shared between the review queue
 * (correcting a low-confidence guess) and the transaction log (correcting
 * ANY transaction, including ones the pipeline was confident, but wrong,
 * about). One list so the two pickers can't drift apart.
 *
 * Every category -- built-in or user-created -- carries a needs/wants/savings
 * `group`: the Insights spending breakdown (computeSpendBreakdown in
 * insights.ts) sums by this group, so a category without one would silently
 * vanish from that math rather than erroring.
 */
import { readJSON } from "@/lib/safe-storage";

export type CategoryGroup = "needs" | "wants" | "savings";

export type Category = { key: string; label: string; emoji: string; group: CategoryGroup };

export const CATEGORIES: Category[] = [
  { key: "dining_out", label: "Dining Out", emoji: "🍽️", group: "wants" },
  { key: "groceries", label: "Groceries", emoji: "🛒", group: "needs" },
  { key: "rent", label: "Rent", emoji: "🏠", group: "needs" },
  { key: "transportation", label: "Transportation", emoji: "🚗", group: "needs" },
  { key: "entertainment", label: "Entertainment", emoji: "🎬", group: "wants" },
  { key: "shopping", label: "Shopping", emoji: "🛍️", group: "wants" },
  { key: "utilities", label: "Utilities", emoji: "💡", group: "needs" },
  // A spend transaction the user actually moved into savings (e.g. a
  // transfer to a savings account) -- distinct from "income", and the one
  // spend-side category that counts toward the savings bucket rather than
  // needs/wants.
  { key: "savings", label: "Savings", emoji: "🏦", group: "savings" },
  { key: "income", label: "Income", emoji: "💰", group: "savings" },
];

const CUSTOM_CATEGORIES_KEY = "cache:custom-categories:v1";

export function loadCustomCategories(): Category[] {
  return readJSON<Category[]>(CUSTOM_CATEGORIES_KEY, []);
}

/** Upserts by key so re-creating the same category (same slug) never duplicates it. */
export function addCustomCategory(category: Category): void {
  const rest = loadCustomCategories().filter((c) => c.key !== category.key);
  localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify([...rest, category]));
}

export function allCategories(): Category[] {
  return [...CATEGORIES, ...loadCustomCategories()];
}

export function categoryLabel(key: string): string {
  return allCategories().find((c) => c.key === key)?.label ?? key;
}

/** Undefined for a raw pipeline tag that was never turned into a picker
 *  category (e.g. "coffee", "uncategorized") -- callers fall back to the
 *  transaction's own already-correct categoryGroup in that case. */
export function categoryGroupFor(key: string): CategoryGroup | undefined {
  return allCategories().find((c) => c.key === key)?.group;
}

export function slugifyCategoryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
