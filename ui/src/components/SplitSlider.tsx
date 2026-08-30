import { NEEDS_WANTS_SAVINGS_COLORS } from "@/lib/chart-colors";

const HEIGHT = 320;
const THUMB_STEP = 1;

/**
 * A vertical needs/wants/savings bar you drag directly -- two cut points
 * split it into three colored segments, top to bottom: needs, wants,
 * savings. Vertical because a taller drag surface gives more precision on a
 * touch screen than a short horizontal bar, and it doubles as the visual
 * (no separate bar-plus-slider-below split into two things to keep in sync).
 *
 * Built from two overlaid native <input type="range"> elements rather than
 * custom pointer-drag code: real per-thumb touch dragging on iOS is
 * guaranteed for free this way, which a hand-rolled gesture handler is not
 * (see BuildableCity's long-press bug earlier tonight for exactly the class
 * of thing that's easy to get subtly wrong). Each input's track is
 * pointer-events:none (see .split-range in index.css) so only its thumb is
 * a hit target -- otherwise two full-length overlaid tracks would fight over
 * every touch.
 */
export function SplitSlider({
  needsPercent,
  wantsPercent,
  savingsPercent,
  onChange,
}: {
  needsPercent: number;
  wantsPercent: number;
  savingsPercent: number;
  onChange: (needs: number, wants: number, savings: number) => void;
}) {
  // Cut points as "distance from the top" percentages of the bar.
  const cutA = needsPercent; // needs/wants boundary
  const cutB = needsPercent + wantsPercent; // wants/savings boundary

  const setCutA = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), cutB);
    onChange(clamped, cutB - clamped, 100 - cutB);
  };
  const setCutB = (next: number) => {
    const clamped = Math.min(Math.max(next, cutA), 100);
    onChange(cutA, clamped - cutA, 100 - clamped);
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: 64, height: HEIGHT }}>
        <div className="absolute inset-0 flex flex-col overflow-hidden rounded-[28px]">
          <div style={{ height: `${needsPercent}%`, background: NEEDS_WANTS_SAVINGS_COLORS.needs }} />
          <div style={{ height: `${wantsPercent}%`, background: NEEDS_WANTS_SAVINGS_COLORS.wants }} />
          <div style={{ height: `${savingsPercent}%`, background: NEEDS_WANTS_SAVINGS_COLORS.savings }} />
        </div>

        {/* rotate(-90deg): a horizontal range's max (right) lands at the visual
            top, min (left) at the visual bottom -- so value = "% from the
            bottom". cutA/cutB above are "% from the top", hence 100-value. */}
        <input
          type="range"
          min={0}
          max={100}
          step={THUMB_STEP}
          value={100 - cutA}
          onChange={(e) => setCutA(100 - Number(e.target.value))}
          aria-label="Needs / wants boundary"
          className="split-range"
          style={{ width: HEIGHT, left: "50%", top: "50%", transform: "translate(-50%, -50%) rotate(-90deg)" }}
        />
        <input
          type="range"
          min={0}
          max={100}
          step={THUMB_STEP}
          value={100 - cutB}
          onChange={(e) => setCutB(100 - Number(e.target.value))}
          aria-label="Wants / savings boundary"
          className="split-range"
          style={{ width: HEIGHT, left: "50%", top: "50%", transform: "translate(-50%, -50%) rotate(-90deg)" }}
        />
      </div>

      <div className="flex flex-col justify-between py-1" style={{ height: HEIGHT }}>
        <div style={{ flexBasis: `${needsPercent}%` }} className="flex items-center">
          <p className="text-sm font-bold">
            Needs <span style={{ color: NEEDS_WANTS_SAVINGS_COLORS.needs }}>{needsPercent}%</span>
          </p>
        </div>
        <div style={{ flexBasis: `${wantsPercent}%` }} className="flex items-center">
          <p className="text-sm font-bold">
            Wants <span style={{ color: NEEDS_WANTS_SAVINGS_COLORS.wants }}>{wantsPercent}%</span>
          </p>
        </div>
        <div style={{ flexBasis: `${savingsPercent}%` }} className="flex items-center">
          <p className="text-sm font-bold">
            Savings <span style={{ color: NEEDS_WANTS_SAVINGS_COLORS.savings }}>{savingsPercent}%</span>
          </p>
        </div>
      </div>
    </div>
  );
}
