export const formatDollarsFromCents = (cents: number): string =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const formatMonthLabel = (date: Date = new Date()): string =>
  date.toLocaleDateString("en-US", { month: "long" });

export const daysLeftInMonth = (date: Date = new Date()): number => {
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return Math.max(0, end.getUTCDate() - date.getUTCDate());
};

export const formatShortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
