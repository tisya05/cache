import { loadTransactionEvents } from "@/lib/transactions";
import { loadHistory } from "@/lib/history";
import { loadGoals, DEFAULT_SPLIT } from "@/lib/app-storage";

export type GroupBreakdown = { needs: number; wants: number; savings: number };

/** Spend-only breakdown by needs/wants/savings, as percentages summing to ~100. */
export function computeSpendBreakdown(): GroupBreakdown {
  const totals = { needs: 0, wants: 0, savings: 0 };
  for (const e of loadTransactionEvents()) {
    if (e.type !== "spend") continue;
    totals[e.categoryGroup] += e.amountCents;
  }
  const sum = totals.needs + totals.wants + totals.savings;
  if (sum === 0) return { needs: 0, wants: 0, savings: 0 };
  return {
    needs: Math.round((totals.needs / sum) * 100),
    wants: Math.round((totals.wants / sum) * 100),
    savings: Math.round((totals.savings / sum) * 100),
  };
}

export function computeGoalSplit(): GroupBreakdown {
  return loadGoals()?.split ?? DEFAULT_SPLIT;
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
