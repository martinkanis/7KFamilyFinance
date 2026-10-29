import {
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/cn";

// Buňky upravitelné přímo v tabulce jako v Excelu: vypadají jako text,
// po kliknutí (nebo začátku psaní) se z nich stane pole.

const CELL =
  "-mx-1 rounded px-1 transition-colors hover:bg-white hover:ring-1 hover:ring-slate-300 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

// Na telefonu 16 px – iOS jinak při kliknutí do pole přibližuje stránku.
const EDITOR =
  "-mx-1 w-full min-w-0 rounded border border-brand-500 bg-white px-1 text-base text-slate-900 " +
  "ring-2 ring-brand-100 outline-none md:text-sm";

interface Draft {
  text: string;
  selectAll: boolean;
}

interface EditableTextProps {
  /** Text, který se upravuje (prázdný = nevyplněno). */
  value: string;
  /** Zobrazení mimo úpravu; výchozí je samotný text. */
  children?: ReactNode;
  /** Ukáže se, když je hodnota prázdná. */
  placeholder?: string;
  label: string;
  type?: "text" | "date";
  inputMode?: "text" | "decimal" | "numeric";
  align?: "left" | "right";
  className?: string;
  /** Zavolá se jen při skutečné změně textu. */
  onCommit: (text: string) => void;
}

function isTypedCharacter(event: KeyboardEvent): boolean {
  return (
    event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
  );
}

export function EditableText({
  value,
  children,
  placeholder,
  label,
  type = "text",
  inputMode,
  align = "left",
  className,
  onCommit,
}: EditableTextProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Enter i následný blur by jinak uložily dvakrát.
  const finished = useRef(false);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (draft) {
      const input = inputRef.current;
      input?.focus();
      if (draft.selectAll) input?.select();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [draft]);

  const start = (text: string, selectAll: boolean) => {
    finished.current = false;
    setDraft({ text, selectAll });
  };

  const finish = (save: boolean, keepFocus: boolean) => {
    if (finished.current || !draft) return;
    finished.current = true;
    if (save && draft.text.trim() !== value.trim()) onCommit(draft.text);
    returnFocus.current = keepFocus;
    setDraft(null);
  };

  if (draft) {
    return (
      <input
        ref={inputRef}
        type={type}
        inputMode={inputMode}
        aria-label={label}
        value={draft.text}
        onChange={(event) =>
          setDraft({ text: event.target.value, selectAll: false })
        }
        onBlur={() => finish(true, false)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            finish(true, true);
          } else if (event.key === "Escape") {
            event.preventDefault();
            finish(false, true);
          }
        }}
        className={cn(EDITOR, align === "right" && "text-right", className)}
      />
    );
  }

  const isEmpty = value.trim() === "";
  return (
    <button
      ref={buttonRef}
      type="button"
      title={`${label} – klikni a přepiš`}
      aria-label={`${label}: ${isEmpty ? "nevyplněno" : value}`}
      onClick={() => start(value, true)}
      onKeyDown={(event) => {
        if (event.key === "F2") {
          event.preventDefault();
          start(value, false);
        } else if (isTypedCharacter(event) && type === "text") {
          event.preventDefault();
          start(event.key, false);
        }
      }}
      className={cn(
        CELL,
        "cursor-text",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {isEmpty && !children ? (
        <span className="font-normal text-slate-400">{placeholder ?? "–"}</span>
      ) : (
        (children ?? value)
      )}
    </button>
  );
}

/**
 * Výběr, který vypadá jako text; změna se uloží hned. Přes text leží průhledný
 * select s 16px písmem – klepnutí otevře výběr a iOS stránku nepřiblíží.
 */
export function EditableSelect({
  className,
  label,
  display,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  display: ReactNode;
}) {
  return (
    <span
      className={cn(
        CELL,
        "relative inline-block max-w-full truncate focus-within:ring-2 focus-within:ring-brand-500",
        className,
      )}
    >
      {display}
      <select
        aria-label={label}
        title={`${label} – klikni a vyber`}
        className="absolute inset-0 size-full cursor-pointer appearance-none text-base opacity-0"
        {...props}
      />
    </span>
  );
}
