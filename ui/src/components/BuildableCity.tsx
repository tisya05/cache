/**
 * The interactive isometric city grid. Night-lit transparent PNG sprites cut
 * from a single sheet (ui/public/tiles/sprites/) -- no tinting needed, unlike
 * the earlier Kenney-tile attempt (kept in IsometricCity.tsx as a fallback).
 *
 * The ground is one flat, grainy platform shape, not N separately-rendered
 * copies of ground-tile.png. Tiling that PNG per cell looked like a grid of
 * separate pavers (it has its own vignette baked into every copy's edge --
 * more overlap between cells couldn't fix that, since the darkening is part
 * of the art, not a spacing gap), and stretching one copy over the whole
 * platform just traded that for a blurry, pixelated mess. A flat fill plus
 * an SVG grain filter gives one continuous, un-tiled surface at any size,
 * with a solid dark platform edge (with thickness) only at the true outer
 * boundary -- no internal seams at all, matching a single physical slab.
 *
 * Placement step is 137x83, not the ground tile's true half-size (141x86) --
 * kept from the per-cell era for the interactive hit-grid and building
 * anchor math, which are unaffected by how the ground is painted.
 *
 * Interactions (idle mode, i.e. nothing picked up from the shop):
 *   - tap an empty cell: no-op
 *   - tap an occupied cell: ask the parent for an upgrade prompt
 *   - long-press an occupied cell: pick it up for a free move-or-remove
 */
import { useRef } from "react";
import { BUILDING_CATALOG, GROUND_TILE, type BuildingKey, type PlacedBuilding } from "@/lib/city-grid";

const diamondClipPath = (w: number, h: number) => `polygon(${w / 2}px 0px, ${w}px ${h / 2}px, ${w / 2}px ${h}px, 0px ${h / 2}px)`;
// Thickness of the platform's own edge (the dark "underside" band), visible
// only on the two true outer-boundary faces, not at every internal seam.
const EDGE_THICKNESS = 26;

