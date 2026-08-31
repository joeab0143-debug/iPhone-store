"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet2, CalendarCheck2, ShoppingBag, Boxes, TrendingUp } from "lucide-react";
import { money } from "./ui";
import { DASHBOARD_REFRESH_EVENT } from "@/lib/events";
import type { DashboardSummary } from "@/lib/types";

const POLL_MS = 20000;

export default function DashboardStats() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

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
          label="প্রফিট (এ পর্যন্ত)"
          value={summary?.profit_till_now}
          tone={profitPositive ? "up" : "down"}
        />
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
  isCount = false,
}: {
  icon: any;
  label: string;
  value: number | undefined;
  tone: "up" | "down" | "default";
  isCount?: boolean;
}) {
  const colors: Record<string, string> = {
    up: "text-up",
    down: "text-down",
    default: "text-ink",
  };
  return (
    <div className="rounded-2xl border border-border bg-surface p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-ink-muted">{label}</p>
        <Icon size={14} className="text-ink-faint" />
      </div>
      <p className={`tabular font-display text-lg font-bold mt-1 ${colors[tone]}`}>
        {isCount ? value ?? 0 : `৳${money(value)}`}
      </p>
    </div>
  );
}
