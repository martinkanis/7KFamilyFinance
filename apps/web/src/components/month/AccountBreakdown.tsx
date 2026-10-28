import type { AccountBreakdownRow } from "@kkff/api/contracts";
import { formatMoney } from "@/lib/format";

export function AccountBreakdown({ rows }: { rows: AccountBreakdownRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="bg-brand-700 text-left text-xs font-semibold tracking-wide text-white uppercase">
            <th className="py-2.5 pr-2 pl-4">Rozpis podle našich účtů</th>
            <th className="px-2 py-2.5 text-right">Odchází</th>
            <th className="px-2 py-2.5 text-right">Ještě zaplatit</th>
            <th className="px-2 py-2.5 text-right">Přichází</th>
            <th className="py-2.5 pr-4 pl-2 text-right">Ještě nepřišlo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.accountId ?? "none"}
              className="border-t border-slate-100"
            >
              <td className="py-2 pr-2 pl-4">
                <span
                  className={
                    row.accountId == null
                      ? "italic text-slate-500"
                      : "font-medium"
                  }
                >
                  {row.name}
                </span>
                {row.owner && (
                  <span className="ml-2 text-xs text-slate-500">
                    {row.owner}
                  </span>
                )}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatMoney(row.expensePlan)}
              </td>
              <td className="px-2 py-2 text-right font-semibold text-rose-700 tabular-nums">
                {formatMoney(row.expenseRemaining)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatMoney(row.incomePlan)}
              </td>
              <td className="py-2 pr-4 pl-2 text-right font-semibold text-amber-700 tabular-nums">
                {formatMoney(row.incomeRemaining)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
