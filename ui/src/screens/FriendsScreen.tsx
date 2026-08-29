import { useState } from "react";
import { Flame } from "lucide-react";
import { TierPill } from "@/components/TierBadge";
import { useAppState } from "@/state/AppStateContext";
import { loadProofReceipts } from "@/lib/app-storage";

// No backend/social graph exists yet — these are illustrative rows so the
// leaderboard layout and the "no dollar figures" rule can be demonstrated.
// "You" reflects the real local tier from the contract client.
const FRIENDS = [
  { name: "Nina", tier: 4, streak: 8, avatar: "🐱" },
  { name: "Thomas", tier: 3, streak: 8, avatar: "🦊" },
  { name: "Latrice", tier: 2, streak: 2, avatar: "🐻" },
  { name: "Jonathan", tier: 2, streak: 2, avatar: "🐨" },
  { name: "Chris", tier: 1, streak: 1, avatar: "🐢" },
];

export function FriendsScreen() {
  const { ledger } = useAppState();
  const [tab, setTab] = useState<"month" | "all">("month");
  const you = { name: "You", tier: ledger?.tier ?? 0, streak: loadProofReceipts().length, avatar: "🦝" };
  const rows = [...FRIENDS, you].sort((a, b) => b.tier - a.tier || b.streak - a.streak);

  return (
    <div className="min-h-screen pb-32 pt-6">
      <h1 className="px-5 text-center text-xl font-extrabold">Friends leaderboard</h1>

      <div className="mx-5 mt-4 flex rounded-full border border-border bg-surface p-1">
        <button
          type="button"
          onClick={() => setTab("month")}
          className={`flex-1 rounded-full py-2 text-sm font-semibold ${
            tab === "month" ? "bg-surface-elevated text-accent" : "text-text-tertiary"
          }`}
        >
          This month
        </button>
        <button
          type="button"
          onClick={() => setTab("all")}
          className={`flex-1 rounded-full py-2 text-sm font-semibold ${
            tab === "all" ? "bg-surface-elevated text-accent" : "text-text-tertiary"
          }`}
        >
          All time
        </button>
      </div>

      <div className="mt-4 divide-y divide-border-subtle px-5">
        {rows.map((row, i) => (
          <div key={row.name} className="flex items-center gap-3 py-3">
            <span className="w-5 text-sm font-semibold text-text-tertiary">{i + 1}</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated text-lg">
              {row.avatar}
            </span>
            <div className="flex-1">
              <p className="font-semibold">{row.name}</p>
              <TierPill tier={row.tier} />
            </div>
            <span className="flex items-center gap-1 text-sm font-semibold text-text-secondary">
              {row.streak} streak <Flame size={14} className="text-accent" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
