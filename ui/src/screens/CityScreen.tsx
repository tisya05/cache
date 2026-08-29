import { Flame } from "lucide-react";
import { CityIllustration } from "@/components/CityIllustration";
import { ProgressRing } from "@/components/ProgressRing";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAppState } from "@/state/AppStateContext";
import { loadGoals, loadProofReceipts } from "@/lib/app-storage";
import { computeGoalProgress } from "@/lib/month-progress";
import { formatMonthLabel } from "@/lib/format";

export function CityScreen() {
  const { ledger, navigate } = useAppState();
  const blocks = ledger?.blocks ?? 0;
  const streak = loadProofReceipts().length;
  const goals = loadGoals();
  const progress = computeGoalProgress(goals);

  return (
    <div className="min-h-screen pb-32 pt-4">
      <div className="flex items-center justify-between px-5">
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2">
          <span className="text-accent">●</span>
          <span className="font-bold">{blocks.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2">
          <Flame size={16} className="text-accent" />
          <span className="font-bold">{streak}</span>
          <span className="text-sm text-text-secondary">month streak</span>
        </div>
      </div>

      <div className="mt-4 px-5">
        <CityIllustration blocks={blocks} />
      </div>

      <div className="px-5">
        <p className="mb-2 text-sm font-semibold text-text-secondary">{formatMonthLabel()} progress</p>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <ProgressRing percent={progress.percent} size={64} />
              <span className="absolute text-lg font-extrabold">{progress.percent}%</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-primary">On track</p>
              <p className="text-xs text-text-tertiary">Tracking at this pace</p>
            </div>
            <p className="text-sm font-semibold text-text-secondary">{progress.daysLeft} days left</p>
          </div>
        </div>

        <div className="mt-4">
          <PrimaryButton onClick={() => navigate("prove")}>Seal this month</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
