import type {
  ChangeableField,
  Direction,
  EntryInput,
  ItemEntryInput,
  MonthRow,
  MonthView,
  OneOffInput,
  PaymentStatus,
} from "@kkff/api/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { AccountBreakdown } from "@/components/month/AccountBreakdown";
import { DeleteCategoryDialog } from "@/components/month/DeleteCategoryDialog";
import {
  DIRECTION_PANEL_ID,
  DirectionTabs,
  directionTabId,
} from "@/components/month/DirectionTabs";
import { EmptyMonth } from "@/components/month/EmptyMonth";
import { EntryDialog } from "@/components/month/EntryDialog";
import { ForwardOffer } from "@/components/month/ForwardOffer";
import {
  type DragData,
  type DropTarget,
  MonthDnd,
} from "@/components/month/MonthDnd";
import { MonthOverview } from "@/components/month/MonthOverview";
import {
  type Filters,
  MonthToolbar,
  NO_ACCOUNT,
} from "@/components/month/MonthToolbar";
import {
  OneOffDialog,
  type PaymentPreset,
} from "@/components/month/OneOffDialog";
import { PaymentTable } from "@/components/month/PaymentTable";
import { QrPayDialog } from "@/components/month/QrPayDialog";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, ErrorMessage, Loading, PageHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { operatingAccountsWith } from "@/lib/accounts";
import { api } from "@/lib/api";
import {
  addMonths,
  currentMonth,
  formatMoney,
  monthLabel,
  todayIso,
} from "@/lib/format";
import { parseOptionalNumber, textOrNull, toText } from "@/lib/formValues";
import {
  changedFieldsOf,
  copyOf,
  entryInputOf,
  isPayable,
  itemEntryWithStatus,
  moveCategory,
  moveRow,
  OWN_ORDER,
  oneOffInputOf,
  oneOffWithStatus,
  type RowSort,
  type RowTarget,
  rowWithChanges,
  withCategoryRenamed,
  withOptimisticStatus,
  withRow,
} from "@/lib/monthRows";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const SORT_STORAGE_KEY = "month-sort";
const SORT_KEYS = ["own", "due", "amount", "status"];

/** Řazení v kategoriích si prohlížeč pamatuje; bez úložiště vlastní pořadí. */
function loadSort(): RowSort {
  try {
    const stored = JSON.parse(localStorage.getItem(SORT_STORAGE_KEY) ?? "");
    if (SORT_KEYS.includes(stored?.by)) {
      return { by: stored.by, desc: stored.desc === true };
    }
  } catch {
    // poškozená nebo nedostupná hodnota – výchozí pořadí
  }
  return OWN_ORDER;
}

function storeSort(sort: RowSort): void {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sort));
  } catch {
    // úložiště nedostupné (anonymní okno) – řazení platí jen do obnovení
  }
}

/** Kam se puštěná platba položí: vedle řádku, nebo na začátek kategorie. */
function rowTargetOf(target: DropTarget): RowTarget {
  return target.data.type === "row"
    ? {
        category: target.data.row.category,
        anchorKey: target.data.row.key,
        after: target.after,
      }
    : { category: target.data.category, anchorKey: null, after: false };
}
const MONTH_SAVE_KEY = "month-save";

type Editing =
  | { kind: "entry"; row: MonthRow }
  | {
      kind: "oneOff";
      row: MonthRow | null;
      preset?: PaymentPreset;
      /** Kopie se po uložení položí hned pod tento řádek. */
      copyOfKey?: string;
    }
  | null;

function matchesFilters(row: MonthRow, filters: Filters): boolean {
  if (!filters.showZero && row.amount === 0 && row.entryId == null)
    return false;
  if (filters.onlyOpen && row.status === "paid") return false;
  if (filters.account === NO_ACCOUNT) return row.ourAccount == null;
  if (filters.account !== "")
    return String(row.ourAccount?.id) === filters.account;
  return true;
}

