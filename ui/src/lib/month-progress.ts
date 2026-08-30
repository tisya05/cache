import type { GoalsConfig } from "@/lib/app-storage";
import { loadTransactionEvents } from "@/lib/transactions";
import { daysLeftInMonth, formatDollarsFromCents, formatShortDate } from "@/lib/format";

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
  /** Ring fill, clamped to 100. For a %-of-income goal this is a RATE
   *  comparison (this month's savings rate vs. the target rate), so it reads
   *  correctly at any point in the month. For a $-by-date goal it's this
   *  month's savings against THIS MONTH's share of the target (the total
   *  spread over the months remaining until the deadline) -- never the full
   *  target, which would make every month but the last look "behind." */
  percent: number;
  daysLeft: number;
  /** True exactly when percent >= 100 -- ring full and "on track" mean the
   *  same thing, on purpose, so the label never contradicts the ring. */
  onTrack: boolean;
  achievableTier: number;
  incomeCents: number;
  spendCents: number;
  /** Same net = income - spend the proof itself claims a tier from (see
   *  ProveScreen.tsx) -- the City screen must never show a "saved" number
   *  the proof wouldn't also stand behind. */
  savedCents: number;
  savedPercent: number;
  /** e.g. "Save 30% of income" or "Save $500 by Dec 31, 2026". */
  goalLabel: string;
};

export function computeGoalProgress(goals: GoalsConfig | null): GoalProgress {
  const { incomeCents, spendCents } = computeMonthTotals();
  const achievableTier = tierForRate(incomeCents, spendCents);
  const daysLeft = daysLeftInMonth();
  const savedCents = Math.max(0, incomeCents - spendCents);
  const savedPercent = incomeCents > 0 ? Math.round((savedCents / incomeCents) * 100) : 0;

  const now = new Date();

  let percent: number;
  let goalLabel: string;
  if (!goals) {
    percent = achievableTier * 25;
    goalLabel = "No goal set";
  } else if (goals.goal.kind === "percent") {
    percent = Math.min(100, Math.round((savedPercent / goals.goal.percent) * 100));
    goalLabel = `Save ${goals.goal.percent}% of income`;
  } else {
    // A $-by-date goal is judged against what THIS month needs to
    // contribute, not the full target -- otherwise every month looks
    // "behind" until the very last one, even while perfectly on schedule.
    // That per-month target is the total goal spread over however many
    // months remain between today and the deadline (inclusive of this
    // month), recomputed from today rather than fixed at goal-creation time.
    const deadline = new Date(`${goals.goal.deadline}T00:00:00Z`);
    const monthsLeft = Math.max(
      1,
      (deadline.getUTCFullYear() - now.getUTCFullYear()) * 12 + (deadline.getUTCMonth() - now.getUTCMonth()) + 1,
    );
    const monthlyTargetCents = Math.round(goals.goal.amountCents / monthsLeft);
    percent = monthlyTargetCents > 0 ? Math.min(100, Math.round((savedCents / monthlyTargetCents) * 100)) : 100;
    goalLabel = `Save ${formatDollarsFromCents(goals.goal.amountCents)} by ${formatShortDate(goals.goal.deadline)}`;
  }

  return {
    percent,
    daysLeft,
    onTrack: percent >= 100,
    achievableTier,
    incomeCents,
    spendCents,
    savedCents,
    savedPercent,
    goalLabel,
  };
}
