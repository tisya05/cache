import { X } from "lucide-react";
import { BUILDING_CATALOG, type BuildingKey } from "@/lib/city-grid";

export function BuildShopSheet({
  balance,
  onPick,
  onClose,
}: {
  balance: number;
  onPick: (key: BuildingKey) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="w-full rounded-t-[28px] bg-surface-elevated p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Build</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={20} className="text-text-secondary" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {BUILDING_CATALOG.map((b) => {
            const affordable = balance >= b.cost;
            return (
              <button
                key={b.key}
                type="button"
                disabled={!affordable}
                onClick={() => onPick(b.key)}
                className={`flex flex-col items-center gap-1 rounded-2xl border p-3 ${
                  affordable ? "border-border bg-surface" : "border-border-subtle bg-surface-subtle opacity-40"
                }`}
              >
                <div className="relative flex h-14 w-14 items-center justify-center">
                  <div
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{ backgroundColor: "var(--color-accent)", opacity: affordable ? 0.25 : 0.1, filter: "blur(8px)" }}
                  />
                  <img
                    src={b.sprite}
                    alt={b.label}
                    className="relative h-12 w-auto object-contain"
                    style={{ filter: "brightness(1.15)" }}
                    draggable={false}
                  />
                </div>
                <span className="text-xs font-semibold">{b.label}</span>
                <span className="flex items-center gap-1 text-xs text-accent">
                  <span>●</span> {b.cost}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-text-tertiary">
          Balance: {balance} — pick a building, then tap an empty tile to place it.
        </p>
      </div>
    </div>
  );
}
