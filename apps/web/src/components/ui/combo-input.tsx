import {
  type InputHTMLAttributes,
  type KeyboardEvent,
  type Ref,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { type ComboOption, filterOptions } from "@/lib/accountOptions";
import { cn } from "@/lib/cn";

const MAX_SHOWN = 50;

interface ComboInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "onSelect"
  > {
  value: string;
  options: ComboOption[];
  onChange: (text: string) => void;
  /** Výběr ze seznamu; výchozí je stejné jako psaní (onChange). */
  onPick?: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}

interface Position {
  top: number;
  left: number;
  width: number;
}

/**
 * Textové pole s nabídkou, kterou jde psaním filtrovat (šipky, Enter, Esc).
 * Hodnotu jde i napsat ručně. Nabídka má pevnou pozici, aby ji neořízla
 * posuvná tabulka.
 */
export function ComboInput({
  value,
  options,
  onChange,
  onPick,
  inputRef,
  onKeyDown,
  onBlur,
  onFocus,
  className,
  ...props
}: ComboInputProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [position, setPosition] = useState<Position | null>(null);
  const wrapper = useRef<HTMLSpanElement>(null);
  const listId = useId();
  const optionId = (index: number) => `${listId}-${index}`;
  const shown = filterOptions(options, value).slice(0, MAX_SHOWN);
  const isOpen = open && shown.length > 0;

  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const rect = wrapper.current?.getBoundingClientRect();
      if (rect) {
        setPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: Math.max(rect.width, 240),
        });
      }
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [isOpen]);

  const pick = (option: ComboOption) => {
    setOpen(false);
    setHighlight(-1);
    (onPick ?? onChange)(option.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlight((index) =>
        Math.min(Math.max(index + step, 0), shown.length - 1),
      );
      return;
    }
    const highlighted = isOpen ? shown[highlight] : undefined;
    if (event.key === "Enter" && highlighted) {
      event.preventDefault();
      pick(highlighted);
      return;
    }
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setOpen(false);
      return;
    }
    onKeyDown?.(event);
  };

  return (
    <span ref={wrapper} className="relative block w-full">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={
          isOpen && highlight >= 0 ? optionId(highlight) : undefined
        }
        autoComplete="off"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={(event) => {
          setOpen(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setOpen(false);
          onBlur?.(event);
        }}
        onKeyDown={handleKeyDown}
        className={className}
        {...props}
      />
      {isOpen && position && (
        <div
          id={listId}
          role="listbox"
          style={position}
          className="fixed z-50 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-left text-sm shadow-lg"
        >
          {shown.map((option, index) => (
            <div
              key={`${option.label}|${option.value}`}
              id={optionId(index)}
              role="option"
              tabIndex={-1}
              aria-selected={index === highlight}
              // mousedown by jinak vzal poli fokus (blur) dřív než klik
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(option)}
              // klávesnici obsluhuje pole (šipky, Enter); tohle je pro jistotu
              onKeyDown={(event) => event.key === "Enter" && pick(option)}
              onMouseEnter={() => setHighlight(index)}
              className={cn(
                "flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5",
                index === highlight && "bg-brand-50",
              )}
            >
              <span className="truncate font-medium text-slate-800">
                {option.label}
              </span>
              <span className="shrink-0 font-mono text-xs text-slate-500">
                {option.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}
