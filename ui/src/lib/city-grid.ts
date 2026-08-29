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
