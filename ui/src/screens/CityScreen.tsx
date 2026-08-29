import { useState } from "react";
import { Flame, Hammer } from "lucide-react";
import { BuildableCity } from "@/components/BuildableCity";
import { BuildShopSheet } from "@/components/BuildShopSheet";
import { ProgressRing } from "@/components/ProgressRing";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAppState } from "@/state/AppStateContext";
import { loadGoals, loadProofReceipts } from "@/lib/app-storage";
import { computeGoalProgress } from "@/lib/month-progress";
import { formatMonthLabel } from "@/lib/format";
import { BUILDING_CATALOG, loadPlacedBuildings, placeBuildingAt, appendBuildLog, type BuildingKey } from "@/lib/city-grid";

const GRID_SIZE = 4;

export function CityScreen() {
  const { client, ledger, navigate, refreshLedger } = useAppState();
  const blocks = ledger?.blocks ?? 0;
  const streak = loadProofReceipts().length;
  const goals = loadGoals();
  const progress = computeGoalProgress(goals);

  const [shopOpen, setShopOpen] = useState(false);
  const [selected, setSelected] = useState<BuildingKey | null>(null);
  const [placed, setPlaced] = useState(loadPlacedBuildings());
  const [placing, setPlacing] = useState(false);

  const handlePick = (key: BuildingKey) => {
    setSelected(key);
    setShopOpen(false);
  };

  const handleCellTap = async (col: number, row: number) => {
    if (!selected || !client || placing) return;
    const def = BUILDING_CATALOG.find((b) => b.key === selected)!;
    if (blocks < def.cost) return; // shop already gates this, but re-check against live balance
    setPlacing(true);
    try {
      // build(kind) always spends exactly one block per call -- there's no
      // quantity argument on the circuit -- so a cost-N building is N real,
      // sequential on-chain decrements, not a single call with a multiplier.
      for (let i = 0; i < def.cost; i++) {
        await client.build(def.onChainKind);
        appendBuildLog(def.onChainKind);
      }
      placeBuildingAt(col, row, def.key);
      setPlaced(loadPlacedBuildings());
      await refreshLedger();
    } finally {
      setSelected(null);
      setPlacing(false);
    }
  };

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

      {selected && (
        <p className="mx-5 mt-3 rounded-xl bg-accent-muted/30 px-3 py-2 text-center text-xs font-semibold text-accent-light">
          {placing ? "Placing…" : `Tap an empty tile to place your ${selected}`}
        </p>
      )}

      <div className="mt-4 overflow-hidden">
        <BuildableCity gridSize={GRID_SIZE} placed={placed} selecting={!!selected} onCellTap={handleCellTap} />
      </div>

      <div className="px-5">
        <button
          type="button"
          onClick={() => setShopOpen(true)}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-[14px] border border-border bg-surface py-3 font-bold text-accent"
        >
          <Hammer size={18} /> Build
        </button>

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

      {shopOpen && <BuildShopSheet balance={blocks} onPick={handlePick} onClose={() => setShopOpen(false)} />}
    </div>
  );
}
