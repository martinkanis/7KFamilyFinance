import type { Direction, PaymentStatus } from "@kkff/api/contracts";
import { cn } from "@/lib/cn";
import { STATUS_LABELS } from "@/lib/format";

interface StatusOption {
  status: PaymentStatus;
  /** Popisek v kompaktní tabulce (desktop). */
  short: string;
  active: string;
}

const OPTIONS: StatusOption[] = [
  { status: "unpaid", short: "Ne", active: "bg-rose-500 text-white" },
  {
    status: "processing",
    short: "Zprac.",
    active: "bg-amber-400 text-amber-950",
  },
  { status: "paid", short: "Ano", active: "bg-emerald-600 text-white" },
];

/** Popisky velkého přepínače (telefon); u příjmu „Zaplaceno“ znamená „přišlo“. */
function largeLabel(status: PaymentStatus, direction: Direction): string {
  if (status === "paid") {
    return direction === "income" ? "Přišlo" : "Zaplaceno";
  }
  return status === "processing" ? "Zpracovává" : "Ne";
}

interface StatusToggleProps {
  status: PaymentStatus;
  direction: Direction;
  size?: "compact" | "large";
  disabled?: boolean;
  onChange: (status: PaymentStatus) => void;
}

export function StatusToggle({
  status,
  direction,
  size = "compact",
  disabled,
  onChange,
}: StatusToggleProps) {
  const isLarge = size === "large";
  return (
    <div
      role="radiogroup"
      aria-label="Stav platby"
      className={cn(
        "overflow-hidden rounded-lg border border-slate-300 bg-white font-semibold",
        isLarge ? "flex text-sm" : "inline-flex text-xs",
      )}
    >
      {OPTIONS.map((option) => {
        const isActive = option.status === status;
        return (
          // biome-ignore lint/a11y/useSemanticElements: segmentový přepínač stavu
          <button
            key={option.status}
            type="button"
            role="radio"
            aria-checked={isActive}
            title={STATUS_LABELS[option.status]}
            disabled={disabled}
            onClick={() => !isActive && onChange(option.status)}
            className={cn(
              "transition-colors",
              isLarge ? "flex-1 px-2 py-2.5" : "px-2 py-1",
              isActive
                ? option.active
                : "text-slate-500 hover:bg-slate-100 active:bg-slate-200",
            )}
          >
            {isLarge ? largeLabel(option.status, direction) : option.short}
          </button>
        );
      })}
    </div>
  );
}
