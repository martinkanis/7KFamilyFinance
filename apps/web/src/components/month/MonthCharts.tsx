import type { MonthSummary } from "@kkff/api/contracts";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { percentLabel } from "@/components/ui/breakdown";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { CategorySegment } from "@/lib/monthBreakdown";

interface Slice {
  key: string;
  label: string;
  color: string;
  value: number;
}

/** Zbytek příjmů po výdajích – neutrální šedá, aby se nepletl s kategorií. */
const LEFT_COLOR = "#94a3b8";

const positive = (segments: CategorySegment[]): Slice[] =>
  segments
    .filter((s) => s.value > 0)
    .map(({ key, label, color, value }) => ({ key, label, color, value }));

function Donut({
  title,
  slices,
  center,
  centerTone,
}: {
  title: string;
  slices: Slice[];
  center: { label: string; value: number };
  centerTone?: "good" | "bad";
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  return (
    <figure className="min-w-0">
      <figcaption className="text-sm font-semibold text-slate-700">
        {title}
      </figcaption>
      {total <= 0 ? (
        <p className="mt-3 text-sm text-slate-500">Nic k zobrazení</p>
      ) : (
        <>
          <div className="relative mx-auto mt-2 h-48 w-48">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="100%"
                  stroke="#fff"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.key} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    `${formatMoney(Number(value))} (${percentLabel(Number(value) / total)})`,
                    String(name),
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xs text-slate-500">{center.label}</span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  centerTone === "good" && "text-emerald-700",
                  centerTone === "bad" && "text-rose-700",
                )}
              >
                {formatMoney(center.value)}
              </span>
            </div>
          </div>
          <ul className="mt-3 space-y-1 text-xs">
            {slices.map((slice) => (
              <li key={slice.key} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="min-w-0 flex-1 truncate text-slate-600">
                  {slice.label}
                </span>
                <span className="tabular-nums text-slate-800">
                  {formatMoney(slice.value)}
                </span>
                <span className="w-10 text-right tabular-nums text-slate-500">
                  {percentLabel(slice.value / total)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </figure>
  );
}

/** Koláčové grafy měsíce: výdaje a příjmy podle kategorií a kam jdou příjmy. */
export function MonthCharts({
  summary,
  expense,
  income,
}: {
  summary: MonthSummary;
  expense: CategorySegment[];
  income: CategorySegment[];
}) {
  const left = summary.income.plan - summary.expense.plan;
  const balanceSlices: Slice[] = [
    ...positive(expense),
    ...(left > 0
      ? [{ key: "__left", label: "Zůstává", color: LEFT_COLOR, value: left }]
      : []),
  ];
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <Donut
        title="Výdaje podle kategorií"
        slices={positive(expense)}
        center={{ label: "výdaje", value: summary.expense.plan }}
      />
      <Donut
        title="Příjmy podle kategorií"
        slices={positive(income)}
        center={{ label: "příjmy", value: summary.income.plan }}
      />
      <Donut
        title="Bilance – kam jdou příjmy"
        slices={balanceSlices}
        center={
          left >= 0
            ? { label: "zůstává", value: left }
            : { label: "schodek", value: left }
        }
        centerTone={left >= 0 ? "good" : "bad"}
      />
    </div>
  );
}
