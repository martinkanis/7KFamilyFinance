import type {
  Direction,
  EntryInput,
  MonthRow,
  MonthView,
  OneOffInput,
  PaymentStatus,
} from "@kkff/api/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { AccountBreakdown } from "@/components/month/AccountBreakdown";
import {
  DIRECTION_PANEL_ID,
  DirectionTabs,
  directionTabId,
} from "@/components/month/DirectionTabs";
import { EmptyMonth } from "@/components/month/EmptyMonth";
import { EntryDialog } from "@/components/month/EntryDialog";
import {
  type Filters,
  MonthToolbar,
  NO_ACCOUNT,
} from "@/components/month/MonthToolbar";
import { OneOffDialog } from "@/components/month/OneOffDialog";
import { PaymentTable } from "@/components/month/PaymentTable";
import { QrPayDialog } from "@/components/month/QrPayDialog";
import { SummaryCards } from "@/components/month/SummaryCards";
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
  entryInputOf,
  isPayable,
  itemEntryWithStatus,
  oneOffInputOf,
  oneOffWithStatus,
  rowWithChanges,
  withCategoryRenamed,
  withOptimisticStatus,
  withRow,
} from "@/lib/monthRows";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_SAVE_KEY = "month-save";

type Editing =
  | { kind: "entry"; row: MonthRow }
  | { kind: "oneOff"; row: MonthRow | null }
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

function saveItemEntry(month: string, row: MonthRow, input: EntryInput) {
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
  const [editing, setEditing] = useState<Editing>(null);
  const [qrQueue, setQrQueue] = useState<string[] | null>(null);
  const [invalidEdit, setInvalidEdit] = useState<string | null>(null);

  if (!isValidMonth) {
    return <Navigate to="/mesic/$month" params={{ month: currentMonth() }} />;
  }
  if (view.isPending) return <Loading />;
  if (view.error) return <ErrorMessage error={view.error} />;

  const rows = view.data.rows.filter((row) => matchesFilters(row, filters));
  const expenses = rows.filter((row) => row.direction === "expense");
  const incomes = rows.filter((row) => row.direction === "income");
  const payableKeys = expenses.filter(isPayable).map((row) => row.key);
  const categories = [...new Set(view.data.rows.map((row) => row.category))];
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

  const onSaveEntry = (row: MonthRow) => (input: EntryInput) =>
    save.mutate(() => saveItemEntry(month, row, input), {
      onSuccess: closeEditing,
    });

  const onSaveOneOff = (row: MonthRow | null) => (input: OneOffInput) =>
    save.mutate(() => saveOneOff(month, row, input), {
      onSuccess: closeEditing,
    });

  const onDeleteOneOff = (row: MonthRow) => {
    const { entryId } = row;
    if (
      entryId != null &&
      window.confirm(`Smazat jednorázovou platbu „${row.name}“?`)
    ) {
      save.mutate(() => api.deleteOneOff(month, entryId), {
        onSuccess: closeEditing,
      });
    }
  };

  const tableProps = {
    today: todayIso(),
    accounts: accounts.data ?? [],
    onChange: changeRow,
    onRename: renameRow,
    onRenameCategory: renameCategory,
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
      <SummaryCards summary={view.data.summary} />

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
          {direction === "expense" ? (
            <PaymentTable title="Výdaje" rows={expenses} {...tableProps} />
          ) : (
            <PaymentTable title="Příjmy" rows={incomes} {...tableProps} />
          )}
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
          accounts={accounts.data ?? []}
          counterparties={counterparties.data ?? []}
          categories={categories}
          isSaving={save.isPending}
          error={save.error}
          onSave={onSaveOneOff(editing.row)}
          onDelete={onDeleteOneOff}
          onClose={closeEditing}
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
