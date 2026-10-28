import type { CategoryMatrix, OverviewMonth } from "@kkff/api/contracts";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, ErrorMessage, Loading, PageHeader } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  formatDate,
  formatMoney,
  monthLabel,
  shortMonthLabel,
} from "@/lib/format";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/useMediaQuery";

const CHART_HEIGHT = { desktop: 300, mobile: 220 };
const THOUSANDS = new Intl.NumberFormat("cs-CZ", { notation: "compact" });

const MONEY_COLUMNS: {
  label: string;
  value: (m: OverviewMonth) => number | null;
  strong?: boolean;
}[] = [
  { label: "Příjmy plán", value: (m) => m.incomePlan },
  { label: "Příjmy přišlo", value: (m) => m.incomePaid },
  { label: "Výdaje plán", value: (m) => m.expensePlan },
  { label: "Zaplaceno", value: (m) => m.expensePaid },
  { label: "Zbývá", value: (m) => m.expenseRemaining },
  { label: "Bilance", value: (m) => m.balance, strong: true },
  { label: "Do úspor", value: (m) => m.savings },
  { label: "Korekce", value: (m) => m.correction },
  { label: "Majetek začátek", value: (m) => m.wealthStart },
  { label: "Majetek konec", value: (m) => m.wealthEnd, strong: true },
  { label: "Skutečný stav", value: (m) => m.actualWealth },
];

function sumOf(
  months: OverviewMonth[],
  value: (m: OverviewMonth) => number | null,
) {
  return months.reduce((sum, month) => sum + (value(month) ?? 0), 0);
}

