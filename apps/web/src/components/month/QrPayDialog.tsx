import type { MonthRow, PaymentStatus } from "@kkff/api/contracts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
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
  copyValue,
}: {
  label: string;
  value: string | null | undefined;
  /** Text do schránky (např. částka bez „Kč“); bez něj se tlačítko nezobrazí. */
  copyValue?: string | null;
}) {
  if (!value) {
    return null;
  }
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="flex items-center text-right font-medium break-all">
        {value}
        {copyValue && <CopyButton text={copyValue} label={label} />}
      </dd>
    </div>
  );
}

function PaymentQr({ row }: { row: MonthRow }) {
  const spd = spdOf(row);
  return (
    <div className="flex flex-col gap-5 sm:flex-row">
      {/* Na telefonu QR naskenovat nejde – údaje ke zkopírování jsou nahoře. */}
      <div className="order-last flex shrink-0 flex-col items-center gap-2 sm:order-none">
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
        <Detail
          label="Účet"
          value={row.counterpartyAccount}
          copyValue={row.counterpartyAccount}
        />
        <Detail
          label="IBAN"
          value={spd.ok ? formatIban(spd.iban) : null}
          copyValue={spd.ok ? spd.iban : null}
        />
        <Detail
          label="Částka"
          value={formatMoney(row.amount)}
          copyValue={String(row.amount)}
        />
        <Detail label="VS" value={row.vs} copyValue={row.vs} />
        <Detail label="KS" value={row.ks} copyValue={row.ks} />
        <Detail label="SS" value={row.ss} copyValue={row.ss} />
        <Detail
          label="Zpráva"
          value={row.message ?? row.name}
          copyValue={row.message ?? row.name}
        />
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
        // Na telefonu nahoře stav (palcem), pod ním listování; na desktopu jedna řada.
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button
            variant="ghost"
            className="order-3 sm:order-none"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            <ChevronLeft className="size-4" /> Předchozí
          </Button>
          <div className="hidden flex-1 sm:block" />
          <Button
            className="order-1 sm:order-none"
            disabled={isSaving || !row}
            onClick={() => markAndContinue("processing")}
          >
            Zpracovává se
          </Button>
          <Button
            variant="primary"
            className="order-2 sm:order-none"
            disabled={isSaving || !row}
            onClick={() => markAndContinue("paid")}
          >
            Zaplaceno
          </Button>
          <Button
            variant="ghost"
            className="order-4 sm:order-none"
            disabled={!hasNext}
            onClick={() => setIndex(index + 1)}
          >
            Další <ChevronRight className="size-4" />
          </Button>
        </div>
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
