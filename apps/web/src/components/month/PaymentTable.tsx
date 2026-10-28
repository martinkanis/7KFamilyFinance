import type { MonthRow, PaymentStatus } from "@kkff/api/contracts";
import { ExternalLink, Pencil, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney, safeUrl } from "@/lib/format";
import { groupByCategory, isOverdue, isPayable } from "@/lib/monthRows";
import { StatusToggle } from "./StatusToggle";

const ROW_TINT: Record<PaymentStatus, string> = {
  paid: "bg-emerald-50/70",
  processing: "bg-amber-50/80",
  unpaid: "bg-rose-50/60",
};

interface PaymentTableProps {
  title: string;
  rows: MonthRow[];
  today: string;
  isSaving: boolean;
  onStatus: (row: MonthRow, status: PaymentStatus) => void;
  onEdit: (row: MonthRow) => void;
  onQr: (row: MonthRow) => void;
}

function Counterparty({ row }: { row: MonthRow }) {
  if (!row.counterparty) {
    return null;
  }
  const url = safeUrl(row.counterparty.web);
  if (!url) {
    return <span>{row.counterparty.name}</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-brand-600 hover:underline"
    >
      {row.counterparty.name}
      <ExternalLink className="size-3" />
    </a>
  );
}

function PaymentDetails({ row }: { row: MonthRow }) {
  const parts = [
    row.counterpartyAccount,
    row.vs && `VS ${row.vs}`,
    row.template && `šablona ${row.template.code}`,
  ].filter(Boolean);
  return (
    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
      <Counterparty row={row} />
      {parts.length > 0 && (
        <span className="font-mono">{parts.join(" · ")}</span>
      )}
      {row.note && <span className="italic">{row.note}</span>}
    </div>
  );
}

function PaymentRow({
  row,
  today,
  isSaving,
  onStatus,
  onEdit,
  onQr,
}: Omit<PaymentTableProps, "title" | "rows"> & { row: MonthRow }) {
  const isZero = row.amount === 0;
  const overdue = isOverdue(row, today);
  const hasOverride = Object.values(row.overrides).some(
    (value) => value != null,
  );
  return (
    <tr
      className={cn(
        "border-t border-slate-100",
        isZero ? "text-slate-400" : ROW_TINT[row.status],
      )}
    >
      <td className="py-2 pr-2 pl-4 align-top">
        <div className={cn("font-medium", overdue && "text-rose-700")}>
          {row.code && (
            <span className="mr-1.5 text-xs text-slate-400">{row.code}</span>
          )}
          {row.name}
          {row.isOneOff && (
            <span className="ml-1.5 rounded bg-slate-200 px-1 text-[10px] text-slate-600">
              jednorázově
            </span>
          )}
        </div>
        <PaymentDetails row={row} />
      </td>
      <td className="px-2 py-2 align-top text-sm whitespace-nowrap">
        {row.ourAccount?.name}
      </td>
      <td
        className={cn(
          "px-2 py-2 align-top text-sm whitespace-nowrap",
          overdue && "font-semibold text-rose-700",
        )}
      >
        {formatDate(row.dueDate)}
        {overdue && <div className="text-xs">po splatnosti</div>}
      </td>
      <td className="px-2 py-2 text-right align-top font-semibold tabular-nums whitespace-nowrap">
        {formatMoney(row.amount)}
        {hasOverride && (
          <div className="text-[10px] font-normal text-amber-700">upraveno</div>
        )}
      </td>
      <td className="px-2 py-2 align-top">
        {!isZero && (
          <StatusToggle
            status={row.status}
            disabled={isSaving}
            onChange={(status) => onStatus(row, status)}
          />
        )}
        {row.paidOn && (
          <div className="mt-1 text-xs text-slate-500">
            {formatDate(row.paidOn)}
          </div>
        )}
      </td>
      <td className="py-2 pr-4 pl-2 text-right align-top whitespace-nowrap">
        {isPayable(row) && (
          <Button
            size="sm"
            variant="ghost"
            title="QR platba"
            onClick={() => onQr(row)}
          >
            <QrCode className="size-4" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          title="Upravit pro tento měsíc"
          onClick={() => onEdit(row)}
        >
          <Pencil className="size-4" />
        </Button>
      </td>
    </tr>
  );
}

export function PaymentTable({ title, rows, ...rowProps }: PaymentTableProps) {
  const groups = groupByCategory(rows);
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="bg-brand-700 text-left text-xs font-semibold tracking-wide text-white uppercase">
            <th className="py-2.5 pr-2 pl-4">{title}</th>
            <th className="px-2 py-2.5">Náš účet</th>
            <th className="px-2 py-2.5">Splatnost</th>
            <th className="px-2 py-2.5 text-right">Částka</th>
            <th className="px-2 py-2.5">Stav</th>
            <th className="py-2.5 pr-4 pl-2" />
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.category}>
            <tr className="bg-brand-50 text-sm font-semibold text-brand-700">
              <td className="py-1.5 pl-4" colSpan={3}>
                {group.category}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {formatMoney(group.plan)}
              </td>
              <td className="px-2 py-1.5 text-xs font-medium" colSpan={2}>
                {group.remaining === 0
                  ? "hotovo ✓"
                  : `zbývá ${formatMoney(group.remaining)}`}
              </td>
            </tr>
            {group.rows.map((row) => (
              <PaymentRow key={row.key} row={row} {...rowProps} />
            ))}
          </tbody>
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
