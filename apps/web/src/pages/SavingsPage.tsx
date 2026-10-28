import type {
  Account,
  AccountBalance,
  BalanceInput,
  OverviewMonth,
} from "@kkff/api/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorMessage, Loading, PageHeader } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  addMonths,
  currentMonth,
  formatMoney,
  monthLabel,
  shortMonthLabel,
} from "@/lib/format";
import { parseOptionalNumber, toText } from "@/lib/formValues";

const VISIBLE_MONTHS = 6;

type BalanceLookup = (accountId: number, month: string) => number | null;

function lookupOf(balances: AccountBalance[]): BalanceLookup {
  const byKey = new Map(
    balances.map((b) => [`${b.accountId}|${b.month}`, b.balance]),
  );
  return (accountId, month) => byKey.get(`${accountId}|${month}`) ?? null;
}

function monthTotal(balances: AccountBalance[], month: string): number | null {
  const inMonth = balances.filter((b) => b.month === month);
  return inMonth.length === 0
    ? null
    : inMonth.reduce((sum, b) => sum + b.balance, 0);
}

function visibleMonths(lastMonth: string): string[] {
  return Array.from({ length: VISIBLE_MONTHS }, (_, i) =>
    addMonths(lastMonth, i - VISIBLE_MONTHS + 1),
  );
}

/** Zůstatky, které chybí v měsíci a jsou v předchozím – pro předvyplnění. */
function copyFromPrevious(
  accounts: Account[],
  month: string,
  balanceOf: BalanceLookup,
): BalanceInput[] {
  const previous = addMonths(month, -1);
  return accounts.flatMap((account) => {
    const previousBalance = balanceOf(account.id, previous);
    const isMissing = balanceOf(account.id, month) == null;
    return isMissing && previousBalance != null
      ? [{ accountId: account.id, balance: previousBalance }]
      : [];
  });
}

interface BalanceCellProps {
  value: number | null;
  disabled: boolean;
  onSave: (balance: number | null) => void;
}

