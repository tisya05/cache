import type { GoalsConfig } from "@/lib/app-storage";
import { loadTransactionEvents } from "@/lib/transactions";
import { daysLeftInMonth } from "@/lib/format";

export type MonthTotals = { incomeCents: number; spendCents: number };

export function computeMonthTotals(): MonthTotals {
  const events = loadTransactionEvents();
  let incomeCents = 0;
  let spendCents = 0;
  for (const e of events) {
    if (e.type === "income") incomeCents += e.amountCents;
    else spendCents += e.amountCents;
  }
  return { incomeCents, spendCents };
}

/** Savings rate the current totals actually support, as a tier 0..4 (mirrors cache.compact's mapping). */
export function tierForRate(incomeCents: number, spendCents: number): number {
  if (incomeCents <= 0) return 0;
  const net = incomeCents - spendCents;
  for (let tier = 4; tier >= 0; tier--) {
    if (net * 100 >= tier * 10 * incomeCents) return tier;
  }
  return 0;
}

export type GoalProgress = {
  percent: number;
  daysLeft: number;
  onTrack: boolean;
  achievableTier: number;
};

export function computeGoalProgress(goals: GoalsConfig | null): GoalProgress {
  const { incomeCents, spendCents } = computeMonthTotals();
  const achievableTier = tierForRate(incomeCents, spendCents);
  const daysLeft = daysLeftInMonth();
  const netSaved = Math.max(0, incomeCents - spendCents);

  let percent: number;
  if (!goals) {
    percent = achievableTier * 25;
  } else if (goals.goal.kind === "percent") {
    const savingsRate = incomeCents > 0 ? (netSaved / incomeCents) * 100 : 0;
    percent = Math.min(100, Math.round((savingsRate / goals.goal.percent) * 100));
  } else {
    percent = Math.min(100, Math.round((netSaved / goals.goal.amountCents) * 100));
  }

  const now = new Date();
  const totalDaysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const dayOfMonth = totalDaysInMonth - daysLeft;
  const expectedPercent = (dayOfMonth / totalDaysInMonth) * 100;

  return { percent, daysLeft, onTrack: percent >= expectedPercent - 15, achievableTier };
}
