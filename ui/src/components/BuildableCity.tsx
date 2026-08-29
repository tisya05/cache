/**
 * The interactive isometric city grid. Night-lit transparent PNG sprites cut
 * from a single sheet (ui/public/tiles/sprites/) -- no tinting needed, unlike
 * the earlier Kenney-tile attempt (kept in IsometricCity.tsx as a fallback).
 *
 * Projection, from the 282x172 ground tile:
 *   screenX = (col - row) * 141
 *   screenY = (col + row) * 86
 *   z-order = col + row
 *
 * Buildings are narrower than a tile: centered horizontally on the tile,
 * bottom-aligned to the tile's own center point (not its bottom edge) so
 * they read as sitting on the diamond rather than floating above it. `park`
 * is a full-tile sprite and replaces the ground tile outright.
 *
 * Renders at native sprite size then scales down via CSS transform to fit a
 * phone screen -- at native size a 4x4 grid is ~1000px wide. A CSS transform
 * scales hit-testing along with the visuals, so tapping a tile still works.
 */
import { BUILDING_CATALOG, GROUND_TILE, type BuildingKey, type PlacedBuilding } from "@/lib/city-grid";

const HALF_W = GROUND_TILE.width / 2; // 141
const HALF_H = GROUND_TILE.height / 2; // 86
const SCALE = 0.33;

const BUILDING_BY_KEY = Object.fromEntries(BUILDING_CATALOG.map((b) => [b.key, b])) as Record<
  BuildingKey,
  (typeof BUILDING_CATALOG)[number]
>;

export function BuildableCity({
  gridSize,
  placed,
  selecting,
  onCellTap,
}: {
  gridSize: number;
  placed: PlacedBuilding[];
  /** Whether a building is currently selected in the shop, awaiting a tap to place. */
  selecting: boolean;
  onCellTap: (col: number, row: number) => void;
}) {
  const placedByCell = new Map(placed.map((p) => [`${p.col}-${p.row}`, p]));

  const cells: { col: number; row: number }[] = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) cells.push({ col, row });
  }
  const sorted = [...cells].sort((a, b) => a.col + a.row - (b.col + b.row));

  const nativeWidth = gridSize * HALF_W * 2;
  const nativeHeight = gridSize * HALF_H * 2 + 280; // headroom for the tallest building (tower, 266px)
  const originX = nativeWidth / 2 - HALF_W;
  const originY = 70;

  return (
    <div className="relative mx-auto overflow-hidden" style={{ width: nativeWidth * SCALE, height: nativeHeight * SCALE }}>
      <div
        className="absolute left-0 top-0 select-none"
        style={{ width: nativeWidth, height: nativeHeight, transform: `scale(${SCALE})`, transformOrigin: "top left" }}
      >
        {sorted.map(({ col, row }) => {
          const screenX = originX + (col - row) * HALF_W;
          const screenY = originY + (col + row) * HALF_H;
          const building = placedByCell.get(`${col}-${row}`);
          const def = building ? BUILDING_BY_KEY[building.kind] : undefined;
          const isFullTile = def?.fullTile;

          return (
            <button
              key={`${col}-${row}`}
              type="button"
              onClick={() => onCellTap(col, row)}
              disabled={!selecting || !!building}
              className="absolute"
              style={{
                left: screenX,
                top: screenY,
                width: GROUND_TILE.width,
                height: GROUND_TILE.height,
                zIndex: col + row,
                cursor: selecting && !building ? "pointer" : "default",
              }}
            >
              {!isFullTile && (
                <img src={GROUND_TILE.src} width={GROUND_TILE.width} height={GROUND_TILE.height} alt="" draggable={false} />
              )}
              {selecting && !building && (
                <div className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-inset ring-accent/50" />
              )}
              {def && (
                <img
                  src={def.sprite}
                  width={def.width}
                  alt={def.label}
                  draggable={false}
                  className="pointer-events-none absolute"
                  style={
                    isFullTile
                      ? { left: (GROUND_TILE.width - def.width) / 2, top: (GROUND_TILE.height - def.height) / 2 }
                      : { left: GROUND_TILE.width / 2 - def.width / 2, top: HALF_H - def.height }
                  }
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
