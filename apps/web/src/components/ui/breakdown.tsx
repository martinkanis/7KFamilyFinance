import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

// Společné kousky přehledů „celkem a z čeho se skládá“ (Spoření, Měsíc).

const PERCENT = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });

export function percentLabel(share: number): string {
  return share > 0 && share < 0.01
    ? "< 1 %"
    : `${PERCENT.format(share * 100)} %`;
}

/** Změna proti minulému měsíci; u výdajů je růst špatně (goodWhenUp = false). */
export function Change({
  value,
  goodWhenUp = true,
  className,
}: {
  value: number | null;
  goodWhenUp?: boolean;
  className?: string;
}) {
  if (value == null) return null;
  if (value === 0) {
    return (
      <div className={cn("text-xs text-slate-500", className)}>
        beze změny proti minulému měsíci
      </div>
    );
  }
  const isGood = goodWhenUp ? value > 0 : value < 0;
  return (
    <div className={cn("text-xs text-slate-500", className)}>
      <span
        className={cn(
          "font-semibold tabular-nums",
          isGood ? "text-emerald-700" : "text-rose-700",
        )}
      >
        {value > 0 ? "+" : ""}
        {formatMoney(value)}
      </span>{" "}
      proti minulému měsíci
    </div>
  );
}

export interface Segment {
  key: string;
  label: string;
  color: string;
  value: number | null;
}

/** Kladný podíl segmentu na součtu kladných hodnot (záporné se nepočítají). */
export function sharesOf(segments: Segment[]): Map<string, number> {
  const sum = segments.reduce((s, g) => s + Math.max(g.value ?? 0, 0), 0);
  return new Map(
    segments
      .filter((g) => sum > 0 && (g.value ?? 0) > 0)
      .map((g) => [g.key, (g.value ?? 0) / sum]),
  );
}

/** Podíly jedním pruhem, mezi segmenty mezera. */
export function ShareBar({ segments }: { segments: Segment[] }) {
  const shares = sharesOf(segments);
  const shown = segments.filter((g) => shares.has(g.key));
  if (shown.length === 0) return null;
  return (
    <div
      className="flex h-3 gap-0.5 overflow-hidden rounded-full"
      role="img"
      aria-label={shown
        .map((g) => `${g.label} ${percentLabel(shares.get(g.key) ?? 0)}`)
        .join(", ")}
    >
      {shown.map((g) => (
        <div
          key={g.key}
          title={`${g.label}: ${formatMoney(g.value)} (${percentLabel(shares.get(g.key) ?? 0)})`}
          className="h-full first:rounded-l-full last:rounded-r-full"
          style={{
            width: `${(shares.get(g.key) ?? 0) * 100}%`,
            backgroundColor: g.color,
          }}
        />
      ))}
    </div>
  );
}

/** Dlaždice skupiny: barva a název, částka a pod ní doplňující řádky. */
export function BreakdownTile({
  segment,
  children,
}: {
  segment: Segment;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center gap-1.5 text-sm text-slate-600">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-sm"
          style={{ backgroundColor: segment.color }}
        />
        <span className="truncate" title={segment.label}>
          {segment.label}
        </span>
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          segment.value != null && segment.value < 0 && "text-rose-700",
        )}
      >
        {formatMoney(segment.value)}
      </div>
      {children}
    </div>
  );
}