class MissingRowIdError extends Error {
  constructor(row: MonthRow) {
    super(`Řádek „${row.name}“ nemá položku ani záznam – obnov stránku`);
  }
}

function saveStatus(month: string, row: MonthRow, status: PaymentStatus) {
  const { entryId, itemId } = row;
  if (row.isOneOff && entryId != null) {
    return api.updateOneOff(month, entryId, oneOffWithStatus(row, status));
  }
  if (itemId != null) {
    return api.saveItemEntry(month, itemId, itemEntryWithStatus(row, status));
  }
  return Promise.reject(new MissingRowIdError(row));
}

/** Úprava měsíčních hodnot řádku přímo v tabulce. */
function saveRowChanges(
  month: string,
  row: MonthRow,
  changes: Partial<EntryInput>,
) {
  const { entryId } = row;
  if (row.isOneOff && entryId != null) {
    return api.updateOneOff(month, entryId, oneOffInputOf(row, changes));
  }
  return saveItemEntry(month, row, entryInputOf(row, changes));
}

/** Název pravidelné položky patří položce, takže se změní ve všech měsících. */
async function saveRowName(month: string, row: MonthRow, name: string) {
  const { entryId, itemId } = row;
  if (row.isOneOff && entryId != null) {
    return api.updateOneOff(month, entryId, oneOffInputOf(row, { name }));
  }
  if (itemId == null) throw new MissingRowIdError(row);
  await api.renameItem(itemId, { name });
  return api.month(month);
}

function deleteQuestion(month: string, row: MonthRow): string {
  return row.isOneOff
    ? `Smazat jednorázovou platbu „${row.name}“?`
    : `Ukončit pravidelnou platbu „${row.name}“ od měsíce ${monthLabel(month)}?\n\n` +
        "V tomto a dalších měsících už nebude, minulé měsíce zůstanou beze změny.";
}

/** Jednorázová platba se smaže, pravidelná položka od tohoto měsíce skončí. */
function removeRow(month: string, row: MonthRow) {
  const { entryId, itemId } = row;
  if (row.isOneOff && entryId != null) {
    return api.deleteOneOff(month, entryId);
  }
  return itemId != null
    ? api.endItem(month, itemId)
    : Promise.reject(new MissingRowIdError(row));
}

function saveItemEntry(month: string, row: MonthRow, input: ItemEntryInput) {
  const { itemId } = row;
  return itemId != null
    ? api.saveItemEntry(month, itemId, input)
    : Promise.reject(new MissingRowIdError(row));
}

function saveOneOff(month: string, row: MonthRow | null, input: OneOffInput) {
  const entryId = row?.entryId;
  return entryId != null
    ? api.updateOneOff(month, entryId, input)
    : api.createOneOff(month, input);
}

/**
 * Uložení s čerstvým pohledem na měsíc. Při rychlém klikání by starší odpověď
 * přepsala novější stav, proto se data převezmou až od poslední rozpracované
 * změny (a když se mezitím nějaká odpověď přeskočila, měsíc se načte znovu).
 */
