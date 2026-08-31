"use client";

import { useEffect, useState } from "react";
import { Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { Badge, inputClass, money, formatDate } from "./ui";
import { emitDashboardRefresh } from "@/lib/events";
import type { NetProfitSummary, OutsideDeal } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

export default function ProfitTab() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [summary, setSummary] = useState<NetProfitSummary | null>(null);
  const [deals, setDeals] = useState<OutsideDeal[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const qs = `?from=${from}&to=${to}`;
    const [sRes, dRes] = await Promise.all([
      fetch(`/api/summary${qs}`),
      fetch(`/api/outside${qs}`),
    ]);
    setSummary(await sRes.json());
    const dData: any = await dRes.json();
    setDeals(dData.deals || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function deleteDeal(id: number) {
    await fetch(`/api/outside/${id}`, { method: "DELETE" });
    emitDashboardRefresh();
    load();
  }

  const netPositive = (summary?.net_profit ?? 0) >= 0;

  return (
    <div className="pb-24">
      {/* Date range filter */}
      <div className="mb-4 flex items-center gap-2">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className={inputClass + " flex-1"}
        />
        <span className="text-ink-faint">—</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={inputClass + " flex-1"}
        />
      </div>

      {/* Net profit hero */}
      <div className="phone-card mb-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-muted">নিট প্রফিট (নির্বাচিত সময়ে)</p>
          {netPositive ? (
            <TrendingUp size={18} className="text-up" />
          ) : (
            <TrendingDown size={18} className="text-down" />
          )}
        </div>
        <p
          className={`tabular font-display text-4xl font-extrabold mt-1 ${
            netPositive ? "text-up" : "text-down"
          }`}
        >
          ৳{money(summary?.net_profit)}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2.5 text-sm">
          <SummaryStat label="স্টক প্রফিট" value={summary?.stock_profit} tone="up" />
          <SummaryStat label="Outside প্রফিট" value={summary?.outside_profit} tone="up" />
          <SummaryStat label="মোট খরচ" value={summary?.total_expense} tone="down" negative />
          <SummaryStat label="বকেয়া বাকি" value={summary?.total_due_outstanding} tone="due" />
        </div>
      </div>

      {/* Outside deals list — created via the Buy / Outside Sell bottom-bar actions */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display font-semibold">Outside — পুরনো ফোন কেনাবেচা</h3>
      </div>

      {loading ? (
        <p className="text-center text-sm text-ink-muted py-10">লোড হচ্ছে...</p>
      ) : deals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center text-ink-muted">
          এই সময়ে কোনো ডিল নেই — Buy ট্যাব থেকে ফোন ক্রয় করুন
        </div>
      ) : (
        <ul className="space-y-2">
          {deals.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-border bg-surface p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">
                      {d.model || d.bought_from || d.name}
                    </p>
                    <Badge tone={d.status === "unsold" ? "default" : "up"}>
                      {d.status === "unsold" ? "Unsold" : "Sold"}
                    </Badge>
                  </div>
                  {(d.ram_rom || d.imei) && (
                    <p className="text-xs text-ink-faint truncate">
                      {d.ram_rom}
                      {d.ram_rom && d.imei ? " · " : ""}
                      {d.imei && `IMEI: ${d.imei}`}
                    </p>
                  )}
                  <p className="text-xs text-ink-faint">
                    ক্রয়: ৳{money(d.buy_price)} · {formatDate(d.deal_date)}
                    {d.bought_from ? ` · ${d.bought_from} থেকে` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {d.status === "sold" ? (
                    <span
                      className={`tabular font-semibold ${
                        d.profit >= 0 ? "text-up" : "text-down"
                      }`}
                    >
                      {d.profit >= 0 ? "+" : ""}৳{money(d.profit)}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-faint">বিক্রি বাকি</span>
                  )}
                  <button
                    onClick={() => deleteDeal(d.id)}
                    className="text-ink-faint hover:text-down"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
  negative,
}: {
  label: string;
  value: number | undefined;
  tone: "up" | "down" | "due";
  negative?: boolean;
}) {
  const colors = { up: "text-up", down: "text-down", due: "text-due" };
  return (
    <div className="rounded-xl bg-surface-2 p-2.5">
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p className={`tabular font-semibold ${colors[tone]}`}>
        {negative && value ? "-" : ""}৳{money(value)}
      </p>
    </div>
  );
}
