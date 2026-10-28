import { ACCOUNT_KIND_LABELS } from "@kkff/api/accountTypes";
import type {
  Account,
  AccountBalance,
  AccountKind,
  ExcelBalanceAssignment,
  ExcelBalanceBlock,
  ExcelBalanceRow,
} from "@kkff/api/contracts";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatMoney, monthLabel } from "@/lib/format";

/** Hodnoty výběru účtu kromě id: řádek vynechat, nebo pro něj založit účet. */
const SKIP = "";
const NEW_ACCOUNT = "new";
const ACCOUNT_KINDS: AccountKind[] = ["operating", "savings"];
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

interface Selection {
  blockIndex: number;
  month: string;
  targets: string[];
}

function selectionOf(blocks: ExcelBalanceBlock[], blockIndex: number) {
  const block = blocks[blockIndex];
  return {
    blockIndex,
    month: block?.month ?? "",
    targets: (block?.rows ?? []).map((row) =>
      row.suggestedAccountId == null ? SKIP : String(row.suggestedAccountId),
    ),
  };
}

function sumOf(rows: { balance: number }[]): number {
  return rows.reduce((sum, row) => sum + row.balance, 0);
}

function toAssignments(
  rows: ExcelBalanceRow[],
  targets: string[],
): ExcelBalanceAssignment[] {
  return rows.flatMap((row, index) => {
    const target = targets[index] ?? SKIP;
    if (target === SKIP) {
      return [];
    }
    return [
      {
        label: row.label,
        balance: row.balance,
        target: target === NEW_ACCOUNT ? "new" : Number(target),
      },
    ];
  });
}

interface RowAssignmentProps {
  row: ExcelBalanceRow;
  accounts: Account[];
  target: string;
  onChange: (target: string) => void;
}

function RowAssignment({
  row,
  accounts,
  target,
  onChange,
}: RowAssignmentProps) {
  return (
    <li
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_7rem_16rem]",
        target === SKIP && "bg-amber-50/70",
      )}
    >
      <span className="truncate font-medium" title={row.label}>
        {row.label}
      </span>
      <span className="text-right tabular-nums">
        {formatMoney(row.balance)}
      </span>
      <Select
        aria-label={`Účet pro ${row.label}`}
        value={target}
        onChange={(event) => onChange(event.target.value)}
        className="col-span-2 sm:col-span-1"
      >
        <option value={SKIP}>Nepřenášet</option>
        {ACCOUNT_KINDS.map((kind) => (
          <optgroup key={kind} label={`${ACCOUNT_KIND_LABELS[kind]} účty`}>
            {accounts
              .filter((account) => account.kind === kind)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </optgroup>
        ))}
        <option
          value={NEW_ACCOUNT}
        >{`+ Nový spořicí účet „${row.label}“`}</option>
      </Select>
    </li>
  );
}

interface ExcelBalancesDialogProps {
  accounts: Account[];
  onApplied: (month: string, balances: AccountBalance[]) => void;
  onClose: () => void;
}

/** Načte blok „Stávající stav“ z původního Excelu, nechá zkontrolovat účty a uloží. */
export function ExcelBalancesDialog({
  accounts,
  onApplied,
  onClose,
}: ExcelBalancesDialogProps) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const preview = useMutation({
    mutationFn: (file: File) => api.previewExcelBalances(file),
    onSuccess: (blocks) => setSelection(selectionOf(blocks, 0)),
  });
  const apply = useMutation({
    mutationFn: (input: {
      month: string;
      assignments: ExcelBalanceAssignment[];
    }) => api.applyExcelBalances(input.month, input.assignments),
    onSuccess: (balances, input) => onApplied(input.month, balances),
  });

  const blocks = preview.data ?? [];
  const block = selection ? blocks[selection.blockIndex] : undefined;
  const assignments =
    block && selection ? toAssignments(block.rows, selection.targets) : [];
  const month = selection?.month ?? "";
  const isMonthValid = MONTH_KEY.test(month);
  const canSave = assignments.length > 0 && isMonthValid && !apply.isPending;

  const setTarget = (index: number, target: string) => {
    if (selection) {
      setSelection({
        ...selection,
        targets: selection.targets.map((t, i) => (i === index ? target : t)),
      });
    }
  };

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title="Načíst stav z Excelu"
      footer={
        <>
          {block && (
            <span className="w-full text-sm text-slate-600 sm:mr-auto sm:w-auto">
              Vybráno {assignments.length} z {block.rows.length} ·{" "}
              <strong className="tabular-nums">
                {formatMoney(sumOf(assignments))}
              </strong>
            </span>
          )}
          <Button onClick={onClose}>Zrušit</Button>
          <Button
            variant="primary"
            disabled={!canSave}
            onClick={() => apply.mutate({ month, assignments })}
          >
            {apply.isPending
              ? "Ukládám…"
              : isMonthValid
                ? `Uložit za ${monthLabel(month).toLowerCase()}`
                : "Uložit"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Nahraj původní <strong>MonkeyBusiness.xlsx</strong>. Najdu v něm bloky
          „Stávající stav“ a k řádkům navrhnu účty – zkontroluj je a ulož.
        </p>
        <Input
          type="file"
          accept=".xlsx"
          aria-label="Soubor Excelu"
          className="h-auto py-2"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              preview.mutate(file);
            }
          }}
        />
        {preview.isPending && (
          <p className="text-sm text-slate-500">Čtu soubor…</p>
        )}
        {preview.error && <ErrorMessage error={preview.error} />}
        {block && selection && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Blok v Excelu">
                <Select
                  value={selection.blockIndex}
                  onChange={(event) =>
                    setSelection(
                      selectionOf(blocks, Number(event.target.value)),
                    )
                  }
                >
                  {blocks.map((candidate, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: bloky z jedné odpovědi se nepřeuspořádávají
                    <option key={index} value={index}>
                      {`${candidate.title} · ${formatMoney(sumOf(candidate.rows))}`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Uložit do měsíce"
                hint="Přepíšou se jen zůstatky vybraných účtů."
              >
                <Input
                  type="month"
                  value={month}
                  onChange={(event) =>
                    setSelection({ ...selection, month: event.target.value })
                  }
                />
              </Field>
            </div>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {block.rows.map((row, index) => (
                <RowAssignment
                  // biome-ignore lint/suspicious/noArrayIndexKey: popisky se v Excelu můžou opakovat, pořadí je pevné
                  key={`${selection.blockIndex}-${index}`}
                  row={row}
                  accounts={accounts}
                  target={selection.targets[index] ?? SKIP}
                  onChange={(target) => setTarget(index, target)}
                />
              ))}
            </ul>
          </>
        )}
        {apply.error && <ErrorMessage error={apply.error} />}
      </div>
    </Dialog>
  );
}
