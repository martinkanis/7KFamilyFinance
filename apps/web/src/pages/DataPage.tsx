import type { ImportResult } from "@kkff/api/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, ErrorMessage, PageHeader } from "@/components/ui/card";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { api } from "@/lib/api";
import { textOrNull } from "@/lib/formValues";

function ImportResultView({ result }: { result: ImportResult }) {
  return (
    <div className="mt-4 space-y-2 rounded-lg bg-emerald-50 p-3 text-sm">
      <p className="font-medium text-emerald-800">Import hotový.</p>
      <p className="text-emerald-900">
        {Object.entries(result.counts)
          .map(([what, count]) => `${what}: ${count}`)
          .join(" · ")}
      </p>
      {result.warnings.length > 0 && (
        <details className="text-amber-900">
          <summary className="cursor-pointer">
            Upozornění ({result.warnings.length})
          </summary>
          <ul className="mt-1 list-disc pl-5">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ImportCard() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const importExcel = useMutation({
    mutationFn: (selected: File) => api.importExcel(selected),
    onSuccess: () => void queryClient.invalidateQueries(),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (file && confirmed) {
      importExcel.mutate(file);
    }
  };
  return (
    <Card className="p-5">
      <h2 className="font-semibold">Import z Excelu</h2>
      <p className="mt-1 text-sm text-slate-500">
        Nahraj <strong>MonkeyBusiness 2.0.xlsx</strong> nebo dřívější export z
        aplikace. Import <strong>nahradí všechna data</strong> v aplikaci –
        předtím si stáhni zálohu.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Input
          type="file"
          accept=".xlsx"
          className="h-auto py-2"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Checkbox
          label="Rozumím, že import přepíše všechna data"
          checked={confirmed}
          onChange={setConfirmed}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!file || !confirmed || importExcel.isPending}
        >
          <Upload className="size-4" />{" "}
          {importExcel.isPending ? "Importuji…" : "Importovat"}
        </Button>
      </form>
      {importExcel.error && (
        <div className="mt-3">
          <ErrorMessage error={importExcel.error} />
        </div>
      )}
      {importExcel.data && <ImportResultView result={importExcel.data} />}
    </Card>
  );
}

function StartDateCard() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const [startDate, setStartDate] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (value: string | null) =>
      api.saveSettings({ startDate: value }),
    onSuccess: () => void queryClient.invalidateQueries(),
  });
  const value = startDate ?? settings.data?.startDate ?? "";
  return (
    <Card className="p-5">
      <h2 className="font-semibold">Počátek přehledu majetku</h2>
      <p className="mt-1 text-sm text-slate-500">
        Ke dni počátku platí počáteční stavy účtů; od tohoto měsíce se k nim
        přičítá bilance.
      </p>
      <form
        className="mt-4 flex items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate(textOrNull(value));
        }}
      >
        <Field label="Datum počátečního stavu">
          <Input
            type="date"
            value={value}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Button type="submit" disabled={save.isPending}>
          Uložit
        </Button>
      </form>
      {save.error && (
        <div className="mt-3">
          <ErrorMessage error={save.error} />
        </div>
      )}
    </Card>
  );
}

export function DataPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Excel a nastavení"
        description="Export pro zálohu nebo práci v Excelu, import dat do aplikace."
      />
      <Card className="p-5">
        <h2 className="font-semibold">Export do Excelu</h2>
        <p className="mt-1 text-sm text-slate-500">
          Celý plán v rozložení MonkeyBusiness 2.0: přehled, měsíce s barvami
          stavů, položky, účty, šablony, protistrany a pojistky. Soubor jde zpět
          importovat.
        </p>
        <a
          href={api.exportExcelUrl}
          download
          className={buttonClasses({ variant: "primary", className: "mt-4" })}
        >
          <Download className="size-4" /> Stáhnout .xlsx
        </a>
      </Card>
      <ImportCard />
      <StartDateCard />
    </div>
  );
}
