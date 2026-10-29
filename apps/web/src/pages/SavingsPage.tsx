import type {
  Account,
  AccountBalance,
  AccountKind,
  BalanceInput,
  OverviewMonth,
} from "@kkff/api/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Copy, FileSpreadsheet } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { ExcelBalancesDialog } from "@/components/savings/ExcelBalancesDialog";
import { WealthSummary } from "@/components/savings/WealthSummary";
import { Button } from "@/components/ui/button";
import { ErrorMessage, Loading, PageHeader } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { ACCOUNT_DELETE_WARNING } from "@/lib/accounts";
import { api } from "@/lib/api";
import {
  assetGroupsOf,
  type BalanceLookup,
  comparableChange,
  groupTotal,
  latestRecordedMonth,
  lookupOf,
  monthTotal,
} from "@/lib/balances";
import { cn } from "@/lib/cn";
import {
  addMonths,
  currentMonth,
  formatMoney,
  monthLabel,
  shortMonthLabel,
} from "@/lib/format";
import { parseOptionalNumber, toText } from "@/lib/formValues";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/useMediaQuery";

const VISIBLE_MONTHS_DESKTOP = 6;
/** Na telefonu se vejdou dva sloupce: minulý a aktuální měsíc. */
const VISIBLE_MONTHS_MOBILE = 2;

