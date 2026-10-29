import type {
  Direction,
  DirectionSummary,
  MonthView,
} from "@kkff/api/contracts";
import { ChevronDown } from "lucide-react";
import {
  BreakdownTile,
  Change,
  percentLabel,
  ShareBar,
  sharesOf,
} from "@/components/ui/breakdown";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { categoryBreakdown } from "@/lib/monthBreakdown";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/useMediaQuery";

const DIRECTION_TEXT: Record<
  Direction,
  { title: string; done: string; remaining: string; share: string }
> = {
  expense: {
    title: "Výdaje",
    done: "zaplaceno",
    remaining: "zbývá",
    share: "z výdajů",
  },
  income: {
    title: "Příjmy",
    done: "přišlo",
    remaining: "ještě má přijít",
    share: "z příjmů",
  },
};

function Progress({ summary }: { summary: DirectionSummary }) {
  const ratio = summary.plan > 0 ? summary.paid / summary.plan : 1;
  const processing = summary.plan > 0 ? summary.processing / summary.plan : 0;
  return (
    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-rose-100">
      <div className="bg-emerald-500" style={{ width: `${ratio * 100}%` }} />
      <div className="bg-amber-400" style={{ width: `${processing * 100}%` }} />
    </div>
  );
}

function DirectionStat({
  direction,
  summary,
  change,
}: {
  direction: Direction;
  summary: DirectionSummary;
  change: number | null;
}) {
  const text = DIRECTION_TEXT[direction];
  return (
    <div>
      <div className="text-sm text-slate-500">{text.title}</div>
      <div className="text-xl font-semibold tabular-nums sm:text-2xl md:text-3xl">
        {formatMoney(summary.plan)}
      </div>
      <Change value={change} goodWhenUp={direction === "income"} />
      <Progress summary={summary} />
      <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
        <span>
          {text.done}{" "}
          <span className="font-semibold text-emerald-700 tabular-nums">
            {formatMoney(summary.paid)}
          </span>
        </span>
        {summary.processing > 0 && (
          <span>
            zpracovává se{" "}
            <span className="font-semibold text-amber-700 tabular-nums">
              {formatMoney(summary.processing)}
            </span>
          </span>
        )}
        <span>
          {text.remaining}{" "}
          <span className="font-semibold text-rose-700 tabular-nums">
            {formatMoney(summary.remaining)}
          </span>
        </span>
      </div>
    </div>
  );
}

function BalanceStat({ view }: { view: MonthView }) {
  const { balance, savings, wealthChange } = view.summary;
  return (
    <div className="col-span-2 md:col-span-1">
      <div className="text-sm text-slate-500">Bilance (plán)</div>
      <div
        className={cn(
          "text-xl font-semibold tabular-nums sm:text-2xl md:text-3xl",
          balance < 0 ? "text-rose-700" : "text-emerald-700",
        )}
      >
        {formatMoney(balance)}
      </div>
      <dl className="mt-2 space-y-0.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Do úspor (zůstává v majetku)</dt>
          <dd className="tabular-nums">{formatMoney(savings)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Změna majetku</dt>
          <dd className="font-semibold tabular-nums">
            {formatMoney(wealthChange)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Přehled měsíce nahoře: výdaje, příjmy a bilance a rozpad vybraného směru
 * (záložka Výdaje/Příjmy) podle kategorií. Na telefonu je rozpad sbalený.
 */
export function MonthOverview({
  view,
  previous,
  direction,
}: {
  view: MonthView;
  /** Minulý měsíc pro porovnání; dokud se nenačte, změny se neukazují. */
  previous: MonthView | undefined;
  direction: Direction;
}) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const text = DIRECTION_TEXT[direction];
  const segments = categoryBreakdown(
    view.rows,
    direction,
    previous?.rows ?? null,
  );
  const shares = sharesOf(segments);
  const planChange = (d: Direction) =>
    previous ? view.summary[d].plan - previous.summary[d].plan : null;

  return (
    <Card className="p-4 md:p-5">
      {/* Na telefonu výdaje a příjmy vedle sebe, bilance pod nimi. */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-3 md:gap-6">
        <DirectionStat
          direction="expense"
          summary={view.summary.expense}
          change={planChange("expense")}
        />
        <DirectionStat
          direction="income"
          summary={view.summary.income}
          change={planChange("income")}
        />
        <BalanceStat view={view} />
      </div>
      {segments.length > 0 && (
        <details
          // Klíč přepne výchozí rozbalení při změně šířky okna.
          key={String(isDesktop)}
          open={isDesktop}
          className="group mt-5 border-t border-slate-100 pt-4"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
            {text.title} podle kategorií
            <ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3">
            <ShareBar segments={segments} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {segments.map((segment) => {
              const share = shares.get(segment.key);
              return (
                <BreakdownTile key={segment.key} segment={segment}>
                  {share != null && (
                    <div className="text-xs text-slate-500">
                      {percentLabel(share)} {text.share}
                    </div>
                  )}
                  <div className="text-xs text-slate-500">
                    {segment.remaining === 0 ? (
                      <span className="font-semibold text-emerald-700">
                        hotovo ✓
                      </span>
                    ) : (
                      <>
                        {text.remaining}{" "}
                        <span className="font-semibold text-rose-700 tabular-nums">
                          {formatMoney(segment.remaining)}
                        </span>
                      </>
                    )}
                  </div>
                  <Change
                    value={segment.change}
                    goodWhenUp={direction === "income"}
                  />
                </BreakdownTile>
              );
            })}
          </div>
        </details>
      )}
    </Card>
  );
}
