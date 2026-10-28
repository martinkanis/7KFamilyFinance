import type { DirectionSummary, MonthSummary } from "@kkff/api/contracts";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";

function Progress({ summary }: { summary: DirectionSummary }) {
  const ratio = summary.plan > 0 ? summary.paid / summary.plan : 1;
  const processing = summary.plan > 0 ? summary.processing / summary.plan : 0;
  return (
    <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-rose-100">
      <div className="bg-emerald-500" style={{ width: `${ratio * 100}%` }} />
      <div className="bg-amber-400" style={{ width: `${processing * 100}%` }} />
    </div>
  );
}

function DirectionCard({
  title,
  doneLabel,
  summary,
}: {
  title: string;
  doneLabel: string;
  summary: DirectionSummary;
}) {
  return (
    <Card className="w-[85%] shrink-0 snap-center p-4 md:w-auto">
      <div className="text-sm font-medium text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {formatMoney(summary.plan)}
      </div>
      <Progress summary={summary} />
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-slate-500">{doneLabel}</dt>
          <dd className="font-semibold text-emerald-700 tabular-nums">
            {formatMoney(summary.paid)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Zpracovává se</dt>
          <dd className="font-semibold text-amber-700 tabular-nums">
            {formatMoney(summary.processing)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Zbývá</dt>
          <dd className="font-semibold text-rose-700 tabular-nums">
            {formatMoney(summary.remaining)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

export function SummaryCards({ summary }: { summary: MonthSummary }) {
  return (
    // Na telefonu vodorovný pás karet (posun prstem), od md mřížka.
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0">
      <DirectionCard
        title="Výdaje"
        doneLabel="Zaplaceno"
        summary={summary.expense}
      />
      <DirectionCard
        title="Příjmy"
        doneLabel="Přišlo"
        summary={summary.income}
      />
      <Card className="w-[85%] shrink-0 snap-center p-4 md:w-auto">
        <div className="text-sm font-medium text-slate-500">Bilance (plán)</div>
        <div
          className={`mt-1 text-2xl font-semibold tabular-nums ${summary.balance < 0 ? "text-rose-700" : "text-emerald-700"}`}
        >
          {formatMoney(summary.balance)}
        </div>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Do úspor (zůstává v majetku)</dt>
            <dd className="font-medium tabular-nums">
              {formatMoney(summary.savings)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Změna majetku</dt>
            <dd className="font-semibold tabular-nums">
              {formatMoney(summary.wealthChange)}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
