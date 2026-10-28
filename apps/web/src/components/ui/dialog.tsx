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
        "m-auto w-[calc(100%-2rem)] rounded-2xl bg-white p-0 shadow-2xl",
        wide ? "max-w-3xl" : "max-w-lg",
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          aria-label="Zavřít"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          {footer}
        </div>
      )}
    </dialog>
  );
}
