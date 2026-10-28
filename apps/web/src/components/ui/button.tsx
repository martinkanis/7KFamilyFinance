import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-600 shadow-sm",
  secondary:
    "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 shadow-sm",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-2.5 text-sm gap-1.5 sm:h-8",
  md: "h-10 px-4 text-sm gap-2",
};

interface ButtonStyle {
  variant?: Variant;
  size?: Size;
  className?: string;
}

/** Vzhled tlačítka i pro odkazy (<a>, <Link>) – tlačítko uvnitř odkazu není validní HTML. */
export function buttonClasses({
  variant = "secondary",
  size = "md",
  className,
}: ButtonStyle = {}): string {
  return cn(
    "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
    "disabled:opacity-50 disabled:pointer-events-none",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyle;

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  );
}
