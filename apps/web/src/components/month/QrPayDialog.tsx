import type { MonthRow, PaymentStatus } from "@kkff/api/contracts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { formatDate, formatMoney, STATUS_LABELS } from "@/lib/format";
import { spdOf } from "@/lib/monthRows";
import { formatIban } from "@/lib/spd";

const QR_SIZE = 240;

interface QrPayDialogProps {
  /** Klíče řádků zachycené při otevření – pořadí se při změně stavu nemění. */
  queue: string[];
  rows: MonthRow[];
  isSaving: boolean;
  onStatus: (row: MonthRow, status: PaymentStatus) => Promise<unknown>;
  onClose: () => void;
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) {
    return null;
  }
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium break-all">{value}</dd>
    </div>
  );
}

function PaymentQr({ row }: { row: MonthRow }) {
  const spd = spdOf(row);
  return (
    <div className="flex flex-col gap-5 sm:flex-row">
      <div className="flex shrink-0 flex-col items-center gap-2">
        {spd.ok ? (
          <QRCodeSVG
            value={spd.spd}
            size={QR_SIZE}
            level="M"
            marginSize={2}
            title="QR platba"
          />
        ) : (
          <div className="flex w-60 flex-col gap-2">
            <ErrorMessage error={new Error(spd.error)} />
            <p className="text-xs text-slate-500">
              Oprav účet nebo symboly v Položkách / Šablonách, nebo plať
              šablonou v bance.
            </p>
          </div>
        )}
        {spd.ok && (
          <span className="text-xs text-slate-500">
            Naskenuj v My Air / ČSOB Smart
          </span>
        )}
      </div>
      <dl className="min-w-0 flex-1">
        <Detail label="Komu" value={row.counterparty?.name} />
        <Detail label="Účet" value={row.counterpartyAccount} />
        <Detail label="IBAN" value={spd.ok ? formatIban(spd.iban) : null} />
        <Detail label="Částka" value={formatMoney(row.amount)} />
        <Detail label="VS" value={row.vs} />
        <Detail label="KS" value={row.ks} />
        <Detail label="SS" value={row.ss} />
        <Detail label="Zpráva" value={row.message ?? row.name} />
        <Detail label="Splatnost" value={formatDate(row.dueDate)} />
        <Detail label="Zaplatit z" value={row.ourAccount?.name} />
        <Detail
          label="Šablona v bance"
          value={row.template && `${row.template.code} – ${row.template.name}`}
        />
        <Detail label="Stav" value={STATUS_LABELS[row.status]} />
      </dl>
    </div>
  );
}

/** Platby jedna po druhé: QR → zaplatit v bance → označit stav → další. */
export function QrPayDialog({
  queue,
  rows,
  isSaving,
  onStatus,
  onClose,
}: QrPayDialogProps) {
  const [index, setIndex] = useState(0);
  const row = rows.find((candidate) => candidate.key === queue[index]);
  const hasNext = index < queue.length - 1;

  const markAndContinue = async (status: PaymentStatus) => {
    if (!row) {
      return;
    }
    await onStatus(row, status);
    if (hasNext) {
      setIndex(index + 1);
    }
  };

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={row ? `${row.name} · ${index + 1} / ${queue.length}` : "QR platba"}
      footer={
        <>
          <Button
            variant="ghost"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            <ChevronLeft className="size-4" /> Předchozí
          </Button>
          <div className="flex-1" />
          <Button
            disabled={isSaving || !row}
            onClick={() => markAndContinue("processing")}
          >
            Zpracovává se
          </Button>
          <Button
            variant="primary"
            disabled={isSaving || !row}
            onClick={() => markAndContinue("paid")}
          >
            Zaplaceno
          </Button>
          <Button
            variant="ghost"
            disabled={!hasNext}
            onClick={() => setIndex(index + 1)}
          >
            Další <ChevronRight className="size-4" />
          </Button>
        </>
      }
    >
      {row ? (
        <PaymentQr row={row} />
      ) : (
        <p className="text-slate-500">Platba už v měsíci není.</p>
      )}
    </Dialog>
  );
}
