import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

/** Nativní <dialog>: focus trap, Esc a backdrop zařídí prohlížeč. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog?.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className={cn(
        // Na telefonu spodní panel přes celou šířku, od sm vycentrované okno.
        "mx-0 mt-auto mb-0 max-h-[92dvh] w-full max-w-none flex-col rounded-t-2xl bg-white p-0 shadow-2xl open:flex",
        "sm:m-auto sm:max-h-[85vh] sm:w-[calc(100%-2rem)] sm:rounded-2xl",
        wide ? "sm:max-w-3xl" : "sm:max-w-lg",
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="min-w-0 truncate text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          aria-label="Zavřít"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      )}
    </dialog>
  );
}
