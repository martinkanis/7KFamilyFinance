import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { monthLabel } from "@/lib/format";

const HIDE_AFTER_MS = 15_000;

/**
 * Po úpravě pravidelné platby v tabulce: změna platí jen pro měsíc, jedním
 * klikem z ní jde udělat změnu položky od tohoto měsíce dál.
 */
export function ForwardOffer({
  offerKey,
  month,
  name,
  disabled,
  onApply,
  onDismiss,
}: {
  /** Mění se s každou nabídkou – časovač skrytí začne znovu. */
  offerKey: string;
  month: string;
  name: string;
  disabled: boolean;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    if (!offerKey) return;
    const timer = setTimeout(() => dismiss.current(), HIDE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [offerKey]);

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-xl flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg md:bottom-6"
    >
      <span className="min-w-0 flex-1">
        „{name}“ – změna platí jen pro {monthLabel(month).toLowerCase()}.
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={onApply}
        className="rounded-lg bg-white px-3 py-1.5 font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50"
      >
        Platí i pro další měsíce
      </button>
      <button
        type="button"
        aria-label="Zavřít"
        onClick={onDismiss}
        className="rounded p-1 text-slate-300 hover:text-white"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
