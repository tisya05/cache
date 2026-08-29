import { useState } from "react";
import { Check } from "lucide-react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAppState } from "@/state/AppStateContext";
import { saveGoals, DEFAULT_SPLIT, type Goal } from "@/lib/app-storage";
import { NEEDS_WANTS_SAVINGS_COLORS } from "@/lib/chart-colors";

export function GoalsScreen() {
  const { navigate } = useAppState();
  const [goalKind, setGoalKind] = useState<"percent" | "amount">("percent");
  const [expectedIncome, setExpectedIncome] = useState("");

  const handleContinue = () => {
    const goal: Goal =
      goalKind === "percent"
        ? { kind: "percent", percent: 30 }
        : { kind: "amount", amountCents: 200_000, deadline: "2026-12-31" };
    saveGoals({
      goal,
      split: DEFAULT_SPLIT,
      expectedIncomeCents: expectedIncome ? Math.round(Number(expectedIncome) * 100) : undefined,
    });
    navigate("connect");
  };

  return (
    <div className="min-h-screen pb-10">
      <ScreenHeader title="Set your goal" onBack={() => navigate("welcome")} />
      <div className="space-y-3 px-5">
        <button
          type="button"
          onClick={() => setGoalKind("percent")}
          className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left ${
            goalKind === "percent" ? "border-accent bg-accent-muted/20" : "border-border bg-surface"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                goalKind === "percent" ? "bg-accent" : "border border-border"
              }`}
            >
              {goalKind === "percent" && <Check size={14} className="text-text-on-accent" />}
            </span>
            <div>
              <p className="font-bold">Save 30%</p>
              <p className="text-sm text-text-tertiary">of whatever I earn</p>
            </div>
          </div>
          <span>🌱</span>
        </button>

        <button
          type="button"
          onClick={() => setGoalKind("amount")}
          className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left ${
            goalKind === "amount" ? "border-accent bg-accent-muted/20" : "border-border bg-surface"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                goalKind === "amount" ? "bg-accent" : "border border-border"
              }`}
            >
              {goalKind === "amount" && <Check size={14} className="text-text-on-accent" />}
            </span>
            <div>
              <p className="font-bold">Save $2,000</p>
              <p className="text-sm text-text-tertiary">by December 31st</p>
            </div>
          </div>
          <span>📅</span>
        </button>

        <div className="pt-4">
          <p className="mb-2 text-sm font-semibold text-text-secondary">Needs / Wants / Savings</p>
          <div className="flex h-9 overflow-hidden rounded-full text-xs font-bold">
            <div
              className="flex items-center justify-center"
              style={{ width: "50%", background: NEEDS_WANTS_SAVINGS_COLORS.needs }}
            >
              <span className="text-white">50%</span>
            </div>
            <div
              className="flex items-center justify-center"
              style={{ width: "30%", background: NEEDS_WANTS_SAVINGS_COLORS.wants }}
            >
              <span className="text-white">30%</span>
            </div>
            <div
              className="flex items-center justify-center"
              style={{ width: "20%", background: NEEDS_WANTS_SAVINGS_COLORS.savings }}
            >
              <span className="text-white">20%</span>
            </div>
          </div>
          <div className="mt-1 flex justify-between text-xs text-text-tertiary">
            <span>Needs</span>
            <span>Wants</span>
            <span>Savings</span>
          </div>
        </div>

        <div className="pt-4">
          <p className="text-sm font-semibold">Roughly what do you expect to earn?</p>
          <p className="mb-2 text-xs text-text-tertiary">Optional</p>
          <div className="flex items-center rounded-[14px] border border-border bg-surface px-4 py-3">
            <span className="text-text-tertiary">$</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="Enter amount"
              value={expectedIncome}
              onChange={(e) => setExpectedIncome(e.target.value)}
              className="ml-2 w-full bg-transparent outline-none placeholder:text-text-tertiary"
            />
          </div>
        </div>

        <div className="space-y-3 pt-4">
          <PrimaryButton onClick={handleContinue}>Continue</PrimaryButton>
          <button
            type="button"
            onClick={() => navigate("connect")}
            className="w-full text-center text-sm font-semibold text-accent"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
