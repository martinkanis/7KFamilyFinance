import type { Account, Counterparty, PaymentStatus } from "@kkff/api/contracts";
import { STATUS_LABELS } from "@/lib/format";

const STATUSES: PaymentStatus[] = ["unpaid", "processing", "paid"];

export function StatusOptions() {
  return STATUSES.map((status) => (
    <option key={status} value={status}>
      {STATUS_LABELS[status]}
    </option>
  ));
}

export function AccountOptions({ accounts }: { accounts: Account[] }) {
  return accounts.map((account) => (
    <option key={account.id} value={account.id}>
      {account.name}
      {account.owner ? ` (${account.owner})` : ""}
    </option>
  ));
}

export function CounterpartyOptions({
  counterparties,
}: {
  counterparties: Counterparty[];
}) {
  return counterparties.map((counterparty) => (
    <option key={counterparty.id} value={counterparty.id}>
      {counterparty.name}
    </option>
  ));
}
