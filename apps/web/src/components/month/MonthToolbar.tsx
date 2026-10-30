import type { Account } from "@kkff/api/contracts";
import { Plus, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Select } from "@/components/ui/field";
import type { RowSort } from "@/lib/monthRows";

export const NO_ACCOUNT = "none";

const SORT_OPTIONS: { value: string; label: string; sort: RowSort }[] = [
  { value: "own", label: "Vlastní pořadí", sort: { by: "own", desc: false } },
  {
    value: "due",
    label: "Splatnost – nejdřívější",
    sort: { by: "due", desc: false },
  },
  {
    value: "due-desc",
    label: "Splatnost – nejpozdější",
    sort: { by: "due", desc: true },
  },
  {
    value: "amount-desc",
    label: "Částka – nejvyšší",
    sort: { by: "amount", desc: true },
  },
  {
    value: "amount",
    label: "Částka – nejnižší",
    sort: { by: "amount", desc: false },
  },
  {
    value: "status",
    label: "Nezaplacené první",
    sort: { by: "status", desc: false },
  },
  {
    value: "status-desc",
    label: "Zaplacené první",
    sort: { by: "status", desc: true },
  },
];

const sortValue = ({ by, desc }: RowSort) => (desc ? `${by}-desc` : by);

export interface Filters {
  showZero: boolean;
  onlyOpen: boolean;
  account: string;
}

interface MonthToolbarProps {
  payableCount: number;
  filters: Filters;
  accounts: Account[];
  onFiltersChange: (filters: Filters) => void;
  onPayByQr: () => void;
  onAddOneOff: () => void;
  sort: RowSort;
  onSortChange: (sort: RowSort) => void;
}

export function MonthToolbar({
  payableCount,
  filters,
  accounts,
  onFiltersChange,
  onPayByQr,
  onAddOneOff,
  sort,
  onSortChange,
}: MonthToolbarProps) {
  return (
    <div className="space-y-3 md:flex md:flex-wrap md:items-center md:gap-x-5 md:gap-y-3 md:space-y-0">
      <div className="grid grid-cols-2 gap-2 md:flex">
        <Button
          variant="primary"
          disabled={payableCount === 0}
          onClick={onPayByQr}
        >
          <QrCode className="size-4" /> Platit ({payableCount})
        </Button>
        <Button onClick={onAddOneOff}>
          <Plus className="size-4" /> Jednorázová
        </Button>
      </div>
      <div className="md:w-64">
        <Select
          aria-label="Filtrovat podle našeho účtu"
          value={filters.account}
          onChange={(e) =>
            onFiltersChange({ ...filters, account: e.target.value })
          }
        >
          <option value="">Všechny naše účty</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
          <option value={NO_ACCOUNT}>Bez vyplněného účtu</option>
        </Select>
      </div>
      <div className="md:w-56">
        <Select
          aria-label="Řazení plateb v kategoriích"
          value={sortValue(sort)}
          onChange={(e) => {
            const option = SORT_OPTIONS.find((o) => o.value === e.target.value);
            if (option) onSortChange(option.sort);
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Checkbox
          label="Jen nezaplacené"
          checked={filters.onlyOpen}
          onChange={(onlyOpen) => onFiltersChange({ ...filters, onlyOpen })}
        />
        <Checkbox
          label="Ukázat nulové"
          checked={filters.showZero}
          onChange={(showZero) => onFiltersChange({ ...filters, showZero })}
        />
      </div>
    </div>
  );
}
