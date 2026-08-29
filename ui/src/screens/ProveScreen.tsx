import { useState } from "react";
import { Lock, ShieldCheck, Sparkles } from "lucide-react";
import { periodIdForMonth } from "@cache/contract";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAppState } from "@/state/AppStateContext";
import { computeMonthTotals, tierForRate } from "@/lib/month-progress";
import { isCheatModeOn, addProofReceipt, addBlockPlaced } from "@/lib/app-storage";
import { appendHistoryEntry } from "@/lib/history";

type ProveState = "idle" | "generating" | "success" | "rejected";

const IMPROVEMENT_TIPS = ["Saving more", "Reviewing transactions", "Waiting for more data"];

export function ProveScreen() {
  const { client, navigate, refreshLedger } = useAppState();
  const [state, setState] = useState<ProveState>("idle");
  const [rejectMessage, setRejectMessage] = useState("");
  const [result, setResult] = useState<{ tier: number; blocksEarned: number } | null>(null);
  const [elapsedLabel, setElapsedLabel] = useState("");

  const { incomeCents, spendCents } = computeMonthTotals();
  const achievableTier = tierForRate(incomeCents, spendCents);
  const cheating = isCheatModeOn();
  // The claimed tier is always the one the REAL data honestly supports --
  // Cheat Mode doesn't change what's claimed, it tampers with what gets
  // committed on-chain before the claim (per the product spec: "tampers with
  // committed values before proving"). Tripling the committed spend while
  // still claiming the honest tier guarantees a mismatch regardless of what
  // tier the real data happens to support, unlike claiming tier+1, which has
  // no headroom left when the real data already sits at the max tier (4).
  const claimedTier = achievableTier;
  const committedSpendCents = cheating ? spendCents * 3 : spendCents;

  const handleGenerate = async () => {
    if (!client) return;
    setState("generating");
    const started = performance.now();
    // Always explicit, never left to the client's own "current month"
    // default, so we know exactly what to persist for replay after reload
    // (see cache-client.ts) -- cheat-mode runs use a disposable random period
    // so they never collide with (or spend) the real month's nullifier.
    const now = new Date();
    const periodId = cheating
      ? crypto.getRandomValues(new Uint8Array(32))
      : periodIdForMonth(now.getUTCFullYear(), now.getUTCMonth() + 1);
    try {
      await client.updateTotals(BigInt(incomeCents), BigInt(committedSpendCents));
      const proveResult = await client.proveSavings(claimedTier, { generateRealProof: true, periodId });
      const elapsedS = ((performance.now() - started) / 1000).toFixed(1);
      setElapsedLabel(`${elapsedS}s`);
      setResult({ tier: proveResult.tier, blocksEarned: proveResult.blocksEarned });
      addProofReceipt({
        date: new Date().toISOString(),
        tier: proveResult.tier,
        blocksEarned: proveResult.blocksEarned,
        proofBytesLength: proveResult.proofBytes?.length,
      });
      if (!cheating) {
        appendHistoryEntry({ periodId, incomeCents, spendCents: committedSpendCents, tier: claimedTier });
      }
      await refreshLedger();
      setState("success");
    } catch (err) {
      setRejectMessage(err instanceof Error ? err.message : String(err));
      setState("rejected");
    }
  };

  if (state === "generating") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="relative flex h-40 w-40 items-center justify-center">
          <div className="absolute inset-0 animate-pulse rounded-full bg-accent/10 blur-xl" />
          <div className="relative flex h-24 w-24 rotate-45 items-center justify-center rounded-xl border-2 border-accent bg-surface-elevated shadow-[0_0_40px_rgba(252,198,131,0.35)]">
            <Sparkles className="-rotate-45 text-accent" size={32} />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold">Generating your proof</h1>
          <p className="mt-1 text-sm text-text-secondary">Running the math locally. Nothing is being sent.</p>
        </div>
        <div className="text-xs text-text-tertiary">
          <p>This takes about 5 seconds</p>
          <p>Please don&apos;t close the app</p>
        </div>
      </div>
    );
  }

  if (state === "success" && result) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-accent bg-accent/10 text-5xl font-extrabold text-accent shadow-[0_0_50px_rgba(252,198,131,0.4)]">
          {result.tier}
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">Proof sealed!</h1>
          <p className="mt-1 text-text-secondary">You hit your goal.</p>
        </div>
        <p className="text-xl font-bold text-accent">+{result.blocksEarned} tokens</p>
        <div className="mt-2 w-full rounded-2xl border border-border bg-surface p-4 text-left">
          <p className="text-sm font-semibold text-text-secondary">Your city grew</p>
          <p className="mt-1 font-bold">New building unlocked!</p>
        </div>
        {elapsedLabel && <p className="text-xs text-text-tertiary">Proved in {elapsedLabel}</p>}
        <div className="w-full pt-4">
          <PrimaryButton
            onClick={() => {
              addBlockPlaced(claimedTier);
              navigate("city");
            }}
          >
            View city
          </PrimaryButton>
        </div>
      </div>
    );
  }

  if (state === "rejected") {
    return (
      <div className="flex min-h-screen flex-col px-6 pt-16">
        <ScreenHeader onBack={() => navigate("city")} />
        <div className="flex flex-1 flex-col items-center text-center">
          <div className="relative mb-6 flex h-28 w-28 items-center justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-border bg-surface-elevated text-3xl font-extrabold text-text-tertiary">
              {claimedTier}
            </div>
            <Lock className="absolute -bottom-1 -right-1 rounded-full bg-surface p-1 text-text-tertiary" size={28} />
          </div>
          <h1 className="text-xl font-bold">Couldn&apos;t prove it this time</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Your data doesn&apos;t support Tier {claimedTier} yet.
          </p>
          <p className="mt-1 text-xs text-text-tertiary">{rejectMessage}</p>
          <div className="mt-6 w-full space-y-3 text-left">
            <p className="text-sm font-semibold">You can get there by:</p>
            {IMPROVEMENT_TIPS.map((tip, i) => (
              <div key={tip} className="flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${i === 0 ? "bg-accent" : "bg-border"}`} />
                <span className={i === 0 ? "text-text-primary" : "text-text-tertiary"}>{tip}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="pb-6">
          <PrimaryButton onClick={() => navigate("city")}>Try again next month</PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      <ScreenHeader onBack={() => navigate("city")} />
      <div className="px-5">
        <h1 className="text-2xl font-extrabold">Prove your progress</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Math checks it. You get tokens. Nobody sees your data.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-success/30 bg-surface p-4">
            <p className="mb-3 font-bold text-success">Stays private</p>
            <div className="mb-3 flex justify-center text-success">
              <Lock size={22} />
            </div>
            <ul className="space-y-2 text-sm text-text-secondary">
              {["Income", "Transactions", "Merchants", "Spend breakdown", "Everything"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Lock size={12} className="text-text-tertiary" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-semibold text-text-tertiary">Only you</p>
          </div>

          <div className="rounded-2xl border border-info/30 bg-surface p-4">
            <p className="mb-3 font-bold text-info">Goes public</p>
            <div className="mb-3 flex justify-center text-info">
              <ShieldCheck size={22} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="rounded-full bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
                Tier
              </span>
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-border text-3xl font-extrabold text-text-tertiary">
                {claimedTier}
              </span>
            </div>
            <p className="mt-3 text-center text-xs font-semibold text-text-tertiary">That&apos;s it</p>
          </div>
        </div>

        {cheating && (
          <p className="mt-4 rounded-xl border border-error/40 bg-error-surface px-4 py-2 text-center text-xs font-semibold text-error">
            Cheat Mode is on — claiming a tier your data doesn&apos;t support.
          </p>
        )}

        <div className="mt-8 flex flex-col items-center gap-4">
          <Lock className="text-accent" size={20} />
          <h2 className="text-lg font-bold">Generate proof</h2>
          <PrimaryButton onClick={handleGenerate} disabled={!client}>
            Generate proof
          </PrimaryButton>
          <p className="text-xs text-text-tertiary">This takes about 5 seconds</p>
        </div>
      </div>
    </div>
  );
}
