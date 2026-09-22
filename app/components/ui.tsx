"use client";

import { ReactNode } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useLang } from "@/lib/i18n";

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  className = "",
  disabled = false,
  full = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  disabled?: boolean;
  full?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-sm px-4 py-2.5 transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";
  const variants: Record<string, string> = {
    primary: "bg-gold text-white hover:brightness-110",
    secondary: "bg-surface-2 text-ink border border-border hover:border-teal/50",
    ghost: "bg-transparent text-ink-muted hover:text-ink",
    danger: "bg-down/15 text-down border border-down/30 hover:bg-down/25",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${full ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl bg-surface-2 border border-border px-3.5 py-2.5 text-ink placeholder:text-ink-faint focus:border-teal outline-none transition tabular";

// Renders as a normal in-page panel (a "tab"), not a popup — the sidebar
// controls which one is mounted, so there is never an overlay to dismiss.
// The corner button just resets the form back to blank; it doesn't close
// or navigate anywhere.
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const { t } = useLang();
  const sheetResetLabel = t("common.reset_form");
  if (!open) return null;
  return (
    <div className="w-full max-w-3xl rounded-3xl bg-surface border border-border shadow-sm p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink transition"
          aria-label={sheetResetLabel}
          title={sheetResetLabel}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "up" | "down" | "due";
}) {
  const tones: Record<string, string> = {
    default: "bg-surface-2 text-ink-muted",
    up: "bg-up/15 text-up",
    down: "bg-down/15 text-down",
    due: "bg-due/15 text-due",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function money(n: number | null | undefined) {
  const v = Number(n || 0);
  return v.toLocaleString("en-BD", { maximumFractionDigits: 0 });
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso.replace(" ", "T"));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("bn-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// --- Month-scoped views (Expense, Profit) --------------------------------
// Every month "restarts" its running totals, but nothing is ever deleted —
// this just picks which calendar month's rows to sum/list. currentMonthStr
// is the default; MonthPicker lets the user step to any earlier month to
// see its history.

export function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  const from = `${monthStr}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${monthStr}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function shiftMonth(monthStr: string, delta: number) {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (month: string) => void;
}) {
  const { t } = useLang();
  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        onClick={() => onChange(shiftMonth(value, -1))}
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-ink-muted hover:text-teal"
        aria-label={t("common.prev_month")}
      >
        <ChevronLeft size={18} />
      </button>
      <input
        type="month"
        value={value}
        max={currentMonthStr()}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className={inputClass + " flex-1 text-center"}
      />
      <button
        onClick={() => onChange(shiftMonth(value, 1))}
        disabled={value >= currentMonthStr()}
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-ink-muted hover:text-teal disabled:opacity-40"
        aria-label={t("common.next_month")}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
