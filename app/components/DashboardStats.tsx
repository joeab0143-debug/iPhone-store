"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet2, CalendarCheck2, ShoppingBag, Boxes, TrendingUp, ChevronRight } from "lucide-react";
import { money, Sheet } from "./ui";
import { DASHBOARD_REFRESH_EVENT } from "@/lib/events";
import type { DashboardSummary } from "@/lib/types";

const POLL_MS = 20000;

interface ExpenseCategoryBreakdown {
  name: string;
  total: number;
}

interface ProfitBreakdown {
  stock_profit: number;
  outside_profit: number;
  expense_categories: ExpenseCategoryBreakdown[];
  total_expense: number;
  net_profit: number;
}

export default function DashboardStats() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [profitOpen, setProfitOpen] = useState(false);
  const [profitBreakdown, setProfitBreakdown] = useState<ProfitBreakdown | null>(null);
  const [profitLoading, setProfitLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (res.ok) setSummary(await res.json());
    } catch {
      // transient network error — keep showing the last known numbers
    }
  }, []);

  useEffect(() => {
    load();
    const onRefresh = () => load();
    window.addEventListener(DASHBOARD_REFRESH_EVENT, onRefresh);
    const interval = setInterval(load, POLL_MS);
    return () => {
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, onRefresh);
      clearInterval(interval);
    };
  }, [load]);

  const openProfitBreakdown = useCallback(async () => {
    setProfitOpen(true);
    setProfitLoading(true);
    try {
      const res = await fetch("/api/profit-breakdown", { cache: "no-store" });
      if (res.ok) setProfitBreakdown(await res.json());
    } catch {
      // transient network error — sheet will just show নেই/stale
    } finally {
      setProfitLoading(false);
    }
  }, []);

  const cashPositive = (summary?.total_cash ?? 0) >= 0;
  const profitPositive = (summary?.profit_till_now ?? 0) >= 0;

  return (
    <div className="mb-4">
      <div className="phone-card">
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-muted">টোটাল ক্যাশ (এখন পর্যন্ত)</p>
          <Wallet2 size={16} className="text-gold" />
        </div>
        <p
          className={`tabular font-display text-3xl font-extrabold mt-1 ${
            cashPositive ? "text-up" : "text-down"
          }`}
        >
          ৳{money(summary?.total_cash)}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <StatTile icon={CalendarCheck2} label="আজকের সেল" value={summary?.today_sale} tone="up" />
        <StatTile icon={ShoppingBag} label="মোট ক্রয়" value={summary?.total_buy} tone="down" />
        <StatTile icon={Boxes} label="স্টক" value={summary?.stock_count} tone="default" isCount />
        <StatTile
          icon={TrendingUp}
          label="এই মাসের প্রফিট"
          value={summary?.profit_till_now}
          tone={profitPositive ? "up" : "down"}
          onClick={openProfitBreakdown}
        />
      </div>

      <Sheet open={profitOpen} onClose={() => setProfitOpen(false)} title="এই মাসের প্রফিটের হিসাব">
        {profitLoading && !profitBreakdown ? (
          <p className="py-6 text-center text-sm text-ink-muted">লোড হচ্ছে...</p>
        ) : profitBreakdown ? (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold text-up">যা যোগ হয়েছে (লাভ)</p>
              <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                <BreakdownRow label="স্টক প্রফিট (এই মাসের সেল থেকে)" value={profitBreakdown.stock_profit} tone="up" />
                <BreakdownRow label="Outside Sell প্রফিট" value={profitBreakdown.outside_profit} tone="up" />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-down">যা বিয়োগ হয়েছে (খরচ, খাত অনুযায়ী)</p>
              {profitBreakdown.expense_categories.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-ink-muted">
                  এই মাসে কোনো খরচ এন্ট্রি নেই
                </p>
              ) : (
                <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                  {profitBreakdown.expense_categories.map((c) => (
                    <BreakdownRow key={c.name} label={c.name} value={c.total} tone="down" negative />
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">নিট প্রফিট (এই মাসে)</p>
              <p
                className={`tabular font-display text-xl font-extrabold ${
                  profitBreakdown.net_profit >= 0 ? "text-up" : "text-down"
                }`}
              >
                ৳{money(profitBreakdown.net_profit)}
              </p>
            </div>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">তথ্য লোড করা যায়নি</p>
        )}
      </Sheet>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  tone,
  negative = false,
}: {
  label: string;
  value: number;
  tone: "up" | "down";
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-ink-muted truncate">{label}</p>
      <p className={`tabular text-sm font-semibold shrink-0 ${tone === "up" ? "text-up" : "text-down"}`}>
        {negative ? "−" : "+"}৳{money(Math.abs(value))}
      </p>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
  isCount = false,
  onClick,
}: {
  icon: any;
  label: string;
  value: number | undefined;
  tone: "up" | "down" | "default";
  isCount?: boolean;
  onClick?: () => void;
}) {
  const colors: Record<string, string> = {
    up: "text-up",
    down: "text-down",
    default: "text-ink",
  };
  const content = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-ink-muted">{label}</p>
        {onClick ? (
          <ChevronRight size={14} className="text-ink-faint" />
        ) : (
          <Icon size={14} className="text-ink-faint" />
        )}
      </div>
      <p className={`tabular font-display text-lg font-bold mt-1 ${colors[tone]}`}>
        {isCount ? value ?? 0 : `৳${money(value)}`}
      </p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-2xl border border-border bg-surface p-3.5 text-left transition active:scale-[0.97]"
      >
        {content}
      </button>
    );
  }

  return <div className="rounded-2xl border border-border bg-surface p-3.5">{content}</div>;
}
