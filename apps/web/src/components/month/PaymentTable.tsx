import type { MonthRow, PaymentStatus } from "@kkff/api/contracts";
import { ArrowDown, ArrowUp, Pencil, Plus, QrCode } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import {
  type CategoryGroup,
  groupByCategory,
  isOverdue,
  isPayable,
  type RowSort,
  type SortBy,
  sortRows,
} from "@/lib/monthRows";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
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
import {
  categoryDndId,
  DROP_LINE,
  DragHandle,
  rowDndId,
  useDndItem,
} from "./MonthDnd";
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
  /** Platby jdou přetahovat jen ve vlastním pořadí (ne při řazení). */
  canDrag: boolean;
  onStatus: (row: MonthRow, status: PaymentStatus) => void;
  onEdit: (row: MonthRow) => void;
  onQr: (row: MonthRow) => void;
  onDelete: (row: MonthRow) => void;
}

interface CategoryActions {
  onAddCategory: (name: string) => void;
  onDeleteCategory: (category: string, isEmpty: boolean) => void;
}

interface PaymentTableProps extends CategoryActions {
  title: string;
  actions: Omit<RowActions, "canDrag">;
  /** Zobrazené (vyfiltrované) platby jednoho směru. */
  rows: MonthRow[];
  /** Všechny platby směru – podle nich se pozná prázdná kategorie. */
  allRows: MonthRow[];
  /** Kategorie směru v pořadí, i prázdné. */
  categories: string[];
  sort: RowSort;
  onSortChange: (sort: RowSort) => void;
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
  canDrag,
  onStatus,
  onEdit,
  onQr,
  onDelete,
  ...editing
}: RowActions & { row: MonthRow }) {
  const isZero = row.amount === 0;
  const overdue = isOverdue(row, today);
  const dnd = useDndItem(
    rowDndId(row),
    { type: "row", row },
    { dragDisabled: !canDrag },
  );
  const cell = {
    row,
    onChange: editing.onChange,
    onInvalid: editing.onInvalid,
  };
  return (
    <tr
      ref={dnd.setNodeRef}
      className={cn(
        "group border-t border-slate-100",
        isZero ? "text-slate-400" : ROW_TINT[row.status],
        dnd.isDragging && "opacity-40",
        dnd.drop && DROP_LINE[dnd.drop],
      )}
    >
      <td className="py-2 pr-2 pl-1 align-top">
        <div className="flex items-start gap-1">
          <DragHandle
            label={`Přetáhnout „${row.name}“`}
            hidden={!canDrag}
            handle={dnd.handle}
            className="mt-0.5"
          />
          <div className={cn("min-w-0", !canDrag && "pl-3")}>
            <NameCell
              row={row}
              overdue={overdue}
              onRename={editing.onRename}
              onInvalid={editing.onInvalid}
            />
            <DetailCells {...cell} />
          </div>
        </div>
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
  canDrag,
  onStatus,
  onEdit,
  onQr,
  onDelete,
  ...editing
}: RowActions & { row: MonthRow }) {
  const isZero = row.amount === 0;
  const overdue = isOverdue(row, today);
  const dnd = useDndItem(
    rowDndId(row),
    { type: "row", row },
    { dragDisabled: !canDrag },
  );
  const cell = {
    row,
    onChange: editing.onChange,
    onInvalid: editing.onInvalid,
  };
  return (
    <li
      ref={dnd.setNodeRef}
      className={cn(
        "group rounded-xl border border-l-4 border-slate-200 bg-white p-3 shadow-sm",
        isZero ? "border-l-slate-200 opacity-60" : CARD_EDGE[row.status],
        dnd.isDragging && "opacity-40",
        dnd.drop && DROP_LINE[dnd.drop],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <DragHandle
          label={`Přetáhnout „${row.name}“`}
          hidden={!canDrag}
          handle={dnd.handle}
          className="-ml-1.5 p-1"
        />
        <div className="min-w-0 flex-1">
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
  if (group.rows.length === 0) return "";
  return group.remaining === 0
    ? "hotovo ✓"
    : `zbývá ${formatMoney(group.remaining)}`;
}

interface GroupProps
  extends RowActions,
    Pick<CategoryActions, "onDeleteCategory"> {
  group: CategoryGroup;
  isEmpty: boolean;
}

/** Záhlaví kategorie: úchyt, název (přejmenování), součty a koš. */
function useCategoryDnd(category: string) {
  return useDndItem(
    categoryDndId(category),
    { type: "category", category },
    { dragDisabled: false },
  );
}

function CategoryDelete({
  group,
  isEmpty,
  onDeleteCategory,
}: Pick<GroupProps, "group" | "isEmpty" | "onDeleteCategory">) {
  return (
    <DeleteButton
      label={`Smazat kategorii „${group.category}“`}
      onDelete={() => onDeleteCategory(group.category, isEmpty)}
    />
  );
}

const EMPTY_HINT = "Prázdná kategorie – přetáhni sem platbu za úchyt ⋮⋮";

function CardGroup({ group, isEmpty, ...actions }: GroupProps) {
  const dnd = useCategoryDnd(group.category);
  return (
    <div className={cn("mb-4", dnd.isDragging && "opacity-40")}>
      <div
        ref={dnd.setNodeRef}
        className={cn(
          "mb-1.5 flex items-center justify-between gap-1 rounded-lg px-1 text-sm",
          dnd.drop && DROP_LINE[dnd.drop],
        )}
      >
        <DragHandle
          label={`Přetáhnout kategorii „${group.category}“`}
          handle={dnd.handle}
          className="p-1"
        />
        <span className="min-w-0 flex-1 font-semibold text-brand-700">
          <CategoryName
            category={group.category}
            onRenameCategory={actions.onRenameCategory}
            onInvalid={actions.onInvalid}
          />
        </span>
        <span className="shrink-0 text-xs text-slate-500">
          {group.rows.length > 0 &&
            `${formatMoney(group.plan)} · ${remainingLabel(group)}`}
        </span>
        <CategoryDelete
          group={group}
          isEmpty={isEmpty}
          onDeleteCategory={actions.onDeleteCategory}
        />
      </div>
      <ul className="space-y-2">
        {group.rows.map((row) => (
          <PaymentCard key={row.key} row={row} {...actions} />
        ))}
        {group.rows.length === 0 && (
          <li className="rounded-xl border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500">
            {EMPTY_HINT}
          </li>
        )}
      </ul>
    </div>
  );
}

function TableGroup({ group, isEmpty, ...actions }: GroupProps) {
  const dnd = useCategoryDnd(group.category);
  return (
    <tbody className={cn(dnd.isDragging && "opacity-40")}>
      <tr
        ref={dnd.setNodeRef}
        className={cn(
          "bg-brand-50 text-sm font-semibold text-brand-700",
          dnd.drop && DROP_LINE[dnd.drop],
        )}
      >
        <td className="py-1.5 pl-1" colSpan={3}>
          <div className="flex items-center gap-1">
            <DragHandle
              label={`Přetáhnout kategorii „${group.category}“`}
              handle={dnd.handle}
            />
            <CategoryName
              category={group.category}
              onRenameCategory={actions.onRenameCategory}
              onInvalid={actions.onInvalid}
            />
          </div>
        </td>
        <td className="px-2 py-1.5 text-right tabular-nums">
          {group.rows.length > 0 && formatMoney(group.plan)}
        </td>
        <td className="px-2 py-1.5 text-xs font-medium">
          {remainingLabel(group)}
        </td>
        <td className="py-1 pr-4 pl-2 text-right">
          <CategoryDelete
            group={group}
            isEmpty={isEmpty}
            onDeleteCategory={actions.onDeleteCategory}
          />
        </td>
      </tr>
      {group.rows.map((row) => (
        <PaymentRow key={row.key} row={row} {...actions} />
      ))}
      {group.rows.length === 0 && (
        <tr>
          <td
            colSpan={6}
            className="px-4 py-3 text-center text-xs text-slate-500"
          >
            {EMPTY_HINT}
          </td>
        </tr>
      )}
    </tbody>
  );
}

function AddCategory({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState<string | null>(null);
  if (name == null) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setName("")}>
        <Plus className="size-4" /> Přidat kategorii
      </Button>
    );
  }
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onAdd(trimmed);
    setName(null);
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <Input
        autoFocus
        aria-label="Název nové kategorie"
        placeholder="Název kategorie"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && setName(null)}
        className="w-full sm:w-64"
      />
      <Button type="submit" variant="primary" disabled={!name.trim()}>
        Přidat
      </Button>
      <Button onClick={() => setName(null)}>Zrušit</Button>
    </form>
  );
}

