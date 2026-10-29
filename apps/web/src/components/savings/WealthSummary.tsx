import type { Account } from "@kkff/api/contracts";
import { Card } from "@/components/ui/card";
import {
  type AssetGroupRow,
  type BalanceLookup,
  comparableChange,
  groupTotal,
} from "@/lib/balances";
import { cn } from "@/lib/cn";
import { addMonths, formatMoney, monthLabel } from "@/lib/format";

const PERCENT = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });

function percentLabel(share: number): string {
  return share > 0 && share < 0.01
    ? "< 1 %"
    : `${PERCENT.format(share * 100)} %`;
}

function Change({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  if (value == null) return null;
  return (
    <div className={cn("text-xs text-slate-500", className)}>
      <span
        className={cn(
          "font-semibold tabular-nums",
          value > 0 && "text-emerald-700",
          value < 0 && "text-rose-700",
        )}
      >
        {value > 0 ? "+" : ""}
        {formatMoney(value)}
      </span>{" "}
      proti minulému měsíci
    </div>
  );
}

interface GroupValue extends AssetGroupRow {
  value: number | null;
  change: number | null;
}

/** Podíly skupin jedním pruhem; záporné zůstatky (přečerpání) se do podílu nepočítají. */
function ShareBar({ groups }: { groups: GroupValue[] }) {
  const positive = groups.filter((g) => (g.value ?? 0) > 0);
  const sum = positive.reduce((total, g) => total + (g.value ?? 0), 0);
  if (sum <= 0) return null;
  return (
    <div
      className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full"
      role="img"
      aria-label={positive
        .map((g) => `${g.label} ${percentLabel((g.value ?? 0) / sum)}`)
        .join(", ")}
    >
      {positive.map((g) => (
        <div
          key={g.key}
          title={`${g.label}: ${formatMoney(g.value)} (${percentLabel((g.value ?? 0) / sum)})`}
          className="h-full first:rounded-l-full last:rounded-r-full"
          style={{
            width: `${((g.value ?? 0) / sum) * 100}%`,
            backgroundColor: g.color,
          }}
        />
      ))}
    </div>
  );
}

function GroupTile({
  group,
  share,
}: {
  group: GroupValue;
  share: number | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center gap-1.5 text-sm text-slate-600">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-sm"
          style={{ backgroundColor: group.color }}
        />
        <span className="truncate">{group.label}</span>
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          group.value != null && group.value < 0 && "text-rose-700",
        )}
      >
        {formatMoney(group.value)}
      </div>
      {share != null && (
        <div className="text-xs text-slate-500">
          {percentLabel(share)} z celku
        </div>
      )}
      <Change value={group.change} />
    </div>
  );
}

/** Přehled nahoře: kolik je celkem za měsíc a z čeho se to skládá. */
export function WealthSummary({
  month,
  groups,
  balanceOf,
  plan,
}: {
  /** Poslední měsíc se zapsaným stavem; null = zatím nic. */
  month: string | null;
  groups: AssetGroupRow[];
  balanceOf: BalanceLookup;
  plan: number | null;
}) {
  if (month == null) {
    return (
      <Card className="p-4 text-sm text-slate-500">
        Zatím není zapsaný žádný stav účtů – vyplň zůstatky v tabulce níže nebo
        je načti z Excelu.
      </Card>
    );
  }
  const previousMonth = addMonths(month, -1);
  const values: GroupValue[] = groups.map((group) => ({
    ...group,
    value: groupTotal(group.accounts, month, balanceOf),
    change: comparableChange(group.accounts, month, previousMonth, balanceOf),
  }));
  const sumOf = (pick: (g: GroupValue) => number | null) => {
    const known = values.map(pick).filter((v): v is number => v != null);
    return known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
  };
  const total = sumOf((g) => g.value);
  const totalChange = sumOf((g) => g.change);
  const positiveSum = values.reduce((s, g) => s + Math.max(g.value ?? 0, 0), 0);
  const missing: Account[] = groups
    .flatMap((group) => group.accounts)
    .filter((account) => balanceOf(account.id, month) == null);

  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="text-sm text-slate-500">
            Celkem – stav za {monthLabel(month).toLowerCase()}
          </div>
          <div className="text-3xl font-semibold tabular-nums">
            {formatMoney(total)}
          </div>
          <Change className="text-sm" value={totalChange} />
        </div>
        {plan != null && total != null && (
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-sm">
            <dt className="text-slate-500">Plán podle cashflow</dt>
            <dd className="text-right tabular-nums">{formatMoney(plan)}</dd>
            <dt className="text-slate-500">Skutečnost − plán</dt>
            <dd
              className={cn(
                "text-right font-semibold tabular-nums",
                total - plan < 0 ? "text-rose-700" : "text-emerald-700",
              )}
            >
              {total - plan > 0 ? "+" : ""}
              {formatMoney(total - plan)}
            </dd>
          </dl>
        )}
      </div>
      <ShareBar groups={values} />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {values.map((group) => (
          <GroupTile
            key={group.key}
            group={group}
            share={
              positiveSum > 0 && (group.value ?? 0) > 0
                ? (group.value ?? 0) / positiveSum
                : null
            }
          />
        ))}
      </div>
      {missing.length > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Za {monthLabel(month).toLowerCase()} chybí stav:{" "}
          <span className="font-semibold">
            {missing.map((account) => account.name).join(", ")}
          </span>
          . Součty jsou proto nižší; změna proti minulému měsíci počítá jen účty
          zapsané v obou měsících.
        </p>
      )}
    </Card>
  );
}
