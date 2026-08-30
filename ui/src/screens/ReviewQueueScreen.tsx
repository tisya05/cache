import { useEffect, useMemo, useState } from "react";
import { Search, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useMotionValue, useTransform, animate, type MotionValue, type PanInfo } from "motion/react";
import { useAppState } from "@/state/AppStateContext";
import { PrimaryButton } from "@/components/PrimaryButton";
import { loadTransactionEvents, loadNeedsReviewIds, hasGenuineMemo, type TransactionEvent } from "@/lib/transactions";
import { loadReviewedIds, markReviewed, setCategoryOverride } from "@/lib/app-storage";
import { formatDollarsFromCents, formatShortDate } from "@/lib/format";
import { allCategories, categoryLabel, addCustomCategory, slugifyCategoryName, type CategoryGroup } from "@/lib/categories";

const SWIPE_DISTANCE_THRESHOLD = 120;
const SWIPE_VELOCITY_THRESHOLD = 500;

/**
 * The actual Tinder-style drag -- two buttons were the only way to resolve a
 * card before this. `x` is owned by the parent (not created here) so the
 * screen-edge glow can track the same live drag value the card does; the
 * parent resets it to 0 whenever the current transaction changes, since this
 * component is no longer the thing getting freshly mounted per card.
 */
function SwipeableCard({
  event,
  categoryGuess,
  x,
  onSwipeRight,
  onSwipeLeft,
}: {
  event: TransactionEvent;
  categoryGuess: string;
  x: MotionValue<number>;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
}) {
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const correctOpacity = useTransform(x, [20, 100], [0, 1]);
  const wrongOpacity = useTransform(x, [-100, -20], [1, 0]);

  const handleDragEnd = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const passedThreshold =
      Math.abs(info.offset.x) > SWIPE_DISTANCE_THRESHOLD || Math.abs(info.velocity.x) > SWIPE_VELOCITY_THRESHOLD;
    if (!passedThreshold) {
      animate(x, 0, { type: "spring", stiffness: 500, damping: 32 });
      return;
    }
    const direction = info.offset.x > 0 ? 1 : -1;
    animate(x, direction * 500, { duration: 0.2, ease: "easeIn" }).then(() => {
      if (direction > 0) onSwipeRight();
      else onSwipeLeft();
    });
  };

  return (
    <motion.div
      style={{ x, rotate }}
      drag="x"
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: "grabbing" }}
      className="relative mt-6 cursor-grab touch-pan-y rounded-2xl bg-surface-subtle p-6"
    >
      <motion.div
        style={{ opacity: correctOpacity }}
        className="pointer-events-none absolute right-4 top-4 rotate-6 rounded-lg border-2 border-success px-3 py-1 text-sm font-extrabold text-success"
      >
        CORRECT
      </motion.div>
      <motion.div
        style={{ opacity: wrongOpacity }}
        className="pointer-events-none absolute left-4 top-4 -rotate-6 rounded-lg border-2 border-error px-3 py-1 text-sm font-extrabold text-error"
      >
        WRONG
      </motion.div>

      <p className="text-lg">{event.merchant}</p>
      {event.counterparty && (
        <p className="mt-0.5 text-sm text-text-secondary">
          {event.type === "spend" ? "to" : "from"} {event.counterparty}
        </p>
      )}
      {hasGenuineMemo(event) && <p className="mt-1 text-sm italic text-text-secondary">&ldquo;{event.memo}&rdquo;</p>}
      <p className="mt-2 text-2xl font-extrabold">
        {event.type === "spend" ? "-" : "+"}
        {formatDollarsFromCents(event.amountCents)}
      </p>
      <p className="text-sm text-text-tertiary">{formatShortDate(event.timestamp)}</p>

      <div className="mt-6 border-t border-border-subtle pt-4">
        <p className="text-sm text-text-tertiary">AI guessed category</p>
        <p className="text-xl font-bold">{categoryGuess}</p>
        <span className="mt-2 inline-block rounded-full bg-surface-elevated px-3 py-1 text-xs text-text-secondary">
          {Math.round(event.confidence * 100)}% confidence
        </span>
      </div>
    </motion.div>
  );
}

