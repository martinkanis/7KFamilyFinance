import type { AccountBreakdownRow } from "@kkff/api/contracts";
import { formatMoney } from "@/lib/format";

function AccountName({ row }: { row: AccountBreakdownRow }) {
  return (
    <>
      <span
        className={
          row.accountId == null ? "italic text-slate-500" : "font-medium"
        }
      >
        {row.name}
      </span>
      {row.owner && (
        <span className="ml-2 text-xs text-slate-500">{row.owner}</span>
      )}
    </>
  );
}

/** Telefon: na účet jedna karta s odchozími a příchozími částkami. */
function BreakdownCards({ rows }: { rows: AccountBreakdownRow[] }) {
  return (
    <section className="md:hidden">
      <h2 className="mb-2 text-lg font-semibold">Rozpis podle našich účtů</h2>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.accountId ?? "none"}
            className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm"
          >
            <AccountName row={row} />
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              <dt className="text-slate-500">Odchází</dt>
              <dd className="text-right tabular-nums">
                {formatMoney(row.expensePlan)}
              </dd>
              <dt className="text-slate-500">Ještě zaplatit</dt>
              <dd className="text-right font-semibold text-rose-700 tabular-nums">
                {formatMoney(row.expenseRemaining)}
              </dd>
              <dt className="text-slate-500">Přichází</dt>
              <dd className="text-right tabular-nums">
                {formatMoney(row.incomePlan)}
              </dd>
              <dt className="text-slate-500">Ještě nepřišlo</dt>
              <dd className="text-right font-semibold text-amber-700 tabular-nums">
                {formatMoney(row.incomeRemaining)}
              </dd>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BreakdownTable({ rows }: { rows: AccountBreakdownRow[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
      <table className="w-full text-sm">
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
                <AccountName row={row} />
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

export function AccountBreakdown({ rows }: { rows: AccountBreakdownRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <>
      <BreakdownCards rows={rows} />
      <BreakdownTable rows={rows} />
    </>
  );
}