const STEP_X = 137;
const STEP_Y = 83;
// Target rendered width in CSS px, independent of grid size -- a fixed SCALE
// made the grid wider than the phone viewport as soon as gridSize grew (4x4
// at the old SCALE=0.5 was 548px wide, well past a 375px screen).
const TARGET_WIDTH = 340;
const LONG_PRESS_MS = 450;
// A building's rendered width is capped below this so it can't visually
// bleed into a neighboring tile. Cells are spaced STEP_X=137 apart (not the
// tile's own half-width, 141 -- see the seam-hiding note above), so a sprite
// scaled wide enough to approach 2*STEP_X starts to visually straddle the
// tile two cells over. 230px leaves clear margin under that.
const MAX_RENDER_WIDTH = 230;
const effectiveScale = (width: number, renderScale: number) => Math.min(renderScale, MAX_RENDER_WIDTH / width);
// Headroom above the topmost tile for the tallest building once clamped and
// scaled -- computed instead of hardcoded so it stays correct if renderScale
// or sprite art changes. Needed because buildings are now anchored to the
// BOTTOM of their tile's diamond (see the anchor comment below), so a tall
// building extends upward by its full rendered height from there, not half.
const TALLEST_SCALED_HEIGHT = Math.max(
  ...BUILDING_CATALOG.map((b) => b.height * effectiveScale(b.width, b.renderScale)),
);
const TOP_MARGIN = 20;
const BOTTOM_MARGIN = 20;

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
  // originY needs enough clearance above the topmost tile for the tallest
  // building to extend upward from its bottom anchor without clipping;
  // nativeHeight then needs to reach past the bottommost tile's own bottom
  // edge (buildings never extend below that, only above it).
  const originY = Math.max(TOP_MARGIN, TALLEST_SCALED_HEIGHT - GROUND_TILE.height + TOP_MARGIN);
  const nativeHeight = originY + (2 * gridSize - 2) * STEP_Y + GROUND_TILE.height + BOTTOM_MARGIN;
  const SCALE = TARGET_WIDTH / nativeWidth;
  const originX = nativeWidth / 2 - GROUND_TILE.width / 2;

  // The whole platform's own 4 outer corners -- same lattice as individual
  // cells, just evaluated at the grid's actual boundary instead of per-tile.
  const halfW = GROUND_TILE.width / 2;
  const halfH = GROUND_TILE.height / 2;
  const platformTop = { x: originX + halfW, y: originY };
  const platformRight = { x: originX + (gridSize - 1) * STEP_X + GROUND_TILE.width, y: originY + (gridSize - 1) * STEP_Y + halfH };
  const platformBottom = { x: originX + halfW, y: originY + (2 * gridSize - 2) * STEP_Y + GROUND_TILE.height };
  const platformLeft = { x: originX - (gridSize - 1) * STEP_X, y: originY + (gridSize - 1) * STEP_Y + halfH };
  // The two front-facing side quads that give the platform edge thickness --
  // only the bottom-left and bottom-right faces are ever visible looking
  // down at an isometric slab; the back two faces never are.
  const leftFaceClip = `polygon(${platformLeft.x}px ${platformLeft.y}px, ${platformBottom.x}px ${platformBottom.y}px, ${platformBottom.x}px ${platformBottom.y + EDGE_THICKNESS}px, ${platformLeft.x}px ${platformLeft.y + EDGE_THICKNESS}px)`;
  const rightFaceClip = `polygon(${platformBottom.x}px ${platformBottom.y}px, ${platformRight.x}px ${platformRight.y}px, ${platformRight.x}px ${platformRight.y + EDGE_THICKNESS}px, ${platformBottom.x}px ${platformBottom.y + EDGE_THICKNESS}px)`;

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
        {/* The platform: one flat, grainy fill (SVG turbulence noise over a
            soft gradient) instead of any tiled/repeated/stretched image --
            no source asset to seam or blur no matter the platform's size --
            plus a solid dark edge band on the two faces of the slab that are
            ever actually visible from this angle. */}
        <svg className="pointer-events-none absolute inset-0" width={nativeWidth} height={nativeHeight}>
          <defs>
            <radialGradient id="groundGradient" cx="50%" cy="42%" r="75%">
              <stop offset="0%" stopColor="#363b52" />
              <stop offset="100%" stopColor="#23273a" />
            </radialGradient>
            <filter id="groundGrain" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" stitchTiles="stitch" result="noise" />
              <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0" result="grain" />
              <feComposite in="grain" in2="SourceGraphic" operator="over" />
            </filter>
          </defs>
          <polygon
            points={`${platformTop.x},${platformTop.y} ${platformRight.x},${platformRight.y} ${platformBottom.x},${platformBottom.y} ${platformLeft.x},${platformLeft.y}`}
            fill="url(#groundGradient)"
            filter="url(#groundGrain)"
          />
        </svg>
        <div className="absolute inset-0" style={{ clipPath: leftFaceClip, backgroundColor: "var(--color-bg-deep)" }} />
        <div className="absolute inset-0" style={{ clipPath: rightFaceClip, backgroundColor: "var(--color-bg-deep)" }} />

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
              {selecting && !building && (
                // Highlights the diamond itself, not an axis-aligned box -- a
                // rectangle over an isometric diamond made it impossible to tell
                // which tile was actually selected.
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ backgroundColor: "var(--color-accent)", opacity: 0.4, clipPath: diamondClipPath(GROUND_TILE.width, GROUND_TILE.height) }}
                />
              )}
              {def &&
                (() => {
                  // fullTile pieces (park) replace the ground tile outright, so the
                  // straddle-prevention clamp doesn't apply -- filling the tile IS
                  // the intent, not something to guard against.
                  const scale = isFullTile ? def.renderScale : effectiveScale(def.width, def.renderScale);
                  // park.png (267x166) is a hair smaller than the ground tile's own
                  // footprint (282x172) and, unlike regular ground tiles, isn't
                  // rendered with their step-based overlap trick -- centering it at
                  // native size left a thin gap around every edge, reading as a
                  // separate patch dropped onto the grid instead of flush with it.
                  // Stretching it to the tile's exact footprint removes that gap;
                  // the aspect ratio is close enough (1.61 vs 1.64) not to show.
                  const renderWidth = isFullTile ? GROUND_TILE.width : def.width * scale;
                  const renderHeight = isFullTile ? GROUND_TILE.height : def.height * scale;
                  return (
                    <img
                      src={def.sprite}
                      width={renderWidth}
                      height={isFullTile ? renderHeight : undefined}
                      alt={def.label}
                      draggable={false}
                      className="pointer-events-none absolute"
                      style={
                        isFullTile
                          ? // A full-tile piece (park) replaces the ground tile outright rather
                            // than standing on it. A slight desaturate/darken brings its bright
                            // grass palette closer to the cool, dim night grade of every other
                            // sprite -- otherwise it reads as a different layer, not the same
                            // scene.
                            { left: 0, top: 0, filter: "saturate(0.7) brightness(0.85)" }
                          : // Anchored to the centre-bottom of the diamond -- the tile's own
                            // front vertex, at its full height, not the vertical midpoint -- so
                            // a building's base sits on the ground and it extends upward/back
                            // over tiles behind it, same as any isometric city-builder.
                            { left: GROUND_TILE.width / 2 - renderWidth / 2, top: GROUND_TILE.height - renderHeight }
                      }
                    />
                  );
                })()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
