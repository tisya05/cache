import { useState } from "react";
import { ChevronRight, Lock, X } from "lucide-react";
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useAppState } from "@/state/AppStateContext";
import { ScreenHeader } from "@/components/ScreenHeader";
import { NEEDS_WANTS_SAVINGS_COLORS } from "@/lib/chart-colors";
import { computeSpendBreakdown, computeGoalSplit, computeTrend, computeSpendingByCategory, type CategorySlice } from "@/lib/insights";
import { formatDollarsFromCents, formatShortDate } from "@/lib/format";

const GROUP_LABELS: Record<"needs" | "wants" | "savings", string> = {
  needs: "Needs",
  wants: "Wants",
  savings: "Savings",
};

function LockedCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="flex items-center gap-1.5 font-bold">
          {title} <Lock size={12} className="text-text-tertiary" />
        </p>
        <Lock size={16} className="text-text-tertiary" />
      </div>
      {subtitle && <p className="mb-3 text-xs text-text-tertiary">{subtitle}</p>}
      {children}
    </div>
  );
}

export function InsightsScreen() {
  const { navigate } = useAppState();
  const breakdown = computeSpendBreakdown();
  const goalSplit = computeGoalSplit();
  const trend = computeTrend();
  const categorySlices = computeSpendingByCategory();
  const [selectedCategory, setSelectedCategory] = useState<CategorySlice | null>(null);

  const donutData = (["needs", "wants", "savings"] as const).map((k) => ({
    key: k,
    name: GROUP_LABELS[k],
    value: breakdown[k],
    color: NEEDS_WANTS_SAVINGS_COLORS[k],
  }));

  const barData = (["needs", "wants", "savings"] as const).map((k) => ({
    name: GROUP_LABELS[k],
    Actual: breakdown[k],
    Goal: goalSplit[k],
    color: NEEDS_WANTS_SAVINGS_COLORS[k],
  }));

  return (
    <div className="min-h-screen pb-32">
      <ScreenHeader title="Your insights" />
      <div className="px-5">
        <div className="mb-4 flex justify-center">
          <span className="flex items-center gap-1.5 rounded-full bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
            <Lock size={12} /> Private data
          </span>
        </div>

        <button
          type="button"
          onClick={() => navigate("transactionLog")}
          className="mb-4 flex w-full items-center justify-between rounded-2xl border border-border bg-surface p-4 text-left active:bg-surface-hover"
        >
          <span className="font-bold">View all transactions</span>
          <ChevronRight size={18} className="text-text-tertiary" />
        </button>

        <LockedCard title="Spending breakdown">
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={donutData} dataKey="value" innerRadius={36} outerRadius={56} paddingAngle={2} stroke="none">
                  {donutData.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {donutData.map((d) => (
                <div key={d.key} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="w-16 text-text-secondary">{d.name}</span>
                  <span className="font-bold">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </LockedCard>

        <LockedCard title="Spending by category" subtitle="Tap a category to see its transactions">
          {categorySlices.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-tertiary">No spending yet this month.</p>
          ) : (
            <>
              <div className="mb-3 flex justify-center">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie
                      data={categorySlices}
                      dataKey="amountCents"
                      nameKey="category"
                      innerRadius={42}
                      outerRadius={64}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {categorySlices.map((slice) => (
                        <Cell key={slice.category} fill={slice.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: "var(--color-text-primary)" }}
                      labelStyle={{ color: "var(--color-text-primary)" }}
                      formatter={(value: any, _name: any, item: any) => [formatDollarsFromCents(Number(value)), item.payload.category]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1">
                {categorySlices.map((slice) => (
                  <button
                    key={slice.category}
                    type="button"
                    onClick={() => setSelectedCategory(slice)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left active:bg-surface-hover"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
                    <span className="flex-1 text-sm text-text-secondary">{slice.category}</span>
                    <span className="text-sm font-bold text-text-primary">{formatDollarsFromCents(slice.amountCents)}</span>
                    <span className="w-10 text-right text-xs text-text-tertiary">{slice.percent}%</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </LockedCard>

        <LockedCard title="Spending trend" subtitle={`Last ${trend.length} periods`}>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={trend} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                itemStyle={{ color: "var(--color-text-primary)" }}
                labelStyle={{ color: "var(--color-text-primary)" }}
                formatter={(v: any) => [`$${(Number(v) / 100).toFixed(0)}`]}
              />
              <Line type="monotone" dataKey="spendCents" name="Spend" stroke={NEEDS_WANTS_SAVINGS_COLORS.wants} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="incomeCents" name="Income" stroke={NEEDS_WANTS_SAVINGS_COLORS.savings} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-1 flex justify-center gap-4 text-xs text-text-secondary">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: NEEDS_WANTS_SAVINGS_COLORS.wants }} /> Spend
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: NEEDS_WANTS_SAVINGS_COLORS.savings }} /> Income
            </span>
          </div>
        </LockedCard>

        <LockedCard title="Needs / Wants / Savings" subtitle="Actual vs. goal — today">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                itemStyle={{ color: "var(--color-text-primary)" }}
                labelStyle={{ color: "var(--color-text-primary)" }}
                formatter={(v: any) => [`${v}%`]}
              />
              <Bar dataKey="Actual" radius={[4, 4, 0, 0]}>
                {barData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Bar>
              <Bar dataKey="Goal" radius={[4, 4, 0, 0]} fill="var(--color-border)" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-1 flex justify-center gap-4 text-xs text-text-secondary">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-text-secondary" /> Actual
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full border border-border" /> Goal
            </span>
          </div>
        </LockedCard>
      </div>

      {selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setSelectedCategory(null)}>
          <div
            className="max-h-[75vh] w-full overflow-y-auto rounded-t-[28px] bg-surface-elevated p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <p className="flex items-center gap-2 text-lg font-bold">
                <span className="h-3 w-3 rounded-full" style={{ background: selectedCategory.color }} />
                {selectedCategory.category}
              </p>
              <button type="button" onClick={() => setSelectedCategory(null)} aria-label="Close">
                <X size={20} className="text-text-secondary" />
              </button>
            </div>
            <p className="mb-4 text-sm text-text-tertiary">
              {formatDollarsFromCents(selectedCategory.amountCents)} · {selectedCategory.percent}% of spending
            </p>
            <div className="space-y-2">
              {selectedCategory.events.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-[14px] border border-border-subtle bg-surface-subtle px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {e.merchant}
                      {e.counterparty && <span className="font-normal text-text-tertiary"> · {e.counterparty}</span>}
                    </p>
                    <p className="text-xs text-text-tertiary">{formatShortDate(e.timestamp)}</p>
                  </div>
                  <p className="text-sm font-bold">{formatDollarsFromCents(e.amountCents)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
