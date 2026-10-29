import type { Account, ItemChange, ItemWithChanges } from "@kkff/api/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ErrorMessage } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { api } from "@/lib/api";
import { formatMoney, monthLabel } from "@/lib/format";

function describe(change: ItemChange, accountNames: Map<number, string>) {
  return [
    change.amount != null && formatMoney(change.amount),
    change.dueDay != null && `splatnost ${change.dueDay}.`,
    change.ourAccountId != null &&
      (accountNames.get(change.ourAccountId) ?? "účet"),
    change.counterpartyAccount &&
      `účet protistrany ${change.counterpartyAccount}`,
    change.vs && `VS ${change.vs}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Změny položky od měsíce dál; smazáním se od toho měsíce vrátí předchozí hodnoty. */
export function ItemChanges({
  item,
  accounts,
  onChanged,
}: {
  item: ItemWithChanges;
  accounts: Account[];
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (changeId: number) => api.deleteItemChange(item.id, changeId),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onChanged();
    },
  });
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  const confirmRemove = (change: ItemChange) => {
    const question =
      `Smazat změnu od měsíce ${monthLabel(change.fromMonth)}?\n\n` +
      "Od toho měsíce budou platit předchozí hodnoty.";
    if (window.confirm(question)) remove.mutate(change.id);
  };
  return (
    <section className="mt-5 border-t border-slate-100 pt-4">
      <h3 className="text-sm font-semibold text-slate-700">Změny od měsíce</h3>
      {item.changes.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">
          Zatím žádné – ve všech měsících platí stejné hodnoty.
        </p>
      ) : (
        <ul className="mt-1 divide-y divide-slate-100">
          {item.changes.map((change) => (
            <li
              key={change.id}
              className="flex items-center justify-between gap-2 py-1 text-sm"
            >
              <span>
                <span className="font-medium">
                  od {monthLabel(change.fromMonth)}
                </span>
                : {describe(change, accountNames)}
              </span>
              <DeleteButton
                label={`Smazat změnu od ${monthLabel(change.fromMonth)}`}
                disabled={remove.isPending}
                onDelete={() => confirmRemove(change)}
              />
            </li>
          ))}
        </ul>
      )}
      {remove.error && <ErrorMessage error={remove.error} />}
    </section>
  );
}
