import { useMemo, useState } from "react";
import { Search, Plus, X, ChevronLeft } from "lucide-react";
import { useAppState } from "@/state/AppStateContext";
import { PrimaryButton } from "@/components/PrimaryButton";
import { loadTransactionEvents, loadNeedsReviewIds } from "@/lib/transactions";
import { loadReviewedIds, markReviewed, setCategoryOverride } from "@/lib/app-storage";
import { formatDollarsFromCents, formatShortDate } from "@/lib/format";

const CATEGORIES = [
  { key: "dining_out", label: "Dining Out", emoji: "🍽️" },
  { key: "groceries", label: "Groceries", emoji: "🛒" },
  { key: "rent", label: "Rent", emoji: "🏠" },
  { key: "transportation", label: "Transportation", emoji: "🚗" },
  { key: "entertainment", label: "Entertainment", emoji: "🎬" },
  { key: "shopping", label: "Shopping", emoji: "🛍️" },
  { key: "utilities", label: "Utilities", emoji: "💡" },
  { key: "income", label: "Income", emoji: "💰" },
];

export function ReviewQueueScreen() {
  const { navigate } = useAppState();
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => loadReviewedIds());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  const queue = useMemo(() => {
    const needsReview = loadNeedsReviewIds();
    return loadTransactionEvents().filter((e) => needsReview.has(e.id) && !reviewedIds.has(e.id));
  }, [reviewedIds]);

  const current = queue[0];
  // Some real transactions (e.g. a memo-less Zelle payment) genuinely have no
  // memo text -- fall back to the merchant name rather than showing blank
  // space, which read as broken rather than as honest empty data.
  const currentLabel = current?.memo || current?.merchant || "";
  const total = loadNeedsReviewIds().size;
  const position = total - queue.length + 1;

  const handleResolved = (id: string, category?: string) => {
    if (category) setCategoryOverride(id, category);
    markReviewed(id);
    setReviewedIds(new Set([...reviewedIds, id]));
    setPickerOpen(false);
  };

  if (!current) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <button type="button" onClick={() => navigate("city")} className="absolute left-4 top-4">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-2xl font-extrabold">All caught up!</h1>
        <div className="text-8xl">🦝</div>
        <div>
          <p className="text-xl font-bold">All caught up!</p>
          <p className="text-sm text-text-tertiary">No more transactions to review.</p>
        </div>
        <div className="w-full pt-4">
          <PrimaryButton onClick={() => navigate("insights")}>See insights</PrimaryButton>
        </div>
      </div>
    );
  }

  if (pickerOpen) {
    const filtered = CATEGORIES.filter((c) => c.label.toLowerCase().includes(search.toLowerCase()));
    return (
      <div className="min-h-screen px-6 pt-8">
        <h1 className="text-center text-xl font-extrabold">What is this?</h1>
        <p className="mt-4 text-center text-lg">{currentLabel}</p>
        <p className="text-center text-sm text-text-tertiary">
          {formatDollarsFromCents(current.amountCents)} · {formatShortDate(current.timestamp)}
        </p>

        <div className="mt-5 flex items-center gap-2 rounded-[14px] border border-border bg-surface-subtle px-4 py-3">
          <Search size={16} className="text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories"
            className="w-full bg-transparent text-sm outline-none placeholder:text-text-tertiary"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {filtered.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => handleResolved(current.id, c.key)}
              className="rounded-full border border-border-subtle px-4 py-2 text-sm font-medium"
            >
              {c.emoji} {c.label}
            </button>
          ))}
          <button type="button" className="rounded-full border border-border-subtle px-4 py-2 text-sm font-medium">
            ⋯ Other
          </button>
        </div>

        <div className="fixed inset-x-0 bottom-0 px-6 pb-8">
          <PrimaryButton className="flex items-center justify-center gap-2">
            <Plus size={18} /> Create new category
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 pt-8">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate("city")}>
          <ChevronLeft size={22} />
        </button>
        <p className="font-semibold text-text-secondary">
          {position} of {total}
        </p>
        <button type="button" onClick={() => navigate("city")}>
          <X size={22} />
        </button>
      </div>

      <div className="mt-6 rounded-2xl bg-surface-subtle p-6">
        <p className="text-lg">{currentLabel}</p>
        <p className="mt-2 text-2xl font-extrabold">
          {current.type === "spend" ? "-" : "+"}
          {formatDollarsFromCents(current.amountCents)}
        </p>
        <p className="text-sm text-text-tertiary">{formatShortDate(current.timestamp)}</p>

        <div className="mt-6 border-t border-border-subtle pt-4">
          <p className="text-sm text-text-tertiary">AI guessed category</p>
          <p className="text-xl font-bold">
            {CATEGORIES.find((c) => c.key === current.category)?.label ?? current.category}
          </p>
          <span className="mt-2 inline-block rounded-full bg-surface-elevated px-3 py-1 text-xs text-text-secondary">
            {Math.round(current.confidence * 100)}% confidence
          </span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex flex-col items-center gap-2 rounded-2xl bg-error py-6 font-bold text-text-on-accent"
        >
          <X size={24} /> Wrong
        </button>
        <button
          type="button"
          onClick={() => handleResolved(current.id)}
          className="flex flex-col items-center gap-2 rounded-2xl bg-success py-6 font-bold text-text-on-accent"
        >
          ✓ Correct
        </button>
      </div>
    </div>
  );
}
