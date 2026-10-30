import type {
  Account,
  Counterparty,
  Direction,
  MonthRow,
  OneOffInput,
  PaymentStatus,
} from "@kkff/api/contracts";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { operatingAccountsWith } from "@/lib/accounts";
import {
  idOrNull,
  parseOptionalDay,
  parseOptionalNumber,
  textOrNull,
  toText,
} from "@/lib/formValues";
import { AccountOptions, CounterpartyOptions, StatusOptions } from "./options";

/** Předvyplnění nové platby („+“ u kategorie, nebo kopie jiné platby). */
export interface PaymentPreset extends Partial<Omit<OneOffInput, "status">> {
  direction: Direction;
  category: string;
  recurring?: boolean;
  title?: string;
}

interface OneOffDialogProps {
  row: MonthRow | null;
  preset?: PaymentPreset;
  accounts: Account[];
  counterparties: Counterparty[];
  categories: string[];
  isSaving: boolean;
  error: unknown;
  /** `recurring` = nová pravidelná platba od tohoto měsíce (jen u nové). */
  onSave: (input: OneOffInput, recurring: boolean) => void;
  onDelete: (row: MonthRow) => void;
  onClose: () => void;
}

function initialForm(row: MonthRow | null, preset?: PaymentPreset) {
  return {
    direction: row?.direction ?? preset?.direction ?? ("expense" as Direction),
    category: row?.category ?? preset?.category ?? "",
    name: row?.name ?? preset?.name ?? "",
    amount: toText(row?.amount ?? preset?.amount),
    counterpartyId: toText(row?.counterparty?.id ?? preset?.counterpartyId),
    ourAccountId: toText(row?.overrides.ourAccountId ?? preset?.ourAccountId),
    counterpartyAccount: toText(
      row?.overrides.counterpartyAccount ?? preset?.counterpartyAccount,
    ),
    vs: toText(row?.overrides.vs ?? preset?.vs),
    dueDay: toText(row?.overrides.dueDay ?? preset?.dueDay),
    status: row?.status ?? ("unpaid" as PaymentStatus),
    paidOn: toText(row?.paidOn),
    note: toText(row?.note ?? preset?.note),
  };
}

type OneOffForm = ReturnType<typeof initialForm>;

function toOneOffInput(form: OneOffForm): OneOffInput | string {
  const amount = parseOptionalNumber(form.amount, "Částka");
  const dueDay = parseOptionalDay(form.dueDay);
  if (!amount.ok) return amount.error;
  if (!dueDay.ok) return dueDay.error;
  const name = textOrNull(form.name);
  const category = textOrNull(form.category);
  if (!name || !category || amount.value == null) {
    return "Vyplň název, kategorii a částku";
  }
  return {
    direction: form.direction,
    category,
    name,
    amount: amount.value,
    counterpartyId: idOrNull(form.counterpartyId),
    ourAccountId: idOrNull(form.ourAccountId),
    counterpartyAccount: textOrNull(form.counterpartyAccount),
    vs: textOrNull(form.vs),
    dueDay: dueDay.value,
    status: form.status,
    paidOn: textOrNull(form.paidOn),
    note: textOrNull(form.note),
  };
}

