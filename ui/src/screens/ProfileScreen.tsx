import { useState } from "react";
import { Settings, User, FileDown, FileText } from "lucide-react";
import { useAppState } from "@/state/AppStateContext";
import { loadProofReceipts, isCheatModeOn, setCheatMode } from "@/lib/app-storage";
import { loadHistory } from "@/lib/history";
import { generateHistory } from "@/lib/generate-history";
import { formatShortDate } from "@/lib/format";

export function ProfileScreen() {
  const { client, refreshLedger } = useAppState();
  const [cheat, setCheat] = useState(isCheatModeOn());
  const [receipts, setReceipts] = useState(loadProofReceipts());
  const [generating, setGenerating] = useState<{ done: number; total: number } | null>(null);

  const toggleCheat = () => {
    const next = !cheat;
    setCheatMode(next);
    setCheat(next);
  };

  const handleGenerateHistory = async () => {
    if (!client || generating) return;
    setGenerating({ done: 0, total: 8 });
    try {
      await generateHistory(client, 8, (done, total) => setGenerating({ done, total }));
      await refreshLedger();
      setReceipts(loadProofReceipts());
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="min-h-screen pb-32 pt-6">
      <div className="flex items-center justify-between px-5">
        <Settings size={22} className="text-text-secondary" />
        <h1 className="text-lg font-bold">Profile</h1>
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-accent text-accent">
          <User size={18} />
        </div>
      </div>

      <div className="mx-5 mt-6 rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-lg font-bold">Proof receipts</p>
            <p className="text-xs text-text-tertiary">{receipts.length} total</p>
          </div>
          <FileDown size={18} className="text-accent" />
        </div>

        {receipts.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-tertiary">No proofs generated yet.</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {receipts.map((r, i) => (
              <div
                key={`${r.date}-${i}`}
                className="flex items-center justify-between rounded-[14px] border border-border-subtle bg-surface-subtle px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-text-tertiary" />
                  <div>
                    <p className="text-sm font-semibold">Proof generated</p>
                    <p className="text-xs text-text-tertiary">{formatShortDate(r.date)}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-text-secondary">Tier {r.tier}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dev-only: backfills real history (real proofs, real SNARKs) so the
         city isn't an empty lot before a demo recording. Not part of the
         product surface a real user would see in a shipped app. */}
      <div className="mx-5 mt-4 rounded-2xl border border-dashed border-border-subtle p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">Dev tools</p>
        <button
          type="button"
          onClick={handleGenerateHistory}
          disabled={!client || !!generating}
          className="w-full rounded-[14px] border border-border bg-surface-subtle px-4 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {generating ? `Generating history… ${generating.done}/${generating.total}` : `Generate 8 months of history (real proofs)`}
        </button>
        <p className="mt-2 text-xs text-text-tertiary">{loadHistory().length} historical periods persisted.</p>
      </div>

      <div className="mx-5 mt-6 flex items-center justify-between rounded-2xl border border-border bg-surface px-5 py-4">
        <span className="font-semibold">Cheat Mode</span>
        <button
          type="button"
          role="switch"
          aria-checked={cheat}
          onClick={toggleCheat}
          className={`relative h-6 w-11 rounded-full transition-colors ${cheat ? "bg-accent" : "bg-surface-elevated"}`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${cheat ? "translate-x-5" : "translate-x-0"}`}
          />
        </button>
      </div>
      {cheat && (
        <p className="mx-5 mt-2 text-xs text-error">
          On: the next proof will tamper with committed totals before proving, to demonstrate rejection.
        </p>
      )}
    </div>
  );
}
