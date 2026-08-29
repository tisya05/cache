/**
 * The interactive isometric city grid. Night-lit transparent PNG sprites cut
 * from a single sheet (ui/public/tiles/sprites/) -- no tinting needed, unlike
 * the earlier Kenney-tile attempt (kept in IsometricCity.tsx as a fallback).
 *
 * Placement step is 137x83, not the ground tile's true half-size (141x86):
 * the tile art is darker at its own edges than its center, so tessellating
 * at exact half-size left a visible seam between every cell. ~3% overlap
 * hides it without visibly distorting the grid. Anchor math for centering a
 * building within its tile still uses the tile's real half-size (141/86),
 * since that's about the sprite's own geometry, not cell spacing.
 *
 * Interactions (idle mode, i.e. nothing picked up from the shop):
 *   - tap an empty cell: no-op
 *   - tap an occupied cell: ask the parent for an upgrade prompt
 *   - long-press an occupied cell: pick it up for a free move-or-remove
 */
import { useRef } from "react";
import { BUILDING_CATALOG, GROUND_TILE, type BuildingKey, type PlacedBuilding } from "@/lib/city-grid";

const STEP_X = 137;
const STEP_Y = 83;
const HALF_W = GROUND_TILE.width / 2; // 141 -- building anchor only, not cell spacing
const HALF_H = GROUND_TILE.height / 2; // 86 -- building anchor only, not cell spacing
const SCALE = 0.5;
const LONG_PRESS_MS = 450;

const BUILDING_BY_KEY = Object.fromEntries(BUILDING_CATALOG.map((b) => [b.key, b])) as Record<
  BuildingKey,
  (typeof BUILDING_CATALOG)[number]
>;

export function BuildableCity({
  gridSize,
  placed,
  selecting,
  movingFrom,
  onCellTap,
  onOccupiedTap,
  onLongPressOccupied,
}: {
  gridSize: number;
  placed: PlacedBuilding[];
  /** Whether a building is currently selected in the shop (placing) or picked up for a move (moving-to). */
  selecting: boolean;
  movingFrom?: { col: number; row: number } | null;
  onCellTap: (col: number, row: number) => void;
  onOccupiedTap: (col: number, row: number) => void;
  onLongPressOccupied: (col: number, row: number) => void;
}) {
  const placedByCell = new Map(placed.map((p) => [`${p.col}-${p.row}`, p]));
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const cells: { col: number; row: number }[] = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) cells.push({ col, row });
  }
  const sorted = [...cells].sort((a, b) => a.col + a.row - (b.col + b.row));

  const nativeWidth = gridSize * STEP_X * 2;
  const nativeHeight = gridSize * STEP_Y * 2 + 280; // headroom for the tallest building (tower, 266px)
  const originX = nativeWidth / 2 - HALF_W;
  const originY = 70;

  const handlePointerDown = (col: number, row: number, hasBuilding: boolean) => {
    // Reset unconditionally, even on an empty cell: `longPressed` is one ref
    // shared across the whole grid, and the very next tap after a long-press
    // is often on a *different*, empty cell (completing a move) -- if a
    // manually-dispatched or gesture-swallowed pointer sequence never fires
    // a click on the long-pressed cell to consume the flag, it would
    // otherwise stay stuck true and eat that next tap.
    longPressed.current = false;
    if (!hasBuilding) return;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      onLongPressOccupied(col, row);
    }, LONG_PRESS_MS);
  };

  const clearPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const handleClick = (col: number, row: number, hasBuilding: boolean) => {
    if (longPressed.current) {
      longPressed.current = false;
      return; // the long-press already fired; don't also fire a click
    }
    if (hasBuilding && !selecting) onOccupiedTap(col, row);
    else onCellTap(col, row);
  };

  return (
    <div className="relative mx-auto overflow-hidden" style={{ width: nativeWidth * SCALE, height: nativeHeight * SCALE }}>
      <div
        className="absolute left-0 top-0 select-none"
        style={{ width: nativeWidth, height: nativeHeight, transform: `scale(${SCALE})`, transformOrigin: "top left" }}
      >
        {sorted.map(({ col, row }) => {
          const screenX = originX + (col - row) * STEP_X;
          const screenY = originY + (col + row) * STEP_Y;
          const building = placedByCell.get(`${col}-${row}`);
          const def = building ? BUILDING_BY_KEY[building.kind] : undefined;
          const isFullTile = def?.fullTile;
          const isLifted = movingFrom && movingFrom.col === col && movingFrom.row === row;

          return (
            <button
              key={`${col}-${row}`}
              type="button"
              onPointerDown={() => handlePointerDown(col, row, !!building)}
              onPointerUp={clearPress}
              onPointerLeave={clearPress}
              onClick={() => handleClick(col, row, !!building)}
              className="absolute"
              style={{
                left: screenX,
                top: screenY,
                width: GROUND_TILE.width,
                height: GROUND_TILE.height,
                zIndex: col + row,
                cursor: "pointer",
                opacity: isLifted ? 0.4 : 1,
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