function WealthChart({ months }: { months: OverviewMonth[] }) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const data = months.map((m) => ({
    label: shortMonthLabel(m.month),
    bilance: m.balance,
    majetek: m.wealthEnd,
    skutecnost: m.actualWealth,
  }));
  return (
    <Card className="p-4">
      <h2 className="mb-3 font-semibold">Bilance měsíce a vývoj majetku</h2>
      <ResponsiveContainer
        width="100%"
        height={isDesktop ? CHART_HEIGHT.desktop : CHART_HEIGHT.mobile}
      >
        <ComposedChart
          data={data}
          margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            yAxisId="balance"
            tickFormatter={(v: number) => THOUSANDS.format(v)}
            tick={{ fontSize: 11 }}
            width={44}
          />
          <YAxis
            yAxisId="wealth"
            orientation="right"
            tickFormatter={(v: number) => THOUSANDS.format(v)}
            tick={{ fontSize: 11 }}
            width={44}
          />
          <Tooltip formatter={(value) => formatMoney(Number(value))} />
          <Legend />
          <Bar
            yAxisId="balance"
            dataKey="bilance"
            name="Bilance"
            fill="#16a34a"
            radius={[4, 4, 0, 0]}
          >
            {data.map((point) => (
              <Cell
                key={point.label}
                fill={point.bilance < 0 ? "#e11d48" : "#16a34a"}
              />
            ))}
          </Bar>
          <Line
            yAxisId="wealth"
            dataKey="majetek"
            name="Majetek na konci (plán)"
            stroke="#1f3864"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            connectNulls={false}
          />
          <Line
            yAxisId="wealth"
            dataKey="skutecnost"
            name="Skutečný stav"
            stroke="#d97706"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={{ r: 4 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

function MonthValue({
  label,
  value,
  strong,
}: {
  label: string;
  value: number | null;
  strong?: boolean;
}) {
  if (value == null) {
    return null;
  }
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={cn(
          "text-right tabular-nums",
          strong && "font-semibold",
          value < 0 && "text-rose-700",
        )}
      >
        {formatMoney(value)}
      </dd>
    </>
  );
}

/** Telefon: na měsíc jedna karta s tím podstatným, detail po rozkliknutí měsíce. */
function MonthCards({ months }: { months: OverviewMonth[] }) {
  return (
    <ul className="space-y-2 md:hidden">
      {months.map((m) => (
        <li key={m.month}>
          <Link
            to="/mesic/$month"
            params={{ month: m.month }}
            className="block rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm active:bg-brand-50"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-brand-700">
                {monthLabel(m.month)}
              </span>
              {m.paidRatio != null && (
                <span className="text-xs text-slate-500">
                  zaplaceno {Math.round(m.paidRatio * 100)} %
                </span>
              )}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
              <MonthValue label="Příjmy" value={m.incomePlan} />
              <MonthValue label="Výdaje" value={m.expensePlan} />
              <MonthValue label="Bilance" value={m.balance} strong />
              <MonthValue label="Majetek na konci" value={m.wealthEnd} strong />
              <MonthValue label="Skutečný stav" value={m.actualWealth} />
            </dl>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MonthsTable({ months }: { months: OverviewMonth[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
      <table className="w-full min-w-[1100px] text-sm">
        <thead>
          <tr className="bg-brand-700 text-xs font-semibold tracking-wide text-white uppercase">
            <th className="px-3 py-2.5 text-left">Měsíc</th>
            {MONEY_COLUMNS.map((column) => (
              <th key={column.label} className="px-3 py-2.5 text-right">
                {column.label}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right">Zaplaceno %</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr
              key={m.month}
              className="border-t border-slate-100 hover:bg-brand-50"
            >
              <td className="px-3 py-2 font-medium whitespace-nowrap">
                <Link
                  to="/mesic/$month"
                  params={{ month: m.month }}
                  className="text-brand-600 hover:underline"
                >
                  {monthLabel(m.month)}
                </Link>
              </td>
              {MONEY_COLUMNS.map((column) => {
                const value = column.value(m);
                return (
                  <td
                    key={column.label}
                    className={cn(
                      "px-3 py-2 text-right tabular-nums whitespace-nowrap",
                      column.strong && "font-semibold",
                      value != null && value < 0 && "text-rose-700",
                    )}
                  >
                    {value == null ? "" : formatMoney(value)}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right tabular-nums">
                {m.paidRatio == null
                  ? ""
                  : `${Math.round(m.paidRatio * 100)} %`}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
            <td className="px-3 py-2">Celkem</td>
            {MONEY_COLUMNS.map((column, index) => (
              <td
                key={column.label}
                className="px-3 py-2 text-right tabular-nums whitespace-nowrap"
              >
                {index < 8 ? formatMoney(sumOf(months, column.value)) : ""}
              </td>
            ))}
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Matrix({
  title,
  matrix,
  months,
}: {
  title: string;
  matrix: CategoryMatrix;
  months: string[];
}) {
  return (
    <div>
      <h2 className="mb-2 font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-xs font-semibold text-slate-600">
              <th className="sticky left-0 bg-slate-100 px-3 py-2 text-left">
                Kategorie
              </th>
              {months.map((month) => (
                <th
                  key={month}
                  className="px-3 py-2 text-right whitespace-nowrap"
                >
                  {shortMonthLabel(month)}
                </th>
              ))}
              <th className="px-3 py-2 text-right">Celkem</th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.category} className="border-t border-slate-100">
                <td className="sticky left-0 bg-white px-3 py-1.5 whitespace-nowrap">
                  {row.category}
                </td>
                {row.amounts.map((amount, index) => (
                  <td
                    key={months[index]}
                    className={cn(
                      "px-3 py-1.5 text-right tabular-nums whitespace-nowrap",
                      amount === 0 && "text-slate-300",
                    )}
                  >
                    {formatMoney(amount)}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums whitespace-nowrap">
                  {formatMoney(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function OverviewPage() {
  const overview = useQuery({ queryKey: ["overview"], queryFn: api.overview });
  if (overview.isPending) return <Loading />;
  if (overview.error) return <ErrorMessage error={overview.error} />;

  const { months, initialWealth, startDate } = overview.data;
  const monthKeys = months.map((m) => m.month);
  const lastWealth = [...months]
    .reverse()
    .find((m) => m.wealthEnd != null)?.wealthEnd;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Přehled cashflow a majetku"
        description={
          startDate
            ? `Počáteční majetek ${formatMoney(initialWealth)} k ${formatDate(startDate)} · na konci období ${formatMoney(lastWealth)}`
            : "Nastav datum počátečního stavu v sekci Excel, aby se počítal majetek."
        }
      />
      <WealthChart months={months} />
      <MonthCards months={months} />
      <MonthsTable months={months} />
      <Matrix
        title="Výdaje podle kategorií (plán)"
        matrix={overview.data.expenseMatrix}
        months={monthKeys}
      />
      <Matrix
        title="Příjmy podle skupin (plán)"
        matrix={overview.data.incomeMatrix}
        months={monthKeys}
      />
    </div>
  );
}