/** Uloží se při opuštění pole nebo Enteru; prázdné pole zůstatek smaže. */
function BalanceCell({ value, disabled, onSave }: BalanceCellProps) {
  const [text, setText] = useState(toText(value));
  const [error, setError] = useState(false);
  const commit = () => {
    const parsed = parseOptionalNumber(text, "Zůstatek");
    setError(!parsed.ok);
    if (parsed.ok && parsed.value !== value) {
      onSave(parsed.value);
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  };
  return (
    <input
      inputMode="decimal"
      aria-label="Zůstatek"
      value={text}
      disabled={disabled}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={cn(
        "w-28 rounded-md border bg-transparent px-2 py-1 text-right tabular-nums focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100",
        error ? "border-rose-400" : "border-transparent hover:border-slate-300",
      )}
    />
  );
}

function SummaryRow({
  label,
  months,
  values,
  strong,
}: {
  label: string;
  months: string[];
  values: (number | null)[];
  strong?: boolean;
}) {
  return (
    <tr className={cn("border-t border-slate-200", strong && "font-semibold")}>
      <td className="sticky left-0 bg-slate-50 px-3 py-2">{label}</td>
      {months
        .map((month, index) => ({ month, value: values[index] ?? null }))
        .map(({ month, value }) => (
          <td
            key={month}
            className={cn(
              "bg-slate-50 px-3 py-2 text-right tabular-nums whitespace-nowrap",
              value != null && value < 0 && "text-rose-700",
            )}
          >
            {value == null ? "" : formatMoney(value)}
          </td>
        ))}
    </tr>
  );
}

function difference(a: number | null, b: number | null): number | null {
  return a == null || b == null ? null : a - b;
}

export function SavingsPage() {
  const queryClient = useQueryClient();
  const [lastMonth, setLastMonth] = useState(currentMonth());
  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.list("accounts"),
  });
  const balances = useQuery({ queryKey: ["balances"], queryFn: api.balances });
  const overview = useQuery({ queryKey: ["overview"], queryFn: api.overview });
  const save = useMutation({
    mutationFn: ({
      month,
      inputs,
    }: {
      month: string;
      inputs: BalanceInput[];
    }) => api.saveBalances(month, inputs),
    onSuccess: (saved) => {
      queryClient.setQueryData(["balances"], saved);
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  if (accounts.isPending || balances.isPending) return <Loading />;
  if (accounts.error || balances.error) {
    return <ErrorMessage error={accounts.error ?? balances.error} />;
  }

  const months = visibleMonths(lastMonth);
  const balanceOf = lookupOf(balances.data);
  const totals = months.map((month) => monthTotal(balances.data, month));
  const previousTotals = months.map((month) =>
    monthTotal(balances.data, addMonths(month, -1)),
  );
  const planOf = new Map<string, OverviewMonth>(
    (overview.data?.months ?? []).map((m) => [m.month, m]),
  );
  const plans = months.map((month) => planOf.get(month)?.wealthEnd ?? null);
  const toCopy = copyFromPrevious(accounts.data, lastMonth, balanceOf);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stav účtů a spoření"
        description="Při měsíční kontrole zapiš skutečné zůstatky – jako blok „Stávající stav“ v Excelu. Pole se uloží po opuštění nebo Enteru."
        actions={
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              title="Dřívější měsíce"
              onClick={() => setLastMonth(addMonths(lastMonth, -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button size="sm" onClick={() => setLastMonth(currentMonth())}>
              Tento měsíc
            </Button>
            <Button
              size="sm"
              title="Pozdější měsíce"
              onClick={() => setLastMonth(addMonths(lastMonth, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={toCopy.length === 0 || save.isPending}
          onClick={() => save.mutate({ month: lastMonth, inputs: toCopy })}
        >
          <Copy className="size-4" /> Předvyplnit {monthLabel(lastMonth)} z
          předchozího měsíce ({toCopy.length})
        </Button>
        {save.error && <ErrorMessage error={save.error} />}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="bg-brand-700 text-xs font-semibold tracking-wide text-white uppercase">
              <th className="sticky left-0 bg-brand-700 px-3 py-2.5 text-left">
                Účet
              </th>
              {months.map((month) => (
                <th
                  key={month}
                  className="px-3 py-2.5 text-right whitespace-nowrap"
                >
                  {shortMonthLabel(month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.data.map((account) => (
              <tr
                key={account.id}
                className="border-t border-slate-100 hover:bg-brand-50/50"
              >
                <td className="sticky left-0 bg-white px-3 py-1.5">
                  <div className="font-medium">{account.name}</div>
                  <div className="text-xs text-slate-500">
                    {[account.owner, account.type].filter(Boolean).join(" · ")}
                  </div>
                </td>
                {months.map((month) => {
                  const value = balanceOf(account.id, month);
                  return (
                    <td key={month} className="px-1 py-1 text-right">
                      <BalanceCell
                        key={`${account.id}-${month}-${value}`}
                        value={value}
                        disabled={save.isPending}
                        onSave={(balance) =>
                          save.mutate({
                            month,
                            inputs: [{ accountId: account.id, balance }],
                          })
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <SummaryRow
              label="Celkem (skutečnost)"
              months={months}
              values={totals}
              strong
            />
            <SummaryRow
              label="Změna proti minulému měsíci"
              months={months}
              values={totals.map((total, i) =>
                difference(total, previousTotals[i] ?? null),
              )}
            />
            <SummaryRow
              label="Plán podle cashflow"
              months={months}
              values={plans}
            />
            <SummaryRow
              label="Skutečnost − plán"
              months={months}
              values={totals.map((total, i) =>
                difference(total, plans[i] ?? null),
              )}
            />
          </tfoot>
        </table>
      </div>
    </div>
  );
}
