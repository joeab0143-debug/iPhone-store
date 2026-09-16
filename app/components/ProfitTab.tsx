"use client";

import { useEffect, useState } from "react";
import { Trash2, TrendingUp, TrendingDown, Download } from "lucide-react";
import { money, formatDate, MonthPicker, currentMonthStr, monthRange } from "./ui";
import { emitDashboardRefresh } from "@/lib/events";
import { generateReportPDF } from "@/lib/report-pdf";
import type { NetProfitSummary, OutsideDeal } from "@/lib/types";

export default function ProfitTab() {
  // মাসের শুরুতে প্রফিট/খরচের হিসাব ০ থেকে শুরু হয় — এই পিকার দিয়ে
  // আগের যেকোনো মাসের হিস্ট্রি দেখা যাবে, কিছুই হারিয়ে যায় না।
  const [month, setMonth] = useState(currentMonthStr());
  const [summary, setSummary] = useState<NetProfitSummary | null>(null);
  const [deals, setDeals] = useState<OutsideDeal[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { from, to } = monthRange(month);
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
  }, [month]);

  async function deleteDeal(id: number) {
    await fetch(`/api/outside/${id}`, { method: "DELETE" });
    emitDashboardRefresh();
    load();
  }

  function monthLabel(m: string) {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  function downloadReport() {
    const previewWin = window.open("", "_blank");
    generateReportPDF(
      {
        shopName: "Phone Fantasy",
        title: "Profit Report",
        subtitle: monthLabel(month),
        summary: [
          { label: "Net Profit", value: `Tk ${(summary?.net_profit ?? 0).toLocaleString()}`, tone: (summary?.net_profit ?? 0) >= 0 ? "up" : "down" },
          { label: "Stock Profit", value: `Tk ${(summary?.stock_profit ?? 0).toLocaleString()}`, tone: "up" },
          { label: "Outside Sell Profit", value: `Tk ${(summary?.outside_profit ?? 0).toLocaleString()}`, tone: "up" },
          { label: "Total Expense", value: `Tk ${(summary?.total_expense ?? 0).toLocaleString()}`, tone: "down" },
          { label: "Due Outstanding", value: `Tk ${(summary?.total_due_outstanding ?? 0).toLocaleString()}` },
        ],
        table: {
          head: ["Model / IMEI", "Date", "Profit (Tk)"],
          rows: deals.map((d) => [
            d.model || d.name || "-",
            (d.sell_date || d.deal_date || "-").toString().slice(0, 10),
            d.profit.toLocaleString(),
          ]),
          emptyLabel: "No Outside Sell entries this month",
        },
        footerNote: "Generated from Phone Fantasy — Profit Tab (Outside Sell log)",
      },
      previewWin
    );
  }

  const netPositive = (summary?.net_profit ?? 0) >= 0;

  return (
    <div className="pb-24">
      <MonthPicker value={month} onChange={setMonth} />

      {/* Net profit hero */}
      <div className="phone-card mb-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-muted">নিট প্রফিট (নির্বাচিত মাসে)</p>
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

      {/* Outside Sell log — a simple Model/IMEI/Profit entry added via the
          bottom-bar Outside Sell action */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display font-semibold">Outside Sell — প্রফিট লগ</h3>
        <button
          onClick={downloadReport}
          className="flex items-center gap-1 text-xs font-semibold text-teal"
        >
          <Download size={13} /> PDF ডাউনলোড
        </button>
      </div>

      {loading ? (
        <p className="text-center text-sm text-ink-muted py-10">লোড হচ্ছে...</p>
      ) : deals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center text-ink-muted">
          এই সময়ে কোনো এন্ট্রি নেই — নিচের Outside Sell বাটন থেকে যোগ করুন
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
                  <p className="font-medium truncate">{d.model || d.name}</p>
                  {d.imei && (
                    <p className="text-xs text-ink-faint truncate">IMEI: {d.imei}</p>
                  )}
                  <p className="text-xs text-ink-faint">
                    {formatDate(d.sell_date || d.deal_date)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`tabular font-semibold ${
                      d.profit >= 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {d.profit >= 0 ? "+" : ""}৳{money(d.profit)}
                  </span>
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