function useMonthMutation(month: string) {
  const queryClient = useQueryClient();
  const skippedResponse = useRef(false);
  const mutationKey = [MONTH_SAVE_KEY, month];
  return useMutation({
    mutationKey,
    mutationFn: (save: () => Promise<MonthView>) => save(),
    onSuccess: (view) => {
      const isLastPending = queryClient.isMutating({ mutationKey }) <= 1;
      if (!isLastPending) {
        skippedResponse.current = true;
      } else if (skippedResponse.current) {
        skippedResponse.current = false;
        void queryClient.invalidateQueries({ queryKey: ["month", month] });
      } else {
        queryClient.setQueryData(["month", month], view);
      }
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: () =>
      void queryClient.invalidateQueries({ queryKey: ["month", month] }),
  });
}

const NAV_BUTTON = buttonClasses({ size: "sm" });

function MonthNavigation({ month }: { month: string }) {
  return (
    <div className="flex items-center gap-1">
      <Link
        to="/mesic/$month"
        params={{ month: addMonths(month, -1) }}
        className={NAV_BUTTON}
        title="Předchozí měsíc"
      >
        <ChevronLeft className="size-4" />
      </Link>
      <Link
        to="/mesic/$month"
        params={{ month: currentMonth() }}
        className={NAV_BUTTON}
      >
        Tento měsíc
      </Link>
      <Link
        to="/mesic/$month"
        params={{ month: addMonths(month, 1) }}
        className={NAV_BUTTON}
        title="Další měsíc"
      >
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}

function CorrectionCard({
  view,
  onSave,
  isSaving,
}: {
  view: MonthView;
  onSave: (amount: number, note: string | null) => void;
  isSaving: boolean;
}) {
  const [amount, setAmount] = useState(toText(view.correction.amount || null));
  const [note, setNote] = useState(toText(view.correction.note));
  const [error, setError] = useState<string | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseOptionalNumber(amount, "Korekce");
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    onSave(parsed.value ?? 0, textOrNull(note));
  };
  return (
    <Card className="p-4">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <Field
          label="Korekce majetku (výnosy, přecenění…)"
          className="w-full sm:w-56"
        >
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </Field>
        <Field label="Poznámka" className="min-w-48 flex-1">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button type="submit" disabled={isSaving}>
          Uložit korekci
        </Button>
      </form>
      {error && (
        <div className="mt-2">
          <ErrorMessage error={new Error(error)} />
        </div>
      )}
    </Card>
  );
}

export function MonthPage() {
  const { month } = useParams({ from: "/mesic/$month" });
  const isValidMonth = MONTH_PATTERN.test(month);
  const view = useQuery({
    queryKey: ["month", month],
    queryFn: () => api.month(month),
    enabled: isValidMonth,
  });
  // Minulý měsíc jen pro porovnání v přehledu nahoře.
  const previousMonth = addMonths(month, -1);
  const previousView = useQuery({
    queryKey: ["month", previousMonth],
    queryFn: () => api.month(previousMonth),
    enabled: isValidMonth,
  });
  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.list("accounts"),
  });
  const counterparties = useQuery({
    queryKey: ["counterparties"],
    queryFn: () => api.list("counterparties"),
  });
  const queryClient = useQueryClient();
  const save = useMonthMutation(month);
  const [filters, setFilters] = useState<Filters>({
    showZero: false,
    onlyOpen: false,
    account: "",
  });
  const [direction, setDirection] = useState<Direction>("expense");
  const [sort, setSortState] = useState<RowSort>(loadSort);
  const setSort = (next: RowSort) => {
    setSortState(next);
    storeSort(next);
  };
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [qrQueue, setQrQueue] = useState<string[] | null>(null);
  const [invalidEdit, setInvalidEdit] = useState<string | null>(null);
  const [forwardOffer, setForwardOffer] = useState<{
    id: number;
    rowKey: string;
    name: string;
    fields: ChangeableField[];
  } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: nabídka patří k měsíci, při přechodu jinam zmizí
  useEffect(() => setForwardOffer(null), [month]);

  if (!isValidMonth) {
    return <Navigate to="/mesic/$month" params={{ month: currentMonth() }} />;
  }
  if (view.isPending) return <Loading />;
  if (view.error) return <ErrorMessage error={view.error} />;

  const rows = view.data.rows.filter((row) => matchesFilters(row, filters));
  const expenses = rows.filter((row) => row.direction === "expense");
  const incomes = rows.filter((row) => row.direction === "income");
  const payableKeys = expenses.filter(isPayable).map((row) => row.key);
  const categories = [
    ...new Set(view.data.categories.map((category) => category.name)),
  ];
  const categoriesOf = (d: Direction) =>
    view.data.categories.filter((c) => c.direction === d).map((c) => c.name);
  const filterAccounts = operatingAccountsWith(
    accounts.data ?? [],
    view.data.rows.map((row) => row.ourAccount?.id),
  );
  const closeEditing = () => {
    save.reset();
    setEditing(null);
  };

  const updateView = (update: (current: MonthView) => MonthView) =>
    queryClient.setQueryData<MonthView>(
      ["month", month],
      (current) => current && update(current),
    );

  const changeStatus = (row: MonthRow, status: PaymentStatus) => {
    updateView((current) =>
      withOptimisticStatus(current, row.key, status, todayIso()),
    );
    return save.mutateAsync(() => saveStatus(month, row, status));
  };

  // Název a kategorie se mění ve všech měsících – ostatní se načtou znovu.
  const refreshOtherMonths = () => {
    void queryClient.invalidateQueries({
      queryKey: ["month"],
      predicate: (query) => query.queryKey[1] !== month,
    });
    void queryClient.invalidateQueries({ queryKey: ["items"] });
  };

  const changeRow = (row: MonthRow, changes: Partial<EntryInput>) => {
    setInvalidEdit(null);
    const ourAccount =
      changes.ourAccountId == null
        ? undefined
        : (accounts.data ?? []).find((a) => a.id === changes.ourAccountId);
    updateView((current) =>
      withRow(current, row.key, (r) =>
        rowWithChanges(r, month, changes, ourAccount),
      ),
    );
    save.mutate(() => saveRowChanges(month, row, changes));
    const fields = changedFieldsOf(changes);
    if (!row.isOneOff && fields.length > 0) {
      setForwardOffer({
        id: Date.now(),
        rowKey: row.key,
        name: row.name,
        fields,
      });
    }
  };

  /** Úprava z tabulky platí i pro další měsíce – stane se změnou položky. */
  const applyForward = () => {
    const offer = forwardOffer;
    setForwardOffer(null);
    const row = offer && view.data.rows.find((r) => r.key === offer.rowKey);
    if (!offer || !row) return;
    save.mutate(async () => {
      const updated = await saveItemEntry(month, row, {
        ...entryInputOf(row),
        promote: offer.fields,
      });
      refreshOtherMonths();
      return updated;
    });
  };

  const renameRow = (row: MonthRow, name: string) => {
    setInvalidEdit(null);
    updateView((current) => withRow(current, row.key, (r) => ({ ...r, name })));
    save.mutate(async () => {
      const view = await saveRowName(month, row, name);
      if (!row.isOneOff) refreshOtherMonths();
      return view;
    });
  };

  const renameCategory = (from: string, to: string) => {
    setInvalidEdit(null);
    updateView((current) => withCategoryRenamed(current, direction, from, to));
    save.mutate(async () => {
      await api.renameCategory({ direction, from, to });
      refreshOtherMonths();
      return api.month(month);
    });
  };

  const onSaveEntry =
    (row: MonthRow) => (input: EntryInput, forward: boolean) =>
      save.mutate(
        async () => {
          const promote = forward ? changedFieldsOf(input) : [];
          const updated = await saveItemEntry(month, row, {
            ...input,
            promote,
          });
          if (promote.length > 0) refreshOtherMonths();
          return updated;
        },
        { onSuccess: closeEditing },
      );

  /** Kopii položí hned pod originál (nová platba je jinak na konci kategorie). */
  const placeAfter = async (
    before: MonthView,
    after: MonthView,
    originalKey: string,
  ): Promise<MonthView> => {
    const known = new Set(before.rows.map((r) => r.key));
    const created = after.rows.find((r) => !known.has(r.key));
    const original = after.rows.find((r) => r.key === originalKey);
    if (!created || !original || created.category !== original.category) {
      return after;
    }
    const moved = moveRow(after.rows, created.key, {
      category: original.category,
      anchorKey: original.key,
      after: true,
    });
    return moved
      ? api.reorderRows(month, {
          direction: created.direction,
          name: created.category,
          rows: moved.categoryRows,
        })
      : after;
  };

  const onSaveOneOff =
    (row: MonthRow | null, copyOfKey?: string) =>
    (input: OneOffInput, recurring: boolean) =>
      save.mutate(
        async () => {
          const before = view.data;
          let updated = recurring
            ? await api.createRecurring(month, input)
            : await saveOneOff(month, row, input);
          if (copyOfKey) updated = await placeAfter(before, updated, copyOfKey);
          if (recurring) refreshOtherMonths();
          return updated;
        },
        { onSuccess: closeEditing },
      );

  const duplicateRow = (row: MonthRow) =>
    setEditing({
      kind: "oneOff",
      row: null,
      preset: { ...copyOf(row), title: `Kopie platby „${row.name}“` },
      copyOfKey: row.key,
    });

  const deleteRow = (row: MonthRow) => {
    if (!window.confirm(deleteQuestion(month, row))) return;
    setInvalidEdit(null);
    updateView((current) => ({
      ...current,
      rows: current.rows.filter((r) => r.key !== row.key),
    }));
    save.mutate(
      async () => {
        const view = await removeRow(month, row);
        if (!row.isOneOff) refreshOtherMonths();
        return view;
      },
      { onSuccess: closeEditing },
    );
  };

  /** Uloží změnu pořadí/kategorií a načte měsíc znovu; pořadí platí ve všech měsících. */
  const saveLayout = (request: () => Promise<unknown>) =>
    save.mutate(async () => {
      await request();
      refreshOtherMonths();
      return api.month(month);
    });

  const onDrop = (dragged: DragData, target: DropTarget) => {
    setInvalidEdit(null);
    if (dragged.type === "row") {
      const rowTarget = rowTargetOf(target);
      const moved = moveRow(view.data.rows, dragged.row.key, rowTarget);
      if (!moved) return;
      updateView((current) => ({ ...current, rows: moved.rows }));
      saveLayout(() =>
        api.reorderRows(month, {
          direction: dragged.row.direction,
          name: rowTarget.category,
          rows: moved.categoryRows,
        }),
      );
      return;
    }
    if (target.data.type !== "category") return;
    const names = moveCategory(
      categoriesOf(direction),
      dragged.category,
      target.data.category,
      target.after,
    );
    if (!names) return;
    updateView((current) => ({
      ...current,
      categories: [
        ...current.categories.filter((c) => c.direction !== direction),
        ...names.map((name) => ({ direction, name })),
      ],
    }));
    saveLayout(() => api.orderCategories({ direction, names }));
  };

  const addCategory = (name: string) => {
    setInvalidEdit(null);
    if (categoriesOf(direction).includes(name)) {
      setInvalidEdit(`Kategorie „${name}“ už existuje`);
      return;
    }
    updateView((current) => ({
      ...current,
      categories: [...current.categories, { direction, name }],
    }));
    saveLayout(() => api.addCategory({ direction, name }));
  };

  const removeCategory = (name: string, moveTo: string | null) => {
    setDeletingCategory(null);
    updateView((current) => ({
      ...current,
      categories: current.categories.filter(
        (c) => !(c.direction === direction && c.name === name),
      ),
      rows: current.rows.map((row) =>
        moveTo && row.direction === direction && row.category === name
          ? { ...row, category: moveTo }
          : row,
      ),
    }));
    saveLayout(() => api.deleteCategory({ direction, name, moveTo }));
  };

  const deleteCategory = (name: string, isEmpty: boolean) => {
    setInvalidEdit(null);
    if (!isEmpty) {
      setDeletingCategory(name);
    } else if (window.confirm(`Smazat prázdnou kategorii „${name}“?`)) {
      removeCategory(name, null);
    }
  };

  const tableProps = {
    today: todayIso(),
    accounts: accounts.data ?? [],
    onChange: changeRow,
    onRename: renameRow,
    onRenameCategory: renameCategory,
    onDelete: deleteRow,
    onDuplicate: duplicateRow,
    onInvalid: setInvalidEdit,
    onStatus: (row: MonthRow, status: PaymentStatus) =>
      void changeStatus(row, status),
    onEdit: (row: MonthRow) =>
      setEditing(
        row.isOneOff ? { kind: "oneOff", row } : { kind: "entry", row },
      ),
    onQr: (row: MonthRow) =>
      setQrQueue([row.key, ...payableKeys.filter((key) => key !== row.key)]),
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={monthLabel(month)}
        description={`Zbývá zaplatit ${formatMoney(view.data.summary.expense.remaining)} · ještě má přijít ${formatMoney(view.data.summary.income.remaining)}`}
        actions={<MonthNavigation month={month} />}
      />
      <MonthOverview
        view={view.data}
        previous={previousView.data}
        direction={direction}
      />

      {view.data.rows.length === 0 ? (
        <EmptyMonth />
      ) : (
        <MonthToolbar
          payableCount={payableKeys.length}
          filters={filters}
          accounts={filterAccounts}
          onFiltersChange={setFilters}
          onPayByQr={() => setQrQueue(payableKeys)}
          onAddOneOff={() => setEditing({ kind: "oneOff", row: null })}
          sort={sort}
          onSortChange={setSort}
        />
      )}

      <div className="space-y-3">
        <DirectionTabs
          value={direction}
          summary={view.data.summary}
          onChange={setDirection}
        />
        {invalidEdit && <ErrorMessage error={new Error(invalidEdit)} />}
        {save.error && !editing && <ErrorMessage error={save.error} />}
        <div
          role="tabpanel"
          id={DIRECTION_PANEL_ID}
          aria-labelledby={directionTabId(direction)}
        >
          <MonthDnd onDrop={onDrop}>
            <PaymentTable
              title={direction === "expense" ? "Výdaje" : "Příjmy"}
              rows={direction === "expense" ? expenses : incomes}
              allRows={view.data.rows.filter((r) => r.direction === direction)}
              categories={categoriesOf(direction)}
              actions={tableProps}
              sort={sort}
              onSortChange={setSort}
              onAddCategory={addCategory}
              onAddPayment={(category) =>
                setEditing({
                  kind: "oneOff",
                  row: null,
                  preset: { direction, category },
                })
              }
              onDeleteCategory={deleteCategory}
            />
          </MonthDnd>
        </div>
      </div>
      <AccountBreakdown rows={view.data.accounts} />
      <CorrectionCard
        key={month}
        view={view.data}
        isSaving={save.isPending}
        onSave={(amount, note) =>
          save.mutate(() => api.saveCorrection(month, { amount, note }))
        }
      />

      {editing?.kind === "entry" && (
        <EntryDialog
          row={editing.row}
          accounts={accounts.data ?? []}
          isSaving={save.isPending}
          error={save.error}
          onSave={onSaveEntry(editing.row)}
          onClose={closeEditing}
        />
      )}
      {editing?.kind === "oneOff" && (
        <OneOffDialog
          row={editing.row}
          preset={editing.preset}
          accounts={accounts.data ?? []}
          counterparties={counterparties.data ?? []}
          categories={categories}
          isSaving={save.isPending}
          error={save.error}
          onSave={onSaveOneOff(editing.row, editing.copyOfKey)}
          onDelete={deleteRow}
          onClose={closeEditing}
        />
      )}
      {deletingCategory != null && (
        <DeleteCategoryDialog
          category={deletingCategory}
          paymentCount={
            view.data.rows.filter(
              (r) =>
                r.direction === direction && r.category === deletingCategory,
            ).length
          }
          others={categoriesOf(direction).filter((c) => c !== deletingCategory)}
          onConfirm={(moveTo) => removeCategory(deletingCategory, moveTo)}
          onClose={() => setDeletingCategory(null)}
        />
      )}
      {forwardOffer && (
        <ForwardOffer
          offerKey={String(forwardOffer.id)}
          month={month}
          name={forwardOffer.name}
          disabled={save.isPending}
          onApply={applyForward}
          onDismiss={() => setForwardOffer(null)}
        />
      )}
      {qrQueue && (
        <QrPayDialog
          queue={qrQueue}
          rows={view.data.rows}
          isSaving={save.isPending}
          onStatus={changeStatus}
          onClose={() => setQrQueue(null)}
        />
      )}
    </div>
  );
}
