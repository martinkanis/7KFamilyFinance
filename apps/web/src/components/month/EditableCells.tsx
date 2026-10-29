import type { Account, EntryInput, MonthRow } from "@kkff/api/contracts";
import { ExternalLink } from "lucide-react";
import { EditableSelect, EditableText } from "@/components/ui/editable";
import { operatingAccountsWith } from "@/lib/accounts";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney, safeUrl } from "@/lib/format";
import {
  idOrNull,
  parseOptionalDay,
  parseOptionalNumber,
  textOrNull,
  toText,
} from "@/lib/formValues";

/** Úpravy přímo v tabulce; měsíční hodnoty platí jen pro tento měsíc, název a kategorie všude. */
export interface RowEditing {
  accounts: Account[];
  onChange: (row: MonthRow, changes: Partial<EntryInput>) => void;
  onRename: (row: MonthRow, name: string) => void;
  onRenameCategory: (from: string, to: string) => void;
  onInvalid: (message: string) => void;
}

type CellProps = Pick<RowEditing, "onChange" | "onInvalid"> & {
  row: MonthRow;
};

/**
 * Prázdné nepovinné údaje se nabídnou až při najetí na řádek (nebo práci v něm).
 * Místo mají vyhrazené pořád, aby řádky při přejíždění myší neskákaly.
 */
const REVEAL_ON_ROW =
  "invisible group-hover:visible group-focus-within:visible";

const RENAME_HINT = "mění se ve všech měsících";

export function NameCell({
  row,
  overdue,
  onRename,
  onInvalid,
}: Pick<RowEditing, "onRename" | "onInvalid"> & {
  row: MonthRow;
  overdue: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline gap-x-1.5 font-medium",
        overdue && "text-rose-700",
      )}
    >
      {row.code && <span className="text-xs text-slate-400">{row.code}</span>}
      <EditableText
        value={row.name}
        label={row.isOneOff ? "Název" : `Název (${RENAME_HINT})`}
        onCommit={(text) => {
          const name = textOrNull(text);
          if (name) onRename(row, name);
          else onInvalid("Název nesmí být prázdný");
        }}
      />
      {row.isOneOff && (
        <span className="rounded bg-slate-200 px-1 text-[10px] text-slate-600">
          jednorázově
        </span>
      )}
    </div>
  );
}

export function CategoryName({
  category,
  onRenameCategory,
  onInvalid,
}: Pick<RowEditing, "onRenameCategory" | "onInvalid"> & {
  category: string;
}) {
  return (
    <EditableText
      value={category}
      label={`Kategorie (${RENAME_HINT})`}
      onCommit={(text) => {
        const name = textOrNull(text);
        if (name) onRenameCategory(category, name);
        else onInvalid("Kategorie nesmí být prázdná");
      }}
    />
  );
}

function Counterparty({ row }: { row: MonthRow }) {
  if (!row.counterparty) {
    return null;
  }
  const url = safeUrl(row.counterparty.web);
  if (!url) {
    return <span>{row.counterparty.name}</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-brand-600 hover:underline"
    >
      {row.counterparty.name}
      <ExternalLink className="size-3" />
    </a>
  );
}

/** Druhý řádek: protistrana, její účet, VS, šablona a poznámka. */
export function DetailCells({ row, onChange }: CellProps) {
  const textCell = (
    field: "counterpartyAccount" | "vs" | "note",
    label: string,
    placeholder: string,
    className?: string,
  ) => {
    const value = toText(row[field]);
    return (
      <span className={cn(value === "" && REVEAL_ON_ROW)}>
        <EditableText
          value={value}
          label={label}
          placeholder={placeholder}
          inputMode={field === "vs" ? "numeric" : undefined}
          className={className}
          onCommit={(text) => onChange(row, { [field]: textOrNull(text) })}
        >
          {field === "vs" && value !== "" ? `VS ${value}` : undefined}
        </EditableText>
      </span>
    );
  };
  return (
    <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 text-xs text-slate-500">
      <Counterparty row={row} />
      {textCell(
        "counterpartyAccount",
        "Účet protistrany",
        "+ účet protistrany",
        "font-mono break-all",
      )}
      {textCell("vs", "Variabilní symbol", "+ VS", "font-mono")}
      {row.template && (
        <span className="font-mono">šablona {row.template.code}</span>
      )}
      {textCell("note", "Poznámka", "+ poznámka", "italic")}
    </div>
  );
}

export function AccountCell({
  row,
  accounts,
  onChange,
}: CellProps & { accounts: Account[] }) {
  const override = row.overrides.ourAccountId;
  // U položky prázdná volba = výchozí účet z položky (bez přepsání je to ten zobrazený).
  const emptyLabel = row.isOneOff
    ? "– žádný –"
    : override == null
      ? (row.ourAccount?.name ?? "– žádný –")
      : "↺ výchozí z položky";
  const options = operatingAccountsWith(accounts, [override]);
  return (
    <EditableSelect
      label={row.isOneOff ? "Náš účet" : "Náš účet (jen tento měsíc)"}
      display={row.ourAccount?.name ?? "– žádný –"}
      value={toText(override)}
      onChange={(event) =>
        onChange(row, { ourAccountId: idOrNull(event.target.value) })
      }
    >
      <option value="">{emptyLabel}</option>
      {options.map((account) => (
        <option key={account.id} value={account.id}>
          {account.name}
        </option>
      ))}
    </EditableSelect>
  );
}

function dayOf(row: MonthRow): string {
  return toText(
    row.overrides.dueDay ?? (row.dueDate ? Number(row.dueDate.slice(8)) : null),
  );
}

export function DueCell({ row, onChange, onInvalid }: CellProps) {
  return (
    <EditableText
      value={dayOf(row)}
      label="Den splatnosti (jen tento měsíc, prázdné = výchozí)"
      placeholder="+ splatnost"
      inputMode="numeric"
      onCommit={(text) => {
        const day = parseOptionalDay(text);
        if (day.ok) onChange(row, { dueDay: day.value });
        else onInvalid(day.error);
      }}
    >
      {row.dueDate ? formatDate(row.dueDate) : undefined}
    </EditableText>
  );
}

export function AmountCell({
  row,
  onChange,
  onInvalid,
  className,
}: CellProps & { className?: string }) {
  return (
    <EditableText
      value={toText(row.amount)}
      label={
        row.isOneOff
          ? "Částka"
          : "Částka (jen tento měsíc, prázdné = výchozí z položky)"
      }
      inputMode="decimal"
      align="right"
      className={cn("tabular-nums", className)}
      onCommit={(text) => {
        const amount = parseOptionalNumber(text, "Částka");
        if (amount.ok) onChange(row, { amount: amount.value });
        else onInvalid(amount.error);
      }}
    >
      {formatMoney(row.amount)}
    </EditableText>
  );
}

export function PaidOnCell({ row, onChange }: CellProps) {
  return (
    <EditableText
      type="date"
      value={toText(row.paidOn)}
      label="Uhrazeno dne"
      className="text-xs"
      onCommit={(text) => onChange(row, { paidOn: textOrNull(text) })}
    >
      {row.paidOn ? formatDate(row.paidOn) : undefined}
    </EditableText>
  );
}