const SORT_COLUMNS: { by: SortBy; label: string; align?: "right" }[] = [
  { by: "due", label: "Splatnost" },
  { by: "amount", label: "Částka", align: "right" },
  { by: "status", label: "Stav" },
];

/** Záhlaví sloupce, které řadí platby v kategoriích; další klik obrátí směr. */
function SortHeader({
  by,
  label,
  align,
  sort,
  onSortChange,
}: (typeof SORT_COLUMNS)[number] & {
  sort: RowSort;
  onSortChange: (sort: RowSort) => void;
}) {
  const active = sort.by === by;
  const Arrow = sort.desc ? ArrowDown : ArrowUp;
  return (
    <th
      className={cn("px-2 py-2.5", align === "right" && "text-right")}
      aria-sort={active ? (sort.desc ? "descending" : "ascending") : undefined}
    >
      <button
        type="button"
        title="Seřadit platby v kategoriích"
        onClick={() => onSortChange({ by, desc: active ? !sort.desc : false })}
        className="inline-flex items-center gap-1 uppercase hover:text-brand-100"
      >
        {label}
        {active && <Arrow className="size-3.5" />}
      </button>
    </th>
  );
}

function groupsOf(props: ViewProps) {
  const { rows, allRows, categories, sort } = props;
  const used = new Set(allRows.map((row) => row.category));
  return groupByCategory(rows, categories)
    .map((group) => ({
      group: { ...group, rows: sortRows(group.rows, sort) },
      isEmpty: !used.has(group.category),
    }))
    .filter(({ group, isEmpty }) => group.rows.length > 0 || isEmpty);
}

