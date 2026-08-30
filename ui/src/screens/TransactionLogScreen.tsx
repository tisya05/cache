import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useAppState } from "@/state/AppStateContext";
import { ScreenHeader } from "@/components/ScreenHeader";
import { loadTransactionEvents, hasGenuineMemo, type TransactionEvent } from "@/lib/transactions";
import { loadCategoryOverrides, setCategoryOverride } from "@/lib/app-storage";
import { allCategories } from "@/lib/categories";
import { toDisplayCategory } from "@/lib/insights";
import { formatDollarsFromCents, formatShortDate } from "@/lib/format";

/** The picker only offers a finite set of keys (built-in + user-created --
 *  see categories.ts); a raw pipeline tag that isn't one of them (e.g.
 *  "coffee", "uncategorized") falls back to its Insights display bucket
 *  rather than showing the raw internal tag verbatim. */
function displayCategory(key: string): string {
  const known = allCategories().find((c) => c.key === key);
  return known ? known.label : toDisplayCategory(key);
}

/**
 * The safety net the review queue can't be: a high-confidence transaction
 * never surfaces there, so this is the only place to correct the pipeline
 * when it was confident but wrong. Every transaction is editable here, not
 * just the ones that needed review.
 */
export function TransactionLogScreen() {
  const { navigate } = useAppState();
  const [overrides, setOverrides] = useState<Record<string, string>>(() => loadCategoryOverrides());
  const [editing, setEditing] = useState<TransactionEvent | null>(null);
  const [search, setSearch] = useState("");

  const events = useMemo(
    () => [...loadTransactionEvents()].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [],
  );

  const effectiveCategory = (e: TransactionEvent) => overrides[e.id] ?? e.category;

  const handlePick = (categoryKey: string) => {
    if (!editing) return;
    setCategoryOverride(editing.id, categoryKey);
    setOverrides((prev) => ({ ...prev, [editing.id]: categoryKey }));
    setEditing(null);
  };

  if (editing) {
    const filtered = allCategories().filter((c) => c.label.toLowerCase().includes(search.toLowerCase()));
    return (
      <div className="min-h-screen px-6 pt-8">
        <h1 className="text-center text-xl font-extrabold">What is this?</h1>
        <p className="mt-4 text-center text-lg">
          {editing.merchant}
          {editing.counterparty ? ` · ${editing.counterparty}` : ""}
        </p>
        <p className="text-center text-sm text-text-tertiary">
          {formatDollarsFromCents(editing.amountCents)} · {formatShortDate(editing.timestamp)}
        </p>

        <div className="mt-5 flex items-center gap-2 rounded-[14px] border border-border bg-surface-subtle px-4 py-3">
          <Search size={16} className="text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories"
            className="w-full bg-transparent text-sm outline-none placeholder:text-text-tertiary"
            autoFocus
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {filtered.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => handlePick(c.key)}
              className="rounded-full border border-border-subtle px-4 py-2 text-sm font-medium"
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        <div className="fixed inset-x-0 bottom-0 px-6 pb-8">
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="w-full rounded-2xl border border-border-subtle py-3 text-center font-semibold text-text-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <ScreenHeader title="Transaction log" onBack={() => navigate("insights")} />
      <div className="px-5">
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-tertiary">No transactions yet.</p>
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEditing(e)}
                className="flex w-full items-center justify-between rounded-[14px] border border-border-subtle bg-surface-subtle px-4 py-3 text-left active:bg-surface-hover"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {e.merchant}
                    {e.counterparty && <span className="font-normal text-text-tertiary"> · {e.counterparty}</span>}
                  </p>
                  {hasGenuineMemo(e) && <p className="truncate text-xs italic text-text-tertiary">&ldquo;{e.memo}&rdquo;</p>}
                  <p className="text-xs text-text-tertiary">{formatShortDate(e.timestamp)}</p>
                </div>
                <div className="ml-3 flex shrink-0 flex-col items-end gap-1">
                  <p className="text-sm font-bold">
                    {e.type === "spend" ? "-" : "+"}
                    {formatDollarsFromCents(e.amountCents)}
                  </p>
                  <span className="rounded-full bg-surface-elevated px-2.5 py-0.5 text-xs text-text-secondary">
                    {displayCategory(effectiveCategory(e))}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
