import { useState } from "react";
import { Settings, User, FileDown, FileText, X, TriangleAlert } from "lucide-react";
import { useAppState } from "@/state/AppStateContext";
import {
  loadProofReceipts,
  isCheatModeOn,
  setCheatMode,
  loadGoals,
  saveGoals,
  DEFAULT_SPLIT,
  loadDisplayName,
  saveDisplayName,
  clearAllData,
  type Goal,
} from "@/lib/app-storage";
import { loadHistory } from "@/lib/history";
import { generateHistory } from "@/lib/generate-history";
import { formatShortDate } from "@/lib/format";

export function ProfileScreen() {
  const { client, refreshLedger } = useAppState();
  const [cheat, setCheat] = useState(isCheatModeOn());
  const [receipts, setReceipts] = useState(loadProofReceipts());
  const [generating, setGenerating] = useState<{ done: number; total: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const existingGoals = loadGoals();
  const [goalKind, setGoalKind] = useState<"percent" | "amount">(existingGoals?.goal.kind ?? "percent");
  const [percent, setPercent] = useState(
    String(existingGoals?.goal.kind === "percent" ? existingGoals.goal.percent : 30),
  );
  const [amount, setAmount] = useState(
    String(existingGoals?.goal.kind === "amount" ? existingGoals.goal.amountCents / 100 : 2000),
  );
  const [deadline, setDeadline] = useState(
    existingGoals?.goal.kind === "amount" ? existingGoals.goal.deadline : "2026-12-31",
  );
  const [needs, setNeeds] = useState(String(existingGoals?.split.needs ?? DEFAULT_SPLIT.needs));
  const [wants, setWants] = useState(String(existingGoals?.split.wants ?? DEFAULT_SPLIT.wants));
  const [savings, setSavings] = useState(String(existingGoals?.split.savings ?? DEFAULT_SPLIT.savings));
  const splitSum = (Number(needs) || 0) + (Number(wants) || 0) + (Number(savings) || 0);

  const [displayName, setDisplayName] = useState(loadDisplayName());

  const handleSaveGoals = () => {
    if (splitSum !== 100) return;
    const goal: Goal =
      goalKind === "percent"
        ? { kind: "percent", percent: Number(percent) || 0 }
        : { kind: "amount", amountCents: Math.round((Number(amount) || 0) * 100), deadline };
    saveGoals({
      goal,
      split: { needs: Number(needs) || 0, wants: Number(wants) || 0, savings: Number(savings) || 0 },
      expectedIncomeCents: existingGoals?.expectedIncomeCents,
    });
    setSettingsOpen(false);
  };

  const handleSaveName = () => {
    saveDisplayName(displayName.trim() || "You");
    setProfileOpen(false);
  };

  const handleClearAllData = () => {
    clearAllData();
    window.location.reload();
  };

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
        <button type="button" onClick={() => setSettingsOpen(true)} aria-label="Edit goals">
          <Settings size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-lg font-bold">Profile</h1>
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          aria-label="Edit profile"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-accent text-accent"
        >
          <User size={18} />
        </button>
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

      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-[28px] bg-surface-elevated p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Edit goals</h2>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close">
                <X size={20} className="text-text-secondary" />
              </button>
            </div>

            <p className="mb-2 text-sm font-semibold text-text-secondary">Savings target</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setGoalKind("percent")}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${
                  goalKind === "percent" ? "border-accent bg-accent-muted/20" : "border-border bg-surface"
                }`}
              >
                <span>🌱</span>
                <span className="flex flex-1 items-center gap-2">
                  <span className="text-sm font-semibold">Save</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={percent}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setPercent(e.target.value)}
                    className="w-16 rounded-lg border border-border bg-surface-subtle px-2 py-1 text-sm outline-none"
                  />
                  <span className="text-sm font-semibold">% of what I earn</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setGoalKind("amount")}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${
                  goalKind === "amount" ? "border-accent bg-accent-muted/20" : "border-border bg-surface"
                }`}
              >
                <span>📅</span>
                <span className="flex flex-1 flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">Save $</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-20 rounded-lg border border-border bg-surface-subtle px-2 py-1 text-sm outline-none"
                  />
                  <span className="text-sm font-semibold">by</span>
                  <input
                    type="date"
                    value={deadline}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="rounded-lg border border-border bg-surface-subtle px-2 py-1 text-sm outline-none"
                  />
                </span>
              </button>
            </div>

            <p className="mb-2 mt-5 text-sm font-semibold text-text-secondary">Needs / Wants / Savings split</p>
            <div className="flex gap-2">
              {[
                { label: "Needs", value: needs, set: setNeeds },
                { label: "Wants", value: wants, set: setWants },
                { label: "Savings", value: savings, set: setSavings },
              ].map((f) => (
                <label key={f.label} className="flex-1">
                  <span className="mb-1 block text-xs text-text-tertiary">{f.label}</span>
                  <div className="flex items-center rounded-[14px] border border-border bg-surface px-3 py-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={f.value}
                      onChange={(e) => f.set(e.target.value)}
                      className="w-full bg-transparent text-sm outline-none"
                    />
                    <span className="text-xs text-text-tertiary">%</span>
                  </div>
                </label>
              ))}
            </div>
            <p className={`mt-2 text-xs ${splitSum === 100 ? "text-text-tertiary" : "text-error"}`}>
              {splitSum === 100 ? "Adds up to 100%." : `Adds up to ${splitSum}% — must total 100%.`}
            </p>

            <button
              type="button"
              onClick={handleSaveGoals}
              disabled={splitSum !== 100}
              className="mt-5 w-full rounded-[14px] bg-accent py-3 text-center font-bold text-text-on-accent disabled:opacity-40"
            >
              Save goal
            </button>
          </div>
        </div>
      )}

      {profileOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          onClick={() => {
            setProfileOpen(false);
            setConfirmingClear(false);
          }}
        >
          <div className="w-full max-w-xs rounded-2xl bg-surface-elevated p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Profile</h2>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  setConfirmingClear(false);
                }}
                aria-label="Close"
              >
                <X size={20} className="text-text-secondary" />
              </button>
            </div>

            <div className="mb-4 flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-accent text-accent">
                <User size={28} />
              </div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
                className="w-full rounded-[14px] border border-border bg-surface px-4 py-3 text-center text-sm outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveName}
              className="mb-4 w-full rounded-[14px] bg-accent py-3 text-center font-bold text-text-on-accent"
            >
              Save
            </button>

            <div className="border-t border-border-subtle pt-4">
              {!confirmingClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmingClear(true)}
                  className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-error"
                >
                  <TriangleAlert size={16} /> Clear all data
                </button>
              ) : (
                <div className="rounded-2xl border border-error/40 bg-error/10 p-3 text-center">
                  <p className="mb-3 text-xs text-error">
                    This wipes your identity and every local record — goals, proof receipts, and your city.
                    There's no undo.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingClear(false)}
                      className="flex-1 rounded-[14px] border border-border py-2 text-sm font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllData}
                      className="flex-1 rounded-[14px] bg-error py-2 text-sm font-semibold text-white"
                    >
                      Clear it
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