type ViewProps = Omit<PaymentTableProps, "actions"> & { actions: RowActions };

function Cards(props: ViewProps) {
  const { title, actions } = props;
  const groups = groupsOf(props);
  return (
    <section>
      {/* Název ukazuje přepínač záložek nad seznamem. */}
      <h2 className="sr-only">{title}</h2>
      {groups.length === 0 && (
        <p className="rounded-xl bg-white p-4 text-center text-sm text-slate-500">
          Nic k zobrazení
        </p>
      )}
      {groups.map(({ group, isEmpty }) => (
        <CardGroup
          key={group.category}
          group={group}
          isEmpty={isEmpty}
          {...actions}
          onDeleteCategory={props.onDeleteCategory}
        />
      ))}
    </section>
  );
}

function Table(props: ViewProps) {
  const { title, actions, sort, onSortChange } = props;
  const groups = groupsOf(props);
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-brand-700 text-left text-xs font-semibold tracking-wide text-white uppercase">
            <th className="py-2.5 pr-2 pl-4">
              {sort.by === "own" ? (
                title
              ) : (
                <button
                  type="button"
                  title="Zpět na vlastní pořadí (přetahování)"
                  onClick={() => onSortChange({ by: "own", desc: false })}
                  className="uppercase hover:text-brand-100"
                >
                  {title} · vlastní pořadí
                </button>
              )}
            </th>
            <th className="px-2 py-2.5">Náš účet</th>
            {SORT_COLUMNS.map((column) => (
              <SortHeader
                key={column.by}
                {...column}
                sort={sort}
                onSortChange={onSortChange}
              />
            ))}
            <th className="py-2.5 pr-4 pl-2" />
          </tr>
        </thead>
        {groups.map(({ group, isEmpty }) => (
          <TableGroup
            key={group.category}
            group={group}
            isEmpty={isEmpty}
            {...actions}
            onDeleteCategory={props.onDeleteCategory}
          />
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

/** Na telefonu karty, od md tabulka (vykresluje se jen jedno – kvůli přetahování). */
export function PaymentTable(props: PaymentTableProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const view: ViewProps = {
    ...props,
    actions: { ...props.actions, canDrag: props.sort.by === "own" },
  };
  return (
    <div className="space-y-2">
      {isDesktop ? <Table {...view} /> : <Cards {...view} />}
      <AddCategory onAdd={props.onAddCategory} />
    </div>
  );
}
