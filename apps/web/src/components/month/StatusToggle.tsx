import type { PaymentStatus } from "@kkff/api/contracts";
import { cn } from "@/lib/cn";
import { STATUS_LABELS } from "@/lib/format";

const OPTIONS: { status: PaymentStatus; short: string; active: string }[] = [
  { status: "unpaid", short: "Ne", active: "bg-rose-500 text-white" },
  {
    status: "processing",
    short: "Zprac.",
    active: "bg-amber-400 text-amber-950",
  },
  { status: "paid", short: "Ano", active: "bg-emerald-600 text-white" },
];

interface StatusToggleProps {
  status: PaymentStatus;
  disabled?: boolean;
  onChange: (status: PaymentStatus) => void;
}

export function StatusToggle({
  status,
  disabled,
  onChange,
}: StatusToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Stav platby"
      className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white text-xs font-semibold"
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
              "px-2 py-1 transition-colors",
              isActive ? option.active : "text-slate-500 hover:bg-slate-100",
            )}
          >
            {option.short}
          </button>
        );
      })}
    </div>
  );
}