export function ReviewQueueScreen() {
  const { navigate } = useAppState();
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => loadReviewedIds());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryGroup, setNewCategoryGroup] = useState<CategoryGroup | null>(null);
  // Owned here (not inside SwipeableCard) so the full-screen edge glow can
  // track the exact same live value as the card's own position -- a motion
  // value, not React state, so this updates every drag frame without a
  // re-render. Reset to 0 whenever the card changes (see the effect below);
  // SwipeableCard itself is no longer remounted per card.
  const x = useMotionValue(0);
  const rightGlow = useTransform(x, [20, 150], [0, 0.5]);
  const leftGlow = useTransform(x, [-150, -20], [0.5, 0]);

  const queue = useMemo(() => {
    const needsReview = loadNeedsReviewIds();
    return loadTransactionEvents().filter((e) => needsReview.has(e.id) && !reviewedIds.has(e.id));
  }, [reviewedIds]);

  const current = queue[0];
  // Merchant is always the identity line; a P2P counterparty name (when
  // present) is appended rather than replacing it, since "Zelle" alone
  // isn't as useful as "Zelle · Sean Braggs".
  const currentLabel = current
    ? current.counterparty
      ? `${current.merchant} · ${current.counterparty}`
      : current.merchant
    : "";
  const total = loadNeedsReviewIds().size;
  const position = total - queue.length + 1;

  useEffect(() => {
    x.set(0);
  }, [current?.id, x]);

  const handleResolved = (id: string, category?: string) => {
    if (category) setCategoryOverride(id, category);
    markReviewed(id);
    setReviewedIds(new Set([...reviewedIds, id]));
    setPickerOpen(false);
    setCreating(false);
    setNewCategoryName("");
    setNewCategoryGroup(null);
  };

  const handleCreateCategory = () => {
    const label = newCategoryName.trim();
    if (!label || !newCategoryGroup || !current) return;
    const key = slugifyCategoryName(label) || `custom_${Date.now()}`;
    if (!allCategories().some((c) => c.key === key)) {
      addCustomCategory({ key, label, emoji: "✨", group: newCategoryGroup });
    }
    handleResolved(current.id, key);
  };

  if (!current) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <button type="button" onClick={() => navigate("city")} className="absolute left-4 top-4">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-2xl font-extrabold">All caught up!</h1>
        <div className="relative flex h-32 w-32 items-center justify-center">
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ backgroundColor: "var(--color-accent)", opacity: 0.18, filter: "blur(16px)" }}
          />
          <div className="relative text-7xl">🌙</div>
        </div>
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
    const filtered = allCategories().filter((c) => c.label.toLowerCase().includes(search.toLowerCase()));
    return (
      <div className="min-h-screen px-6 pt-8 pb-28">
        <h1 className="text-center text-xl font-extrabold">What is this?</h1>
        <p className="mt-4 text-center text-lg">{currentLabel}</p>
        <p className="text-center text-sm text-text-tertiary">
          {formatDollarsFromCents(current.amountCents)} · {formatShortDate(current.timestamp)}
        </p>

        {creating ? (
          <div className="mt-6 space-y-4">
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              className="w-full rounded-[14px] border border-border bg-surface-subtle px-4 py-3 text-sm outline-none placeholder:text-text-tertiary"
              autoFocus
            />
            <div>
              <p className="mb-2 text-xs font-semibold text-text-tertiary">This is a...</p>
              <div className="flex gap-2">
                {(["needs", "wants", "savings"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setNewCategoryGroup(g)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold capitalize ${
                      newCategoryGroup === g
                        ? "border-accent bg-accent-muted/30 text-accent-light"
                        : "border-border-subtle text-text-secondary"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
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
            </div>
          </>
        )}

        <div className="fixed inset-x-0 bottom-0 px-6 pb-8">
          {creating ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setNewCategoryName("");
                  setNewCategoryGroup(null);
                }}
                className="flex-1 rounded-2xl border border-border-subtle py-3 text-center font-semibold text-text-secondary"
              >
                Cancel
              </button>
              <PrimaryButton
                className="flex-1"
                disabled={!newCategoryName.trim() || !newCategoryGroup}
                onClick={handleCreateCategory}
              >
                Create &amp; assign
              </PrimaryButton>
            </div>
          ) : (
            <PrimaryButton className="flex items-center justify-center gap-2" onClick={() => setCreating(true)}>
              <Plus size={18} /> Create new category
            </PrimaryButton>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col px-6 pt-8">
      {/* Full-screen edge glow, tracking the same live drag value as the
          card -- whichever edge the swipe is heading toward lights up in
          that direction's color, growing with drag distance. */}
      <motion.div
        className="pointer-events-none fixed inset-y-0 right-0 z-40 w-40"
        style={{ opacity: rightGlow, background: "linear-gradient(to left, var(--color-success), transparent)" }}
      />
      <motion.div
        className="pointer-events-none fixed inset-y-0 left-0 z-40 w-40"
        style={{ opacity: leftGlow, background: "linear-gradient(to right, var(--color-error), transparent)" }}
      />

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

      <div className="flex flex-1 flex-col justify-center">
        <SwipeableCard
          event={current}
          categoryGuess={categoryLabel(current.category)}
          x={x}
          onSwipeRight={() => handleResolved(current.id)}
          onSwipeLeft={() => setPickerOpen(true)}
        />

        <p className="mt-4 text-center text-xs text-text-tertiary">Drag the card left or right</p>

        <div className="mt-3 flex items-center justify-between px-4">
          <span className="flex items-center gap-1 text-sm font-semibold text-error">
            <ChevronLeft size={20} /> Wrong
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold text-success">
            Correct <ChevronRight size={20} />
          </span>
        </div>
      </div>
    </div>
  );
}
