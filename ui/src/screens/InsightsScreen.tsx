import { Lock } from "lucide-react";
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ScreenHeader } from "@/components/ScreenHeader";
import { NEEDS_WANTS_SAVINGS_COLORS } from "@/lib/chart-colors";
import { computeSpendBreakdown, computeGoalSplit, computeTrend } from "@/lib/insights";

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
  const breakdown = computeSpendBreakdown();
  const goalSplit = computeGoalSplit();
  const trend = computeTrend();

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

        <LockedCard title="Spending trend" subtitle={`Last ${trend.length} periods`}>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={trend} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "var(--color-surface-elevated)", border: "none", borderRadius: 8, fontSize: 12 }}
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
                contentStyle={{ background: "var(--color-surface-elevated)", border: "none", borderRadius: 8, fontSize: 12 }}
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
    </div>
  );
}
