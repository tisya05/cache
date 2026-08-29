import { useState } from "react";
import { Mail, PenLine, Sparkles, Lock, ArrowRight, Check } from "lucide-react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAppState } from "@/state/AppStateContext";
import { markOnboarded } from "@/lib/app-storage";

export function ConnectScreen() {
  const { navigate } = useAppState();
  const [demoLoaded, setDemoLoaded] = useState(false);

  const finish = () => {
    markOnboarded();
    navigate("city");
  };

  return (
    <div className="min-h-screen pb-10">
      <ScreenHeader title="Connect your data" onBack={() => navigate("goals")} />
      <div className="px-5">
        <p className="mb-6 text-sm text-text-secondary">
          We&apos;ll find your income and spending automatically. You&apos;re always in control.
        </p>

        {/* Email — not wired to a live inbox sync in this build. See BUILD-SPEC:
           we do not fake integrations, so this is honestly labeled rather than
           pretending a nonexistent connection succeeded. */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 opacity-70">
          <div className="mb-3 flex items-center gap-2">
            <Mail size={18} className="text-text-tertiary" />
            <span className="font-semibold">Email</span>
            <span className="text-sm text-text-tertiary">(Recommended)</span>
          </div>
          <div className="flex items-center justify-between rounded-[14px] border border-border-subtle bg-surface-subtle px-4 py-3">
            <span className="text-sm text-text-tertiary">Not connected in this build</span>
          </div>
        </div>

        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-text-tertiary">Other options</p>

        <button
          type="button"
          className="flex w-full items-center justify-between border-b border-border-subtle py-4 text-left"
        >
          <span className="flex items-center gap-3">
            <PenLine size={18} className="text-accent" />
            <span className="font-semibold">Add manually</span>
          </span>
          <ArrowRight size={16} className="text-text-tertiary" />
        </button>

        <button
          type="button"
          onClick={() => setDemoLoaded(true)}
          className="flex w-full items-center justify-between border-b border-border-subtle py-4 text-left"
        >
          <span className="flex items-center gap-3">
            <Sparkles size={18} className="text-accent" />
            <span className="font-semibold">Use demo data</span>
          </span>
          {demoLoaded ? (
            <Check size={16} className="text-success" />
          ) : (
            <ArrowRight size={16} className="text-text-tertiary" />
          )}
        </button>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-border-subtle bg-surface-subtle px-4 py-4 opacity-60">
          <span className="flex items-center gap-3">
            <Lock size={16} className="text-text-tertiary" />
            <span className="text-sm text-text-tertiary">Coming soon: Bank connection</span>
          </span>
          <ArrowRight size={16} className="text-text-tertiary" />
        </div>

        {demoLoaded && (
          <div className="mt-6 rounded-2xl border border-success/40 bg-success-surface p-4 text-sm text-text-primary">
            32 seeded transactions loaded — 1 needs your review.
          </div>
        )}

        <div className="mt-8">
          <button
            type="button"
            onClick={finish}
            disabled={!demoLoaded}
            className="w-full rounded-[14px] bg-accent px-6 py-4 text-center text-base font-bold text-text-on-accent disabled:opacity-40"
          >
            Continue to City
          </button>
        </div>
      </div>
    </div>
  );
}
