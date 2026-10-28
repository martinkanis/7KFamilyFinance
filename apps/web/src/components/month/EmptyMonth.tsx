import { Link } from "@tanstack/react-router";
import { FileSpreadsheet, ListChecks } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** První spuštění: měsíc bez položek vysvětlí, kde začít. */
export function EmptyMonth() {
  return (
    <Card className="p-6 text-center">
      <h2 className="text-lg font-semibold">Zatím tu nejsou žádné platby</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
        Platby se v každém měsíci objeví samy z položek. Nahraj svůj Excel, nebo
        přidej první položku ručně.
      </p>
      <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
        <Link to="/data" className={buttonClasses({ variant: "primary" })}>
          <FileSpreadsheet className="size-4" /> Nahrát Excel
        </Link>
        <Link to="/polozky" className={buttonClasses()}>
          <ListChecks className="size-4" /> Přidat položku
        </Link>
      </div>
    </Card>
  );
}
