import type {
  Account,
  CategoryType,
  EntryInput,
  MonthRow,
  PaymentType,
} from "@kkff/api/contracts";
import { ExternalLink } from "lucide-react";
import { EditableSelect, EditableText } from "@/components/ui/editable";
import type { ComboOption } from "@/lib/accountOptions";
import { operatingAccountsWith } from "@/lib/accounts";
import { numberedCategory } from "@/lib/categoryNumbers";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney, PARTIAL_LABELS, safeUrl } from "@/lib/format";
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
  paymentTypes: PaymentType[];
  /** Typ platby – u pravidelné platby ve všech měsících. */
  onSetPaymentType: (row: MonthRow, typeId: number | null) => void;
  /** Nabídka pro „účet protistrany“ (protistrany a naše účty). */
  accountOptions: ComboOption[];
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
  number,
  onRenameCategory,
  onInvalid,
}: Pick<RowEditing, "onRenameCategory" | "onInvalid"> & {
  category: string;
  /** Pořadové číslo kategorie – jen zobrazení, při úpravě se mění samotný název. */
  number: number | null;
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
    >
      {numberedCategory(category, number)}
    </EditableText>
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
export function DetailCells({
  row,
  onChange,
  accountOptions,
  paymentTypes,
  onSetPaymentType,
}: CellProps &
  Pick<RowEditing, "accountOptions" | "paymentTypes" | "onSetPaymentType">) {
  const textCell = (
    field: "counterpartyAccount" | "vs" | "note",
    label: string,
    placeholder: string,
    className?: string,
    options?: RowEditing["accountOptions"],
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
          options={options}
          onCommit={(text) => onChange(row, { [field]: textOrNull(text) })}
        >
          {field === "vs" && value !== "" ? `VS ${value}` : undefined}
        </EditableText>
      </span>
    );
  };
  return (
    <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 text-xs text-slate-500">
      <PaymentTypeCell
        row={row}
        paymentTypes={paymentTypes}
        onSetPaymentType={onSetPaymentType}
      />
      <Counterparty row={row} />
      {textCell(
        "counterpartyAccount",
        "Účet protistrany",
        "+ účet protistrany",
        "font-mono break-all",
        accountOptions,
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

/**
 * Částečné plnění: kolik z příjmu zatím přišlo, nebo kolik z výdaje
 * (např. rozpočtu na jídlo) už je utracené. Celá částka (nebo víc) platbu
 * rovnou označí jako vyřízenou.
 */
export function ReceivedCell({ row, onChange, onInvalid }: CellProps) {
  if (row.status === "paid" || row.amount === 0) {
    return null;
  }
  const received = row.receivedAmount;
  const labels = PARTIAL_LABELS[row.direction];
  return (
    <span className={cn("text-xs", received == null && REVEAL_ON_ROW)}>
      <EditableText
        value={toText(received)}
        label={labels.field}
        placeholder={`+ ${labels.done} částečně`}
        inputMode="decimal"
        onCommit={(text) => {
          const parsed = parseOptionalNumber(text, labels.field);
          if (!parsed.ok) {
            onInvalid(parsed.error);
          } else if (parsed.value != null && parsed.value >= row.amount) {
            onChange(row, {
              status: "paid",
              paidOn: null,
              receivedAmount: null,
            });
          } else {
            const value = parsed.value;
            onChange(row, {
              receivedAmount: value && value > 0 ? value : null,
            });
          }
        }}
      >
        {received != null && (
          <span className="font-medium text-emerald-700">
            {labels.done} {formatMoney(received)} z {formatMoney(row.amount)}
          </span>
        )}
      </EditableText>
    </span>
  );
}

/** Výběr z číselníku typů, který vypadá jako text; prázdná hodnota se nabídne po najetí. */
function TypeSelect({
  label,
  emptyLabel,
  value,
  types,
  shownName,
  onPick,
}: {
  label: string;
  emptyLabel: string;
  value: number | null;
  types: CategoryType[];
  shownName: string | null;
  onPick: (typeId: number | null) => void;
}) {
  return (
    <span className={cn("text-xs", value == null && REVEAL_ON_ROW)}>
      <EditableSelect
        label={label}
        display={
          shownName ? (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
              {shownName}
            </span>
          ) : (
            <span className="text-slate-400">{emptyLabel}</span>
          )
        }
        value={value == null ? "" : String(value)}
        onChange={(event) => onPick(idOrNull(event.target.value))}
      >
        <option value="">– bez typu –</option>
        {types.map((type) => (
          <option key={type.id} value={type.id}>
            {type.name}
          </option>
        ))}
      </EditableSelect>
    </span>
  );
}

export function PaymentTypeCell({
  row,
  paymentTypes,
  onSetPaymentType,
}: Pick<RowEditing, "paymentTypes" | "onSetPaymentType"> & { row: MonthRow }) {
  return (
    <TypeSelect
      label={row.isOneOff ? "Typ platby" : "Typ platby (ve všech měsících)"}
      emptyLabel="+ typ platby"
      value={row.paymentType?.id ?? null}
      types={paymentTypes}
      shownName={row.paymentType?.name ?? null}
      onPick={(typeId) => onSetPaymentType(row, typeId)}
    />
  );
}

export function CategoryTypeCell({
  typeId,
  categoryTypes,
  onPick,
}: {
  typeId: number | null;
  categoryTypes: CategoryType[];
  onPick: (typeId: number | null) => void;
}) {
  return (
    <TypeSelect
      label="Nadkategorie"
      emptyLabel="+ nadkategorie"
      value={typeId}
      types={categoryTypes}
      shownName={categoryTypes.find((t) => t.id === typeId)?.name ?? null}
      onPick={onPick}
    />
  );
}
