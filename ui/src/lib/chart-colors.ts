/**
 * Categorical colors for Needs/Wants/Savings, in fixed order (never cycled --
 * see the dataviz skill). The design system's success/warning tokens
 * (#7AC36F/#E3A048) fail the dataviz validator's normal-vision floor when
 * used as an adjacent categorical pair (ΔE 14.8, below the 15 floor) — these
 * are the skill's own validated dark-mode categorical slots 1/2/3 instead,
 * confirmed via `validate_palette.js --mode dark`.
 */
export const NEEDS_WANTS_SAVINGS_COLORS = {
  needs: "#3987e5", // categorical slot 1 (blue)
  wants: "#d95926", // categorical slot 2 (orange)
  savings: "#199e70", // categorical slot 3 (aqua)
} as const;

/**
 * Spending-by-category palette: the dataviz skill's full 8-slot dark
 * categorical order, validated via validate_palette.js --mode dark (all
 * checks pass: worst adjacent CVD ΔE 8.4, worst adjacent normal-vision ΔE
 * 19.3). "Other" is deliberately NOT the 8th hue slot -- it's a catch-all,
 * not a distinct identity, so it gets a neutral (text-tertiary) instead of
 * competing visually with the seven real categories.
 */
export const SPENDING_CATEGORY_COLORS = {
  Rent: "#3987e5", // slot 1 blue
  Groceries: "#d95926", // slot 2 orange
  "Dining Out": "#199e70", // slot 3 aqua
  Transportation: "#c98500", // slot 4 yellow
  Utilities: "#d55181", // slot 5 magenta
  Entertainment: "#008300", // slot 6 green
  Shopping: "#9085e9", // slot 7 violet
  Other: "#858394", // neutral -- not a validated categorical slot, intentionally
} as const;

export type SpendingCategory = keyof typeof SPENDING_CATEGORY_COLORS;
