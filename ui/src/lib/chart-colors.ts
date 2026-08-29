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
