import type { Account } from "@kkff/api/contracts";
import { Plus, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Select } from "@/components/ui/field";

export const NO_ACCOUNT = "none";

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
}

export function MonthToolbar({
  payableCount,
  filters,
  accounts,
  onFiltersChange,
  onPayByQr,
  onAddOneOff,
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
