import { useState } from "react";
import { Flame, Hammer, Lock } from "lucide-react";
import { BuildableCity } from "@/components/BuildableCity";
import { BuildShopSheet } from "@/components/BuildShopSheet";
import { ProgressRing } from "@/components/ProgressRing";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAppState } from "@/state/AppStateContext";
import { loadGoals, loadProofReceipts } from "@/lib/app-storage";
import { computeGoalProgress } from "@/lib/month-progress";
import { formatMonthLabel, formatDollarsFromCents } from "@/lib/format";
import {
  BUILDING_CATALOG,
  loadPlacedBuildings,
  placeBuildingAt,
  moveBuildingTo,
  removeBuildingAt,
  nextUpgrade,
  appendBuildLog,
  type BuildingKey,
  type BuildingDef,
} from "@/lib/city-grid";

const GRID_SIZE = 4;

export function CityScreen() {
  const { client, ledger, navigate, refreshLedger } = useAppState();
  const blocks = ledger?.blocks ?? 0;
  const streak = loadProofReceipts().length;
  const goals = loadGoals();
  const progress = computeGoalProgress(goals);

  const [shopOpen, setShopOpen] = useState(false);
  const [selected, setSelected] = useState<BuildingKey | null>(null);
  const [movingFrom, setMovingFrom] = useState<{ col: number; row: number } | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<{ col: number; row: number; from: BuildingDef; to: BuildingDef } | null>(
    null,
  );
  const [placed, setPlaced] = useState(loadPlacedBuildings());
  const [busy, setBusy] = useState(false);

  const isOccupied = (col: number, row: number) => placed.some((p) => p.col === col && p.row === row);

  const handlePick = (key: BuildingKey) => {
    setSelected(key);
    setMovingFrom(null);
    setShopOpen(false);
  };

  const handleCellTap = async (col: number, row: number) => {
    if (movingFrom) {
      if (isOccupied(col, row)) return; // can't drop onto an occupied cell
      moveBuildingTo(movingFrom.col, movingFrom.row, col, row); // free -- no tokens change hands
      setPlaced(loadPlacedBuildings());
      setMovingFrom(null);
      return;
    }
    if (!selected || !client || busy || isOccupied(col, row)) return;
    const def = BUILDING_CATALOG.find((b) => b.key === selected)!;
    if (blocks < def.cost) return; // shop already gates this, but re-check against live balance
    setBusy(true);
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
      setBusy(false);
    }
  };

  const handleOccupiedTap = (col: number, row: number) => {
    if (selected || movingFrom) return;
    const building = placed.find((p) => p.col === col && p.row === row);
    if (!building) return;
    const to = nextUpgrade(building.kind);
    if (!to) return; // already at tower, or park (not on the ladder)
    const from = BUILDING_CATALOG.find((b) => b.key === building.kind)!;
    setUpgradePrompt({ col, row, from, to });
  };

  const handleLongPressOccupied = (col: number, row: number) => {
    if (selected) return;
    setUpgradePrompt(null);
    setMovingFrom({ col, row });
  };

  const handleConfirmUpgrade = async () => {
    if (!upgradePrompt || !client || busy) return;
    const diff = upgradePrompt.to.cost - upgradePrompt.from.cost;
    if (blocks < diff) return;
    setBusy(true);
    try {
      for (let i = 0; i < diff; i++) {
        await client.build(upgradePrompt.to.onChainKind);
        appendBuildLog(upgradePrompt.to.onChainKind);
      }
      placeBuildingAt(upgradePrompt.col, upgradePrompt.row, upgradePrompt.to.key);
      setPlaced(loadPlacedBuildings());
      await refreshLedger();
    } finally {
      setUpgradePrompt(null);
      setBusy(false);
    }
  };

  const handleRemove = () => {
    if (!movingFrom) return;
    removeBuildingAt(movingFrom.col, movingFrom.row); // free, but NOT refunded -- no mint-back circuit exists
    setPlaced(loadPlacedBuildings());
    setMovingFrom(null);
  };

  const upgradeDiff = upgradePrompt ? upgradePrompt.to.cost - upgradePrompt.from.cost : 0;

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
          {busy ? "Placing…" : `Tap an empty tile to place your ${selected}`}
        </p>
      )}

      {movingFrom && (
        <div className="mx-5 mt-3 flex items-center justify-between gap-3 rounded-xl bg-accent-muted/30 px-3 py-2">
          <p className="text-xs font-semibold text-accent-light">
            Tap a tile to move it. Removing won&apos;t refund tokens.
          </p>
          <div className="flex shrink-0 gap-3">
            <button type="button" onClick={handleRemove} className="text-xs font-bold text-error">
              Remove
            </button>
            <button type="button" onClick={() => setMovingFrom(null)} className="text-xs font-bold text-text-tertiary">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-hidden">
        <BuildableCity
          gridSize={GRID_SIZE}
          placed={placed}
          selecting={!!selected || !!movingFrom}
          movingFrom={movingFrom}
          onCellTap={handleCellTap}
          onOccupiedTap={handleOccupiedTap}
          onLongPressOccupied={handleLongPressOccupied}
        />
      </div>

      <div className="px-5">
        <button
          type="button"
          onClick={() => setShopOpen(true)}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-[14px] border border-border bg-surface py-3 font-bold text-accent"
        >
          <Hammer size={18} /> Build
        </button>

        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-text-secondary">{formatMonthLabel()} progress toward your savings goal</p>
          <span className="flex items-center gap-1 rounded-full bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-text-secondary">
            <Lock size={10} /> Private
          </span>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
              <ProgressRing
                percent={progress.percent}
                size={64}
                color={progress.onTrack ? "var(--color-success)" : "var(--color-accent)"}
              />
              <span className="absolute text-sm font-extrabold">{progress.percent}%</span>
            </div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${progress.onTrack ? "text-success" : "text-text-primary"}`}>
                {progress.onTrack ? "On track" : "Below pace"}
              </p>
              <p className="text-xs text-text-tertiary">{progress.goalLabel}</p>
            </div>
            <p className="text-sm font-semibold text-text-secondary">{progress.daysLeft} days left</p>
          </div>

          <div className="mt-4 space-y-2 border-t border-border-subtle pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-text-tertiary">Income so far</span>
              <span className="font-semibold">{formatDollarsFromCents(progress.incomeCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">Spent so far</span>
              <span className="font-semibold">{formatDollarsFromCents(progress.spendCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">Saved so far</span>
              <span className="font-semibold">
                {formatDollarsFromCents(progress.savedCents)} · {progress.savedPercent}%
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <PrimaryButton onClick={() => navigate("prove")}>Seal this month</PrimaryButton>
        </div>
      </div>

      {shopOpen && <BuildShopSheet balance={blocks} onPick={handlePick} onClose={() => setShopOpen(false)} />}

      {upgradePrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          onClick={() => setUpgradePrompt(null)}
        >
          <div className="w-full max-w-xs rounded-2xl bg-surface-elevated p-5" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-center font-bold">Upgrade to {upgradePrompt.to.label}?</p>
            <div className="mb-4 flex items-center justify-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <div
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{ backgroundColor: "var(--color-accent)", opacity: 0.15, filter: "blur(10px)" }}
                />
                <img
                  src={upgradePrompt.from.sprite}
                  alt={upgradePrompt.from.label}
                  className="relative h-14 w-auto object-contain opacity-60"
                  style={{ filter: "brightness(1.2)" }}
                />
              </div>
              <span className="text-text-tertiary">→</span>
              <div className="relative flex h-16 w-16 items-center justify-center">
                <div
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{ backgroundColor: "var(--color-accent)", opacity: 0.3, filter: "blur(10px)" }}
                />
                <img
                  src={upgradePrompt.to.sprite}
                  alt={upgradePrompt.to.label}
                  className="relative h-14 w-auto object-contain"
                  style={{ filter: "brightness(1.2)" }}
                />
              </div>
            </div>
            <p className="mb-4 text-center text-sm text-text-secondary">
              Costs <span className="font-bold text-accent">{upgradeDiff}</span> tokens (the price difference)
            </p>
            <PrimaryButton disabled={blocks < upgradeDiff || busy} onClick={handleConfirmUpgrade}>
              {busy ? "Upgrading…" : "Upgrade"}
            </PrimaryButton>
            <button
              type="button"
              onClick={() => setUpgradePrompt(null)}
              className="mt-2 w-full text-center text-sm text-text-tertiary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
