import { useState } from "react";
import { Mail, Lock, ArrowRight, Check, Loader2 } from "lucide-react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAppState } from "@/state/AppStateContext";
import { markOnboarded } from "@/lib/app-storage";
import { syncEmailInbox } from "@/lib/email-sync";

export function ConnectScreen() {
  const { navigate } = useAppState();
  const [emailStatus, setEmailStatus] = useState<
    { state: "idle" } | { state: "syncing" } | { state: "done"; count: number; needsReview: number } | { state: "error"; error: string }
  >({ state: "idle" });

  const finish = () => {
    markOnboarded();
    navigate("city");
  };

  const handleEmailSync = async () => {
    setEmailStatus({ state: "syncing" });
    const result = await syncEmailInbox();
    if (result.ok) {
      setEmailStatus({ state: "done", count: result.count, needsReview: result.needsReview });
    } else {
      setEmailStatus({ state: "error", error: result.error });
    }
  };

  const emailConnected = emailStatus.state === "done";

  return (
    <div className="min-h-screen pb-10">
      <ScreenHeader title="Connect your data" onBack={() => navigate("goals")} />
      <div className="px-5">
        <p className="mb-6 text-sm text-text-secondary">
          We&apos;ll find your income and spending automatically. You&apos;re always in control.
        </p>

        {/* A real sync against the local ingest bridge (ingest/scripts/serve.ts,
           see vite.config.ts's /email-server proxy) -- runs the actual IMAP +
           heuristics + Gemini pipeline against a real inbox. */}
        <button
          type="button"
          onClick={handleEmailSync}
          disabled={emailStatus.state === "syncing"}
          className="w-full rounded-2xl border border-border-subtle bg-surface p-4 text-left"
        >
          <div className="mb-3 flex items-center gap-2">
            <Mail size={18} className="text-accent" />
            <span className="font-semibold">Email</span>
            <span className="text-sm text-text-tertiary">(Recommended)</span>
          </div>
          <div className="flex items-center justify-between rounded-[14px] border border-border-subtle bg-surface-subtle px-4 py-3">
            {emailStatus.state === "idle" && <span className="text-sm text-text-secondary">Tap to sync your inbox</span>}
            {emailStatus.state === "syncing" && (
              <span className="flex items-center gap-2 text-sm text-text-secondary">
                <Loader2 size={14} className="animate-spin" /> Syncing your inbox…
              </span>
            )}
            {emailStatus.state === "done" && (
              <span className="flex items-center gap-2 text-sm text-success">
                <Check size={14} /> {emailStatus.count} transactions synced
              </span>
            )}
            {emailStatus.state === "error" && <span className="text-sm text-error">{emailStatus.error}</span>}
          </div>
        </button>

        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-text-tertiary">Other options</p>

        <div className="flex items-center justify-between rounded-2xl border border-border-subtle bg-surface-subtle px-4 py-4 opacity-60">
          <span className="flex items-center gap-3">
            <Lock size={16} className="text-text-tertiary" />
            <span className="text-sm text-text-tertiary">Coming soon: Bank connection</span>
          </span>
          <ArrowRight size={16} className="text-text-tertiary" />
        </div>

        {emailConnected && (
          <div className="mt-6 rounded-2xl border border-success/40 bg-success-surface p-4 text-sm text-text-primary">
            {emailStatus.count} real transactions synced from your inbox
            {emailStatus.needsReview > 0 ? ` — ${emailStatus.needsReview} need your review.` : "."}
          </div>
        )}

        <div className="mt-8">
          <button
            type="button"
            onClick={finish}
            disabled={!emailConnected}
            className="w-full rounded-[14px] bg-accent px-6 py-4 text-center text-base font-bold text-text-on-accent disabled:opacity-40"
          >
            Continue to City
          </button>
        </div>
      </div>
    </div>
  );
}
