import type {
  Account,
  EntryInput,
  MonthRow,
  PaymentStatus,
} from "@kkff/api/contracts";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { operatingAccountsWith } from "@/lib/accounts";
import { formatMoney, STATUS_LABELS } from "@/lib/format";
import {
  idOrNull,
  parseOptionalDay,
  parseOptionalNumber,
  textOrNull,
  toText,
} from "@/lib/formValues";
import { AccountOptions, StatusOptions } from "./options";

interface EntryDialogProps {
  row: MonthRow;
  accounts: Account[];
  isSaving: boolean;
  error: unknown;
  /** `forward` = vyplněné hodnoty platí i pro další měsíce (změna položky). */
  onSave: (input: EntryInput, forward: boolean) => void;
  onClose: () => void;
}

function initialForm(row: MonthRow) {
  return {
    status: row.status,
    paidOn: toText(row.paidOn),
    note: toText(row.note),
    amount: toText(row.overrides.amount),
    dueDay: toText(row.overrides.dueDay),
    ourAccountId: toText(row.overrides.ourAccountId),
    counterpartyAccount: toText(row.overrides.counterpartyAccount),
    vs: toText(row.overrides.vs),
  };
}

type EntryForm = ReturnType<typeof initialForm>;

function toEntryInput(form: EntryForm): EntryInput | string {
  const amount = parseOptionalNumber(form.amount, "Částka");
  const dueDay = parseOptionalDay(form.dueDay);
  if (!amount.ok) return amount.error;
  if (!dueDay.ok) return dueDay.error;
  return {
    status: form.status,
    paidOn: textOrNull(form.paidOn),
    note: textOrNull(form.note),
    amount: amount.value,
    dueDay: dueDay.value,
    ourAccountId: idOrNull(form.ourAccountId),
    counterpartyAccount: textOrNull(form.counterpartyAccount),
    vs: textOrNull(form.vs),
  };
}

function amountHint(row: MonthRow): string {
  if (row.overrides.amount != null) {
    return "Přepsáno – smaž pro výchozí z položky";
  }
  return row.isScheduled
    ? `Výchozí ${formatMoney(row.amount)}`
    : "Tento měsíc podle plánu není splatná (0 Kč)";
}

/** Přepsání položky jen pro tento měsíc; prázdné pole = výchozí hodnota z Položek. */
export function EntryDialog({
  row,
  accounts,
  isSaving,
  error,
  onSave,
  onClose,
}: EntryDialogProps) {
  const [form, setForm] = useState(() => initialForm(row));
  const [formError, setFormError] = useState<string | null>(null);
  const [forward, setForward] = useState(false);
  const set = (field: keyof EntryForm) => (value: string) =>
    setForm({ ...form, [field]: value });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const input = toEntryInput(form);
    if (typeof input === "string") {
      setFormError(input);
      return;
    }
    onSave(input, forward);
  };

  const shownError = formError ? new Error(formError) : error;
  const resetOverrides = () =>
    setForm({
      ...form,
      amount: "",
      dueDay: "",
      ourAccountId: "",
      counterpartyAccount: "",
      vs: "",
    });

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${row.code ?? ""} ${row.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={resetOverrides}>
            Vrátit výchozí
          </Button>
          <div className="flex-1" />
          <Button onClick={onClose}>Zrušit</Button>
          <Button
            variant="primary"
            type="submit"
            form="entry-form"
            disabled={isSaving}
          >
            Uložit
          </Button>
        </>
      }
    >
      <form
        id="entry-form"
        onSubmit={submit}
        className="grid gap-4 sm:grid-cols-2"
      >
        <Field label="Stav">
          <Select
            value={form.status}
            onChange={(e) => set("status")(e.target.value as PaymentStatus)}
          >
            <StatusOptions />
          </Select>
        </Field>
        <Field
          label="Uhrazeno dne"
          hint={
            form.status === "paid"
              ? "Prázdné = dnes"
              : `Jen u stavu ${STATUS_LABELS.paid}`
          }
        >
          <Input
            type="date"
            value={form.paidOn}
            disabled={form.status !== "paid"}
            onChange={(e) => set("paidOn")(e.target.value)}
          />
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-slate-700">
            Částka, splatnost, účty a VS platí
          </legend>
          <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="entry-scope"
                checked={!forward}
                onChange={() => setForward(false)}
              />
              jen pro tento měsíc
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="entry-scope"
                checked={forward}
                onChange={() => setForward(true)}
              />
              od tohoto měsíce dál
            </label>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {forward
              ? "Vyplněné hodnoty se uloží do položky od tohoto měsíce dál; minulé měsíce ani ručně upravené další měsíce se nezmění."
              : "Prázdné pole = výchozí hodnota z položky (šablony)."}
          </p>
        </fieldset>
        <Field label="Částka" hint={amountHint(row)}>
          <Input
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => set("amount")(e.target.value)}
          />
        </Field>
        <Field label="Den splatnosti">
          <Input
            inputMode="numeric"
            value={form.dueDay}
            onChange={(e) => set("dueDay")(e.target.value)}
          />
        </Field>
        <Field label="Náš účet">
          <Select
            value={form.ourAccountId}
            onChange={(e) => set("ourAccountId")(e.target.value)}
          >
            <option value="">— výchozí —</option>
            <AccountOptions
              accounts={operatingAccountsWith(accounts, [
                row.overrides.ourAccountId,
              ])}
            />
          </Select>
        </Field>
        <Field
          label="Účet protistrany"
          hint={
            row.overrides.counterpartyAccount
              ? undefined
              : `Výchozí ${row.counterpartyAccount ?? "–"}`
          }
        >
          <Input
            value={form.counterpartyAccount}
            onChange={(e) => set("counterpartyAccount")(e.target.value)}
          />
        </Field>
        <Field
          label="VS"
          hint={row.overrides.vs ? undefined : `Výchozí ${row.vs ?? "–"}`}
        >
          <Input
            inputMode="numeric"
            value={form.vs}
            onChange={(e) => set("vs")(e.target.value)}
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
