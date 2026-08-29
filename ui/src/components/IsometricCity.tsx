/**
 * Pre-rendered isometric city: a grid of ground plots with buildings placed
 * on some of them, using Kenney's CC0 "Isometric Tiles City"/"Isometric Tiles
 * Buildings" sprites (ui/public/tiles/) — not procedural, not an isometric
 * npm package (all abandoned, 8+ years old, fight React 19's strict mode).
 *
 * Projection: screenX = (col - row) * (tileW / 2), screenY = (col + row) *
 * (tileH / 2), painter's-algorithm z-order by (col + row). Ground tiles are
 * 132x101ish PNGs whose true diamond footprint is 132x66; buildings are
 * taller PNGs (only the full-width 132px ones are used — Kenney's building
 * pack also ships narrower 99px "stub" sprites meant for a different, denser
 * grid unit, which look like disconnected debris on our 132px plots) anchored
 * to the same footprint and drawn growing upward.
 *
 * The whole grid renders at native tile size then scales down via CSS
 * transform to fit a phone screen — scaling the DOM layout directly would
 * make the diamond-projection math fight the container's own width.
 */

const TILE_W = 132;
const TILE_H = 66;
const GROUND_IMG_H = 101;
const GRID_SIZE = 4;
const SCALE = 0.62;

const GROUND_TILES = ["/tiles/ground/plot-a.png", "/tiles/ground/plot-b.png", "/tiles/ground/plot-c.png"];
const PARK_TILE = "/tiles/ground/park.png";

// Only the full-width (132px), tall building sprites -- these are the ones
// that actually match the ground tile's footprint. See file header.
const BUILDING_TILES = [
  { src: "/tiles/buildings/b-010.png", height: 127 },
  { src: "/tiles/buildings/b-020.png", height: 127 },
  { src: "/tiles/buildings/b-030.png", height: 127 },
  { src: "/tiles/buildings/b-040.png", height: 130 },
  { src: "/tiles/buildings/b-100.png", height: 127 },
];

// Deterministic PRNG (mulberry32) so a given block count always renders the
// same city layout, rather than reshuffling on every render.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function IsometricCity({ blocksPlaced }: { blocksPlaced: number }) {
  const rand = mulberry32(1337);
  const cells: { col: number; row: number; ground: string; building: (typeof BUILDING_TILES)[number] | null }[] = [];

  let buildingBudget = Math.max(4, blocksPlaced);
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const isCorner = (row === 0 || row === GRID_SIZE - 1) && (col === 0 || col === GRID_SIZE - 1);
      const wantsPark = !isCorner && rand() < 0.1;
      const ground = wantsPark ? PARK_TILE : GROUND_TILES[Math.floor(rand() * GROUND_TILES.length)]!;
      let building: (typeof BUILDING_TILES)[number] | null = null;
      if (!wantsPark && buildingBudget > 0 && rand() < 0.8) {
        building = BUILDING_TILES[Math.floor(rand() * BUILDING_TILES.length)]!;
        buildingBudget--;
      }
      cells.push({ col, row, ground, building });
    }
  }

  const nativeWidth = GRID_SIZE * TILE_W;
  // Extra top margin so a tall building on the top row (which draws upward
  // from its ground tile) doesn't clip against the container's top edge.
  const topMargin = 150;
  const nativeHeight = GRID_SIZE * TILE_H + topMargin + 40;
  const originX = nativeWidth / 2;
  const originY = topMargin;

  const sorted = [...cells].sort((a, b) => a.col + a.row - (b.col + b.row));

  return (
    <div
      className="relative mx-auto overflow-hidden"
      style={{ width: nativeWidth * SCALE, height: nativeHeight * SCALE }}
      role="img"
      aria-label="Your isometric city, built from earned blocks"
    >
      <div
        className="absolute left-0 top-0 select-none"
        style={{
          width: nativeWidth,
          height: nativeHeight,
          transform: `scale(${SCALE})`,
          transformOrigin: "top left",
          // Uniform darken/desaturate on the whole scene -- applying this per
          // tile instead (as a first attempt) produced inconsistent results
          // and a hue-rotate here washed everything to flat gray-lavender.
          filter: "brightness(0.55) saturate(0.75)",
        }}
      >
        {sorted.map(({ col, row, ground, building }) => {
          const screenX = originX + ((col - row) * TILE_W) / 2 - TILE_W / 2;
          const screenY = originY + ((col + row) * TILE_H) / 2;
          return (
            <div key={`${col}-${row}`} className="absolute" style={{ left: screenX, top: screenY, zIndex: col + row }}>
              <img src={ground} width={TILE_W} alt="" style={{ display: "block" }} />
              {building && (
                <img
                  src={building.src}
                  width={TILE_W}
                  alt=""
                  style={{
                    position: "absolute",
                    left: 0,
                    bottom: GROUND_IMG_H - TILE_H / 2 - 4,
                    filter: "drop-shadow(0 0 10px rgba(252,198,131,0.4))",
                    display: "block",
                  }}
                />
              )}
            </div>
          );
        })}
        {/* Blue night cast, layered ABOVE every tile (z-index above the
           highest tile z-index, which tops out around 2*GRID_SIZE) -- an
           earlier version put this at the default z-index (0), so most
           tiles painted over it and the tint had no visible effect. */}
        <div
          className="pointer-events-none absolute inset-0 mix-blend-multiply"
          style={{ background: "var(--color-bg-deep)", opacity: 0.35, zIndex: 999 }}
        />
      </div>
    </div>
  );
}
