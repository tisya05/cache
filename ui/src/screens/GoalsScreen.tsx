import { useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SplitSlider } from "@/components/SplitSlider";
import { useAppState } from "@/state/AppStateContext";
import { saveGoals, DEFAULT_SPLIT, type Goal } from "@/lib/app-storage";

type Step = "choose" | "split" | "amount";

export function GoalsScreen() {
  const { navigate } = useAppState();
  const [step, setStep] = useState<Step>("choose");
  const [expectedIncome, setExpectedIncome] = useState("");

  // Percent path: the split slider is the only place savings% is set --
  // asking for a percent number on the choice screen too would just be two
  // controls setting the same thing.
  const [needsPercent, setNeedsPercent] = useState(DEFAULT_SPLIT.needs);
  const [wantsPercent, setWantsPercent] = useState(DEFAULT_SPLIT.wants);
  const [savingsPercent, setSavingsPercent] = useState(DEFAULT_SPLIT.savings);

  // Amount path.
  const [amount, setAmount] = useState("2000");
  const [deadline, setDeadline] = useState("2026-12-31");

  const handleBack = () => {
    if (step === "choose") navigate("welcome");
    else setStep("choose");
  };

  const finishWithGoal = (goal: Goal, split = { needs: needsPercent, wants: wantsPercent, savings: savingsPercent }) => {
    saveGoals({
      goal,
      split,
      expectedIncomeCents: expectedIncome ? Math.round(Number(expectedIncome) * 100) : undefined,
    });
    navigate("connect");
  };

  if (step === "choose") {
    return (
      <div className="flex min-h-screen flex-col pb-10">
        <ScreenHeader title="Set your goal" onBack={handleBack} />
        <div className="flex flex-1 flex-col justify-center space-y-3 px-5">
          <p className="mb-1 text-sm text-text-secondary">How do you want to save?</p>
          <button
            type="button"
            onClick={() => setStep("split")}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface p-4 text-left"
          >
            <div>
              <p className="font-bold">Save a % of my income</p>
              <p className="text-sm text-text-tertiary">Splits every paycheck into needs, wants, savings</p>
            </div>
            <span className="text-2xl">🌱</span>
          </button>

          <button
            type="button"
            onClick={() => setStep("amount")}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface p-4 text-left"
          >
            <div>
              <p className="font-bold">Save $ by a date</p>
              <p className="text-sm text-text-tertiary">A fixed target with a deadline</p>
            </div>
            <span className="text-2xl">📅</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("connect")}
            className="w-full pt-4 text-center text-sm font-semibold text-accent"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  if (step === "split") {
    return (
      <div className="flex min-h-screen flex-col pb-10">
        <ScreenHeader title="Split your money" onBack={handleBack} />
        <div className="flex flex-1 flex-col justify-center space-y-6 px-5">
          <p className="text-sm text-text-secondary">
            Drag the bar to split what you earn. Savings is your goal — needs and wants take the rest.
          </p>

          <div className="flex justify-center py-2">
            <SplitSlider
              needsPercent={needsPercent}
              wantsPercent={wantsPercent}
              savingsPercent={savingsPercent}
              onChange={(needs, wants, savings) => {
                setNeedsPercent(needs);
                setWantsPercent(wants);
                setSavingsPercent(savings);
              }}
            />
          </div>

          <div>
            <p className="text-sm font-semibold">Roughly what do you expect to earn per month?</p>
            <p className="mb-2 text-xs text-text-tertiary">
              This estimates how much you need to save each month to hit your goal. Optional.
            </p>
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

          <PrimaryButton onClick={() => finishWithGoal({ kind: "percent", percent: savingsPercent })}>
            Continue
          </PrimaryButton>
        </div>
      </div>
    );
  }

  // step === "amount"
  return (
    <div className="flex min-h-screen flex-col pb-10">
      <ScreenHeader title="Set your target" onBack={handleBack} />
      <div className="flex flex-1 flex-col justify-center space-y-6 px-5">
        <div>
          <p className="mb-2 text-sm font-semibold">How much do you want to save?</p>
          <div className="flex items-center rounded-[14px] border border-border bg-surface px-4 py-3">
            <span className="text-text-tertiary">$</span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="ml-2 w-full bg-transparent outline-none"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">By what date?</p>
          <div className="flex items-center rounded-[14px] border border-border bg-surface px-4 py-3">
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-transparent outline-none"
            />
          </div>
        </div>

        <PrimaryButton
          onClick={() =>
            finishWithGoal(
              { kind: "amount", amountCents: Math.round((Number(amount) || 0) * 100), deadline },
              DEFAULT_SPLIT,
            )
          }
        >
          Continue
        </PrimaryButton>
      </div>
    </div>
  );
}
