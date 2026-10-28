import { Check, Copy, X } from "lucide-react";
import { type MouseEvent, useState } from "react";
import { cn } from "@/lib/cn";

const FEEDBACK_MS = 1500;

type CopyState = "idle" | "copied" | "failed";

/** Zkopíruje text do schránky; klik se nepropaguje (řádek tabulky se neotevře). */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<CopyState>("idle");

  const copy = async (event: MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch (error) {
      console.error(`Kopírování ${label} do schránky selhalo`, error);
      setState("failed");
    }
    setTimeout(() => setState("idle"), FEEDBACK_MS);
  };

  const Icon = state === "copied" ? Check : state === "failed" ? X : Copy;
  return (
    <button
      type="button"
      onClick={copy}
      title={
        state === "failed" ? "Schránka není dostupná" : `Kopírovat ${label}`
      }
      aria-label={`Kopírovat ${label}`}
      className={cn(
        "ml-1 inline-flex rounded p-0.5 align-middle hover:bg-slate-200",
        state === "copied" && "text-emerald-600",
        state === "failed" && "text-rose-600",
        state === "idle" && "text-slate-400 hover:text-slate-700",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
