import type { Direction, MonthSummary } from "@kkff/api/contracts";
import type { KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

const TABS: { direction: Direction; title: string; remainingLabel: string }[] =
  [
    { direction: "expense", title: "Výdaje", remainingLabel: "zbývá zaplatit" },
    { direction: "income", title: "Příjmy", remainingLabel: "ještě má přijít" },
  ];

export const directionTabId = (direction: Direction) =>
  `month-tab-${direction}`;
export const DIRECTION_PANEL_ID = "month-direction-panel";

/** Přepínač výdajů a příjmů – každý má svou „stránku“, není potřeba rolovat. */
export function DirectionTabs({
  value,
  summary,
  onChange,
}: {
  value: Direction;
  summary: MonthSummary;
  onChange: (direction: Direction) => void;
}) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = value === "expense" ? "income" : "expense";
    onChange(next);
    document.getElementById(directionTabId(next))?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label="Výdaje a příjmy"
      className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1 md:inline-grid md:min-w-96"
    >
      {TABS.map(({ direction, title, remainingLabel }) => {
        const selected = direction === value;
        const { remaining } = summary[direction];
        return (
          <button
            key={direction}
            type="button"
            role="tab"
            id={directionTabId(direction)}
            aria-selected={selected}
            aria-controls={DIRECTION_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(direction)}
            onKeyDown={onKeyDown}
            className={cn(
              "rounded-lg px-3 py-2 text-left transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
              selected
                ? "bg-white text-brand-700 shadow-sm"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
            )}
          >
            <span className="block text-base font-semibold">{title}</span>
            <span
              className={cn(
                "block text-xs tabular-nums",
                remaining === 0 ? "text-emerald-700" : "text-slate-500",
              )}
            >
              {remaining === 0
                ? "hotovo ✓"
                : `${remainingLabel} ${formatMoney(remaining)}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