export function OneOffDialog({
  row,
  preset,
  accounts,
  counterparties,
  categories,
  isSaving,
  error,
  onSave,
  onDelete,
  onClose,
}: OneOffDialogProps) {
  const [form, setForm] = useState(() => initialForm(row, preset));
  const [recurring, setRecurring] = useState(preset?.recurring ?? false);
  const [formError, setFormError] = useState<string | null>(null);
  const set = (field: keyof OneOffForm) => (value: string) =>
    setForm({ ...form, [field]: value });

  const shownError = formError ? new Error(formError) : error;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const input = toOneOffInput(form);
    if (typeof input === "string") {
      setFormError(input);
      return;
    }
    onSave(input, row == null && recurring);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={row ? "Jednorázová platba" : (preset?.title ?? "Nová platba")}
      footer={
        <>
          {row && (
            <Button
              variant="danger"
              disabled={isSaving}
              onClick={() => onDelete(row)}
            >
              Smazat
            </Button>
          )}
          <div className="flex-1" />
          <Button onClick={onClose}>Zrušit</Button>
          <Button
            variant="primary"
            type="submit"
            form="one-off-form"
            disabled={isSaving}
          >
            Uložit
          </Button>
        </>
      }
    >
      <form
        id="one-off-form"
        onSubmit={submit}
        className="grid gap-4 sm:grid-cols-2"
      >
        {row == null && (
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium text-slate-700">
              Platba je
            </legend>
            <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="payment-kind"
                  checked={!recurring}
                  onChange={() => setRecurring(false)}
                />
                jednorázová – jen tento měsíc
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="payment-kind"
                  checked={recurring}
                  onChange={() => setRecurring(true)}
                />
                pravidelná – každý měsíc od tohoto
              </label>
            </div>
            {recurring && (
              <p className="mt-1 text-xs text-slate-500">
                Založí se položka (najdeš ji v Položkách), měsíce splatnosti a
                další údaje jdou upravit tam.
              </p>
            )}
          </fieldset>
        )}
        <Field label="Směr">
          <Select
            value={form.direction}
            onChange={(e) => set("direction")(e.target.value as Direction)}
          >
            <option value="expense">Výdaj</option>
            <option value="income">Příjem</option>
          </Select>
        </Field>
        <Field label="Kategorie">
          <Input
            list="one-off-categories"
            value={form.category}
            onChange={(e) => set("category")(e.target.value)}
            required
          />
          <datalist id="one-off-categories">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </Field>
        <Field label="Název" className="sm:col-span-2">
          <Input
            value={form.name}
            onChange={(e) => set("name")(e.target.value)}
            required
          />
        </Field>
        <Field label="Částka">
          <Input
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => set("amount")(e.target.value)}
            required
          />
        </Field>
        <Field label="Den splatnosti">
          <Input
            inputMode="numeric"
            value={form.dueDay}
            onChange={(e) => set("dueDay")(e.target.value)}
          />
        </Field>
        <Field label="Protistrana">
          <Select
            value={form.counterpartyId}
            onChange={(e) => set("counterpartyId")(e.target.value)}
          >
            <option value="">—</option>
            <CounterpartyOptions counterparties={counterparties} />
          </Select>
        </Field>
        <Field label="Náš účet">
          <Select
            value={form.ourAccountId}
            onChange={(e) => set("ourAccountId")(e.target.value)}
          >
            <option value="">—</option>
            <AccountOptions
              accounts={operatingAccountsWith(accounts, [
                row?.overrides.ourAccountId,
              ])}
            />
          </Select>
        </Field>
        <Field
          label="Účet protistrany"
          hint="Prázdné = účet vybrané protistrany"
        >
          <Input
            value={form.counterpartyAccount}
            onChange={(e) => set("counterpartyAccount")(e.target.value)}
          />
        </Field>
        <Field label="VS">
          <Input
            inputMode="numeric"
            value={form.vs}
            onChange={(e) => set("vs")(e.target.value)}
          />
        </Field>
        <Field label="Stav">
          <Select
            value={form.status}
            onChange={(e) => set("status")(e.target.value as PaymentStatus)}
          >
            <StatusOptions />
          </Select>
        </Field>
        <Field label="Uhrazeno dne" hint="Prázdné = dnes">
          <Input
            type="date"
            value={form.paidOn}
            disabled={form.status !== "paid"}
            onChange={(e) => set("paidOn")(e.target.value)}
          />
        </Field>
        <Field label="Poznámka" className="sm:col-span-2">
          <Textarea
            value={form.note}
            onChange={(e) => set("note")(e.target.value)}
          />
        </Field>
        {shownError != null && (
          <div className="sm:col-span-2">
            <ErrorMessage error={shownError} />
          </div>
        )}
      </form>
    </Dialog>
  );
}