function visibleMonths(lastMonth: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    addMonths(lastMonth, i - count + 1),
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
        // text-base na telefonu, jinak iOS při psaní přibližuje stránku
        "w-24 rounded-md border bg-transparent px-2 py-1.5 text-right text-base tabular-nums focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 sm:w-28 sm:py-1 sm:text-sm",
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
  color,
}: {
  label: string;
  months: string[];
  values: (number | null)[];
  strong?: boolean;
  /** Barva skupiny majetku – stejná jako v přehledu nahoře. */
  color?: string;
}) {
  return (
    <tr className={cn("border-t border-slate-200", strong && "font-semibold")}>
      <td
        className={cn(
          "sticky left-0 bg-slate-50 py-2 pr-3",
          color ? "pl-6" : "pl-3",
        )}
      >
        {color && (
          <span
            aria-hidden
            className="mr-1.5 inline-block size-2.5 rounded-sm"
            style={{ backgroundColor: color }}
          />
        )}
        {label}
      </td>
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

const ACCOUNT_KINDS: AccountKind[] = ["operating", "savings"];

const KIND_TITLES: Record<AccountKind, string> = {
  operating: "Provozní účty",
  savings: "Spořicí účty",
};

function AccountBalanceRow({
  account,
  months,
  balanceOf,
  disabled,
  onSave,
  onDelete,
}: {
  account: Account;
  months: string[];
  balanceOf: BalanceLookup;
  disabled: boolean;
  onSave: (month: string, balance: number | null) => void;
  onDelete: () => void;
}) {
  return (
    <tr className="border-t border-slate-100 hover:bg-brand-50/50">
      <td className="sticky left-0 bg-white py-1.5 pr-1 pl-3">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <div className="font-medium">{account.name}</div>
            <div className="text-xs text-slate-500">
              {[account.owner, account.type].filter(Boolean).join(" · ")}
            </div>
          </div>
          <DeleteButton
            label={`Smazat účet „${account.name}“`}
            disabled={disabled}
            onDelete={onDelete}
          />
        </div>
      </td>
      {months.map((month) => {
        const value = balanceOf(account.id, month);
        return (
          <td key={month} className="px-1 py-1 text-right">
            <BalanceCell
              key={`${account.id}-${month}-${value}`}
              value={value}
              disabled={disabled}
              onSave={(balance) => onSave(month, balance)}
            />
          </td>
        );
      })}
    </tr>
  );
}

function difference(a: number | null, b: number | null): number | null {
  return a == null || b == null ? null : a - b;
}

export function SavingsPage() {
  const queryClient = useQueryClient();
  const [lastMonth, setLastMonth] = useState(currentMonth());
  const [isImporting, setImporting] = useState(false);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
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

  const removeAccount = useMutation({
    mutationFn: (id: number) => api.remove("accounts", id),
    onSuccess: () => void queryClient.invalidateQueries(),
  });
  const deleteAccount = (account: Account) => {
    const question = `Opravdu smazat účet „${account.name}“?\n\n${ACCOUNT_DELETE_WARNING}`;
    if (window.confirm(question)) removeAccount.mutate(account.id);
  };

  if (accounts.isPending || balances.isPending) return <Loading />;
  if (accounts.error || balances.error) {
    return <ErrorMessage error={accounts.error ?? balances.error} />;
  }

  const months = visibleMonths(
    lastMonth,
    isDesktop ? VISIBLE_MONTHS_DESKTOP : VISIBLE_MONTHS_MOBILE,
  );
  const balanceOf = lookupOf(balances.data);
  const totals = months.map((month) => monthTotal(balances.data, month));
  // Jen účty zapsané v obou měsících – chybějící zápis není pokles.
  const changes = months.map((month) =>
    comparableChange(accounts.data, month, addMonths(month, -1), balanceOf),
  );
  const planOf = new Map<string, OverviewMonth>(
    (overview.data?.months ?? []).map((m) => [m.month, m]),
  );
  const plans = months.map((month) => planOf.get(month)?.wealthEnd ?? null);
  const toCopy = copyFromPrevious(accounts.data, lastMonth, balanceOf);
  const assetGroups = assetGroupsOf(accounts.data);
  const summaryMonth = latestRecordedMonth(balances.data, lastMonth);
  const onExcelApplied = (month: string, saved: AccountBalance[]) => {
    queryClient.setQueryData(["balances"], saved);
    void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    void queryClient.invalidateQueries({ queryKey: ["overview"] });
    setLastMonth(month);
    setImporting(false);
  };

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
      <WealthSummary
        month={summaryMonth}
        groups={assetGroups}
        balanceOf={balanceOf}
        plan={
          summaryMonth ? (planOf.get(summaryMonth)?.wealthEnd ?? null) : null
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          className="w-full sm:w-auto"
          disabled={toCopy.length === 0 || save.isPending}
          onClick={() => save.mutate({ month: lastMonth, inputs: toCopy })}
        >
          <Copy className="size-4" /> Předvyplnit {monthLabel(lastMonth)} z
          minulého měsíce ({toCopy.length})
        </Button>
        <Button className="w-full sm:w-auto" onClick={() => setImporting(true)}>
          <FileSpreadsheet className="size-4" /> Načíst z Excelu
        </Button>
        {save.error && <ErrorMessage error={save.error} />}
        {removeAccount.error && <ErrorMessage error={removeAccount.error} />}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm md:min-w-[760px]">
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
            <tr className="bg-brand-50">
              <td
                colSpan={months.length + 1}
                className="sticky left-0 px-3 py-1.5 text-sm font-semibold text-brand-700"
              >
                Souhrn
              </td>
            </tr>
            <SummaryRow
              label="Celkem (skutečnost)"
              months={months}
              values={totals}
              strong
            />
            {assetGroups.map((group) => (
              <SummaryRow
                key={group.key}
                label={group.label}
                color={group.color}
                months={months}
                values={months.map((month) =>
                  groupTotal(group.accounts, month, balanceOf),
                )}
              />
            ))}
            <SummaryRow
              label="Změna proti minulému měsíci"
              months={months}
              values={changes}
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
          </tbody>
          {ACCOUNT_KINDS.map((kind) => {
            const group = accounts.data.filter((a) => a.kind === kind);
            return (
              <tbody key={kind}>
                <tr className="bg-brand-50">
                  <td
                    colSpan={months.length + 1}
                    className="sticky left-0 px-3 py-1.5 text-sm font-semibold text-brand-700"
                  >
                    {KIND_TITLES[kind]}
                  </td>
                </tr>
                {group.map((account) => (
                  <AccountBalanceRow
                    key={account.id}
                    account={account}
                    months={months}
                    balanceOf={balanceOf}
                    disabled={save.isPending || removeAccount.isPending}
                    onDelete={() => deleteAccount(account)}
                    onSave={(month, balance) =>
                      save.mutate({
                        month,
                        inputs: [{ accountId: account.id, balance }],
                      })
                    }
                  />
                ))}
                <SummaryRow
                  label={`Mezisoučet – ${KIND_TITLES[kind].toLowerCase()}`}
                  months={months}
                  values={months.map((month) =>
                    groupTotal(group, month, balanceOf),
                  )}
                />
              </tbody>
            );
          })}
        </table>
      </div>
      {isImporting && (
        <ExcelBalancesDialog
          accounts={accounts.data}
          onApplied={onExcelApplied}
          onClose={() => setImporting(false)}
        />
      )}
    </div>
  );
}
