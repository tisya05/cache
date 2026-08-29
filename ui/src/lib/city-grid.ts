/**
 * The buildable city: a persistent grid of placed buildings. Positions are
 * cosmetic and live in localStorage; the thing that's actually real is the
 * token spend behind each placement -- see BuildableCity.tsx, which calls
 * the real build(kind) circuit once per unit of cost (the contract's build()
 * always decrements the block balance by exactly 1 per call; there's no
 * quantity parameter, so a cost-N building is N real sequential calls).
 */

export type BuildingKey = "tree" | "house" | "shop" | "park" | "apartment" | "tower";

export type BuildingDef = {
  key: BuildingKey;
  label: string;
  cost: number;
  sprite: string;
  width: number;
  height: number;
  /** Full-tile footprint (like park) replaces the ground tile instead of sitting on it. */
  fullTile?: boolean;
  /** The on-chain `kind` argument passed to build(kind) -- must be 0..7 (cache.compact's maxBuildingKind). */
  onChainKind: number;
};

export const BUILDING_CATALOG: BuildingDef[] = [
  { key: "tree", label: "Tree", cost: 1, sprite: "/tiles/sprites/tree.png", width: 79, height: 134, onChainKind: 0 },
  { key: "house", label: "House", cost: 3, sprite: "/tiles/sprites/house.png", width: 185, height: 159, onChainKind: 1 },
  { key: "shop", label: "Shop", cost: 5, sprite: "/tiles/sprites/shop.png", width: 199, height: 216, onChainKind: 2 },
  { key: "park", label: "Park", cost: 6, sprite: "/tiles/sprites/park.png", width: 267, height: 166, fullTile: true, onChainKind: 3 },
  { key: "apartment", label: "Apartment", cost: 10, sprite: "/tiles/sprites/apartment.png", width: 181, height: 254, onChainKind: 4 },
  { key: "tower", label: "Tower", cost: 20, sprite: "/tiles/sprites/tower.png", width: 123, height: 266, onChainKind: 5 },
];

export const GROUND_TILE = { src: "/tiles/sprites/ground-tile.png", width: 282, height: 172 };

export type PlacedBuilding = { col: number; row: number; kind: BuildingKey };

const GRID_KEY = "cache:city-grid:v1";

export function loadPlacedBuildings(): PlacedBuilding[] {
  const raw = localStorage.getItem(GRID_KEY);
  return raw ? (JSON.parse(raw) as PlacedBuilding[]) : [];
}

export function placeBuildingAt(col: number, row: number, kind: BuildingKey): void {
  const placed = loadPlacedBuildings().filter((p) => !(p.col === col && p.row === row));
  placed.push({ col, row, kind });
  localStorage.setItem(GRID_KEY, JSON.stringify(placed));
}

/** Free -- no tokens change hands, so no build() call. */
export function moveBuildingTo(fromCol: number, fromRow: number, toCol: number, toRow: number): void {
  const placed = loadPlacedBuildings();
  const building = placed.find((p) => p.col === fromCol && p.row === fromRow);
  if (!building) return;
  const next = placed
    .filter((p) => !(p.col === fromCol && p.row === fromRow) && !(p.col === toCol && p.row === toRow))
    .concat({ col: toCol, row: toRow, kind: building.kind });
  localStorage.setItem(GRID_KEY, JSON.stringify(next));
}

/** Free to remove, but NOT refunded -- build() only ever decremented the balance; there's no mint-back circuit. */
export function removeBuildingAt(col: number, row: number): void {
  const placed = loadPlacedBuildings().filter((p) => !(p.col === col && p.row === row));
  localStorage.setItem(GRID_KEY, JSON.stringify(placed));
}

/**
 * The upgrade ladder the city grows UPWARD through, one tap at a time, in
 * place -- deliberately not a separate set of modular base/midsection/head
 * sprites, which would need new art and stacking logic. `park` is a
 * decorative full-tile piece, not part of the ladder.
 */
export const UPGRADE_ORDER: BuildingKey[] = ["tree", "house", "shop", "apartment", "tower"];

export function nextUpgrade(current: BuildingKey): BuildingDef | null {
  const i = UPGRADE_ORDER.indexOf(current);
  if (i === -1 || i === UPGRADE_ORDER.length - 1) return null;
  const nextKey = UPGRADE_ORDER[i + 1]!;
  return BUILDING_CATALOG.find((b) => b.key === nextKey)!;
}

/**
 * The in-memory local ledger forgets every build() call on reload just like
 * it forgets proveSavings calls (see history.ts) -- without replaying these
 * too, a reload would show the grid's placed buildings (persisted here) next
 * to a token balance that never actually paid for them. Logged as a flat
 * ordered list of on-chain kind values; replayed in cache-client.ts right
 * after the proof history.
 */
const BUILD_LOG_KEY = "cache:build-log:v1";

export function loadBuildLog(): number[] {
  const raw = localStorage.getItem(BUILD_LOG_KEY);
  return raw ? (JSON.parse(raw) as number[]) : [];
}

export function appendBuildLog(onChainKind: number): void {
  const log = loadBuildLog();
  log.push(onChainKind);
  localStorage.setItem(BUILD_LOG_KEY, JSON.stringify(log));
}
