import type { MonthRow, PaymentStatus } from "@kkff/api/contracts";
import { Pencil, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import {
  type CategoryGroup,
  groupByCategory,
  isOverdue,
  isPayable,
} from "@/lib/monthRows";
import {
  AccountCell,
  AmountCell,
  CategoryName,
  DetailCells,
  DueCell,
  NameCell,
  PaidOnCell,
  type RowEditing,
} from "./EditableCells";
import { StatusToggle } from "./StatusToggle";

const ROW_TINT: Record<PaymentStatus, string> = {
  paid: "bg-emerald-50/70",
  processing: "bg-amber-50/80",
  unpaid: "bg-rose-50/60",
};

const CARD_EDGE: Record<PaymentStatus, string> = {
  paid: "border-l-emerald-500",
  processing: "border-l-amber-400",
  unpaid: "border-l-rose-400",
};

interface RowActions extends RowEditing {
  today: string;
  onStatus: (row: MonthRow, status: PaymentStatus) => void;
  onEdit: (row: MonthRow) => void;
  onQr: (row: MonthRow) => void;
  onDelete: (row: MonthRow) => void;
}

interface PaymentTableProps extends RowActions {
  title: string;
  rows: MonthRow[];
}

function hasOverride(row: MonthRow): boolean {
  return Object.values(row.overrides).some((value) => value != null);
}

function RowDeleteButton({
  row,
  onDelete,
}: Pick<RowActions, "onDelete"> & { row: MonthRow }) {
  return (
    <DeleteButton
      label={
        row.isOneOff
          ? `Smazat „${row.name}“`
          : `Ukončit „${row.name}“ od tohoto měsíce`
      }
      onDelete={() => onDelete(row)}
    />
  );
}

function RowButtons({
  row,
  onEdit,
  onQr,
}: Pick<RowActions, "onEdit" | "onQr"> & { row: MonthRow }) {
  return (
    <>
      {isPayable(row) && (
        <Button
          size="sm"
          variant="ghost"
          title="QR platba"
          aria-label="QR platba"
          onClick={() => onQr(row)}
        >
          <QrCode className="size-5 md:size-4" />
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        title="Všechny údaje pro tento měsíc"
        aria-label="Upravit"
        onClick={() => onEdit(row)}
      >
        <Pencil className="size-5 md:size-4" />
      </Button>
    </>
  );
}

function PaymentRow({
  row,
  today,
  onStatus,
  onEdit,
  onQr,
  onDelete,
  ...editing
}: RowActions & { row: MonthRow }) {
  const isZero = row.amount === 0;
  const overdue = isOverdue(row, today);
  const cell = {
    row,
    onChange: editing.onChange,
    onInvalid: editing.onInvalid,
  };
  return (
    <tr
      className={cn(
        "group border-t border-slate-100",
        isZero ? "text-slate-400" : ROW_TINT[row.status],
      )}
    >
      <td className="py-2 pr-2 pl-4 align-top">
        <NameCell
          row={row}
          overdue={overdue}
          onRename={editing.onRename}
          onInvalid={editing.onInvalid}
        />
        <DetailCells {...cell} />
      </td>
      <td className="px-2 py-2 align-top text-sm whitespace-nowrap">
        <AccountCell {...cell} accounts={editing.accounts} />
      </td>
      <td
        className={cn(
          "px-2 py-2 align-top text-sm whitespace-nowrap",
          overdue && "font-semibold text-rose-700",
        )}
      >
        <DueCell {...cell} />
        {overdue && <div className="text-xs">po splatnosti</div>}
      </td>
      <td className="px-2 py-2 text-right align-top font-semibold whitespace-nowrap">
        <AmountCell {...cell} className="w-28" />
        {hasOverride(row) && (
          <div className="text-[10px] font-normal text-amber-700">upraveno</div>
        )}
      </td>
      <td className="px-2 py-2 align-top">
        {!isZero && (
          <StatusToggle
            status={row.status}
            direction={row.direction}
            onChange={(status) => onStatus(row, status)}
          />
        )}
        {row.paidOn && (
          <div className="mt-1 text-slate-500">
            <PaidOnCell {...cell} />
          </div>
        )}
      </td>
      <td className="py-2 pr-4 pl-2 text-right align-top whitespace-nowrap">
        <RowButtons row={row} onEdit={onEdit} onQr={onQr} />
        <RowDeleteButton row={row} onDelete={onDelete} />
      </td>
    </tr>
  );
}

/** Karta platby pro telefon: vše podstatné na jeden pohled, velký přepínač stavu. */
function PaymentCard({
  row,
  today,
  onStatus,
  onEdit,
  onQr,
  onDelete,
  ...editing
}: RowActions & { row: MonthRow }) {
  const isZero = row.amount === 0;
  const overdue = isOverdue(row, today);
  const cell = {
    row,
    onChange: editing.onChange,
    onInvalid: editing.onInvalid,
  };
  return (
    <li
      className={cn(
        "group rounded-xl border border-l-4 border-slate-200 bg-white p-3 shadow-sm",
        isZero ? "border-l-slate-200 opacity-60" : CARD_EDGE[row.status],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <NameCell
            row={row}
            overdue={overdue}
            onRename={editing.onRename}
            onInvalid={editing.onInvalid}
          />
          <DetailCells {...cell} />
          <div className="mt-1 flex flex-wrap items-baseline gap-x-1 text-xs text-slate-500">
            <AccountCell {...cell} accounts={editing.accounts} />
            <span
              className={cn(
                "inline-flex items-baseline gap-1",
                overdue && "font-semibold text-rose-700",
              )}
            >
              · {overdue ? "po splatnosti" : "splatnost"}
              <DueCell {...cell} />
            </span>
            {row.paidOn && (
              <span className="inline-flex items-baseline gap-1">
                · uhrazeno
                <PaidOnCell {...cell} />
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-base font-semibold">
            <AmountCell {...cell} className="max-w-32" />
          </div>
          {hasOverride(row) && (
            <div className="text-[11px] text-amber-700">upraveno</div>
          )}
        </div>
        {/* Koš nahoře, aby dole zůstalo místo pro přepínač stavu. */}
        <div className="-mt-1 -mr-1 shrink-0">
          <RowDeleteButton row={row} onDelete={onDelete} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1">
        <div className="min-w-0 flex-1">
          {!isZero && (
            <StatusToggle
              size="large"
              status={row.status}
              direction={row.direction}
              onChange={(status) => onStatus(row, status)}
            />
          )}
        </div>
        <RowButtons row={row} onEdit={onEdit} onQr={onQr} />
      </div>
    </li>
  );
}

function remainingLabel(group: CategoryGroup): string {
  return group.remaining === 0
    ? "hotovo ✓"
    : `zbývá ${formatMoney(group.remaining)}`;
}

function PaymentCards({ title, rows, ...actions }: PaymentTableProps) {
  const groups = groupByCategory(rows);
  return (
    <section className="md:hidden">
      {/* Název ukazuje přepínač záložek nad seznamem. */}
      <h2 className="sr-only">{title}</h2>
      {groups.length === 0 && (
        <p className="rounded-xl bg-white p-4 text-center text-sm text-slate-500">
          Nic k zobrazení
        </p>
      )}
      {groups.map((group) => (
        <div key={group.category} className="mb-4">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1 text-sm">
            <span className="min-w-0 font-semibold text-brand-700">
              <CategoryName
                category={group.category}
                onRenameCategory={actions.onRenameCategory}
                onInvalid={actions.onInvalid}
              />
            </span>
            <span className="shrink-0 text-xs text-slate-500">
              {formatMoney(group.plan)} · {remainingLabel(group)}
            </span>
          </div>
          <ul className="space-y-2">
            {group.rows.map((row) => (
              <PaymentCard key={row.key} row={row} {...actions} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function PaymentTableDesktop({ title, rows, ...actions }: PaymentTableProps) {
  const groups = groupByCategory(rows);
  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-brand-700 text-left text-xs font-semibold tracking-wide text-white uppercase">
            <th className="py-2.5 pr-2 pl-4">{title}</th>
            <th className="px-2 py-2.5">Náš účet</th>
            <th className="px-2 py-2.5">Splatnost</th>
            <th className="px-2 py-2.5 text-right">Částka</th>
            <th className="px-2 py-2.5">Stav</th>
            <th className="py-2.5 pr-4 pl-2" />
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.category}>
            <tr className="bg-brand-50 text-sm font-semibold text-brand-700">
              <td className="py-1.5 pl-4" colSpan={3}>
                <CategoryName
                  category={group.category}
                  onRenameCategory={actions.onRenameCategory}
                  onInvalid={actions.onInvalid}
                />
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {formatMoney(group.plan)}
              </td>
              <td className="px-2 py-1.5 text-xs font-medium" colSpan={2}>
                {remainingLabel(group)}
              </td>
            </tr>
            {group.rows.map((row) => (
              <PaymentRow key={row.key} row={row} {...actions} />
            ))}
          </tbody>
        ))}
        {groups.length === 0 && (
          <tbody>
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                Nic k zobrazení
              </td>
            </tr>
          </tbody>
        )}
      </table>
    </div>
  );
}

/** Na telefonu karty, od md tabulka. */
export function PaymentTable(props: PaymentTableProps) {
  return (
    <>
      <PaymentCards {...props} />
      <PaymentTableDesktop {...props} />
    </>
  );
}
