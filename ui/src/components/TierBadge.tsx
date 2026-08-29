const TIER_COLOR: Record<number, string> = {
  0: "var(--color-tier-0)",
  1: "var(--color-tier-1)",
  2: "var(--color-tier-2)",
  3: "var(--color-tier-3)",
  4: "var(--color-tier-4)",
};

export function TierBadge({ tier, size = "md" }: { tier: number; size?: "sm" | "md" | "lg" }) {
  const color = TIER_COLOR[tier] ?? TIER_COLOR[0];
  const dims = size === "lg" ? "h-24 w-24 text-4xl" : size === "sm" ? "h-8 w-8 text-xs" : "h-14 w-14 text-xl";
  return (
    <div
      className={`flex ${dims} items-center justify-center rounded-full font-extrabold`}
      style={{
        color,
        border: `2px solid ${color}`,
        boxShadow: `0 0 16px 0 color-mix(in srgb, ${color} 35%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, var(--color-surface))`,
      }}
    >
      {tier}
    </div>
  );
}

export function TierPill({ tier }: { tier: number }) {
  const color = TIER_COLOR[tier] ?? TIER_COLOR[0];
  return (
    <span
      className="rounded-full px-2.5 py-1 text-xs font-bold"
      style={{ color, background: `color-mix(in srgb, ${color} 18%, transparent)` }}
    >
      Tier {tier}
    </span>
  );
}
