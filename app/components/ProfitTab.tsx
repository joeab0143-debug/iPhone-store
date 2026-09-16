"use client";

import { useEffect, useState } from "react";
import { Trash2, TrendingUp, TrendingDown, Download, ChevronRight } from "lucide-react";
import { money, formatDate, MonthPicker, currentMonthStr, monthRange, Sheet } from "./ui";
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
          { label: "Outside Stock Profit", value: `Tk ${(summary?.outside_stock_profit ?? 0).toLocaleString()}`, tone: "up" },
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

  // প্রফিট হিরো-এর নিচের ট্যাইলগুলোর প্রতিটার জন্য আলাদা ডিটেইল শিট।
  const [detailKind, setDetailKind] = useState<"stock" | "outsideStock" | "outside" | "expense" | "due" | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [stockSales, setStockSales] = useState<{ name_model: string; imei: string; selling_price: number; profit: number }[] | null>(null);
  const [outsideStockSales, setOutsideStockSales] = useState<
    { name_model: string; imei: string; buy_date: string; buy_price: number; selling_price: number; profit: number; share_profit: number }[] | null
  >(null);
  const [expenseCategories, setExpenseCategories] = useState<{ name: string; total: number }[] | null>(null);
  const [dueSales, setDueSales] = useState<{ name_model: string; customer_name: string | null; customer_phone: string | null; due_amount: number }[] | null>(null);

  async function openDetail(kind: "stock" | "outsideStock" | "outside" | "expense" | "due") {
    setDetailKind(kind);
    if (kind === "outside") return; // already have `deals` loaded
    setDetailLoading(true);
    try {
      if (kind === "stock") {
        const { from, to } = monthRange(month);
        const res = await fetch(`/api/sales?from=${from}&to=${to}`, { cache: "no-store" });
        const data: any = res.ok ? await res.json() : { sales: [] };
        setStockSales(
          (data.sales || [])
            .filter((s: any) => s.stock_type !== "outside")
            .map((s: any) => ({
              name_model: s.name_model,
              imei: s.imei,
              selling_price: s.selling_price,
              profit: s.profit,
            }))
        );
      } else if (kind === "outsideStock") {
        const { from, to } = monthRange(month);
        const res = await fetch(`/api/sales?from=${from}&to=${to}`, { cache: "no-store" });
        const data: any = res.ok ? await res.json() : { sales: [] };
        setOutsideStockSales(
          (data.sales || [])
            .filter((s: any) => s.stock_type === "outside")
            .map((s: any) => ({
              name_model: s.name_model,
              imei: s.imei,
              buy_date: s.buy_date,
              buy_price: s.buy_price,
              selling_price: s.selling_price,
              profit: s.profit,
              share_profit: Number(s.profit) * 0.5,
            }))
        );
      } else if (kind === "expense") {
        const { from, to } = monthRange(month);
        const res = await fetch(`/api/expenses?from=${from}&to=${to}`, { cache: "no-store" });
        const data: any = res.ok ? await res.json() : { expenses: [] };
        const map = new Map<string, number>();
        for (const e of data.expenses || []) {
          const key = e.category_name || "অজানা";
          map.set(key, (map.get(key) || 0) + Number(e.amount));
        }
        setExpenseCategories(
          Array.from(map.entries())
            .map(([name, total]) => ({ name, total }))
            .sort((a, b) => b.total - a.total)
        );
      } else if (kind === "due") {
        const res = await fetch(`/api/sales?due_only=1`, { cache: "no-store" });
        const data: any = res.ok ? await res.json() : { sales: [] };
        setDueSales(
          (data.sales || []).map((s: any) => ({
            name_model: s.name_model,
            customer_name: s.customer_name,
            customer_phone: s.customer_phone,
            due_amount: s.due_amount,
          }))
        );
      }
    } catch {
      // transient network error
    } finally {
      setDetailLoading(false);
    }
  }

  function downloadDetailReport(kind: "stock" | "outsideStock" | "outside" | "expense" | "due") {
    const previewWin = window.open("", "_blank");
    if (kind === "stock") {
      generateReportPDF(
        {
          shopName: "Phone Fantasy",
          title: "Stock Profit Report",
          subtitle: monthLabel(month),
          summary: [{ label: "Stock Profit", value: `Tk ${(summary?.stock_profit ?? 0).toLocaleString()}`, tone: "up" }],
          table: {
            head: ["Model", "IMEI", "Selling Price (Tk)", "Profit (Tk)"],
            rows: (stockSales || []).map((s) => [s.name_model, s.imei, Number(s.selling_price).toLocaleString(), Number(s.profit).toLocaleString()]),
            emptyLabel: "No sales this month",
          },
          footerNote: "Generated from Phone Fantasy — Profit Tab",
        },
        previewWin
      );
    } else if (kind === "outsideStock") {
      generateReportPDF(
        {
          shopName: "Phone Fantasy",
          title: "Outside Stock Profit Report",
          subtitle: monthLabel(month),
          summary: [{ label: "Outside Stock Profit (50% Share)", value: `Tk ${(summary?.outside_stock_profit ?? 0).toLocaleString()}`, tone: "up" }],
          table: {
            head: ["Model", "IMEI", "Buy Date", "Buy Price (Tk)", "Sell Price (Tk)", "Full Profit (Tk)", "Your Share (Tk)"],
            rows: (outsideStockSales || []).map((s) => [
              s.name_model,
              s.imei,
              (s.buy_date || "-").toString().slice(0, 10),
              Number(s.buy_price).toLocaleString(),
              Number(s.selling_price).toLocaleString(),
              Number(s.profit).toLocaleString(),
              Number(s.share_profit).toLocaleString(),
            ]),
            emptyLabel: "No outside stock sales this month",
          },
          footerNote: "Generated from Phone Fantasy — Profit Tab",
        },
        previewWin
      );
    } else if (kind === "outside") {
      generateReportPDF(
        {
          shopName: "Phone Fantasy",
          title: "Outside Sell Profit Report",
          subtitle: monthLabel(month),
          summary: [{ label: "Outside Sell Profit", value: `Tk ${(summary?.outside_profit ?? 0).toLocaleString()}`, tone: "up" }],
          table: {
            head: ["Model / IMEI", "Date", "Profit (Tk)"],
            rows: deals.map((d) => [d.model || d.name || "-", (d.sell_date || d.deal_date || "-").toString().slice(0, 10), d.profit.toLocaleString()]),
            emptyLabel: "No Outside Sell entries this month",
          },
          footerNote: "Generated from Phone Fantasy — Profit Tab",
        },
        previewWin
      );
    } else if (kind === "expense") {
      generateReportPDF(
        {
          shopName: "Phone Fantasy",
          title: "Expense Report",
          subtitle: monthLabel(month),
          summary: [{ label: "Total Expense", value: `Tk ${(summary?.total_expense ?? 0).toLocaleString()}`, tone: "down" }],
          table: {
            head: ["Category", "Amount (Tk)"],
            rows: (expenseCategories || []).map((c) => [c.name, c.total.toLocaleString()]),
            emptyLabel: "No expense entries this month",
          },
          footerNote: "Generated from Phone Fantasy — Profit Tab",
        },
        previewWin
      );
    } else {
      generateReportPDF(
        {
          shopName: "Phone Fantasy",
          title: "Due Outstanding Report",
          subtitle: `As of ${monthLabel(currentMonthStr())}`,
          summary: [{ label: "Total Due Outstanding", value: `Tk ${(summary?.total_due_outstanding ?? 0).toLocaleString()}` }],
          table: {
            head: ["Model", "Customer", "Phone", "Due (Tk)"],
            rows: (dueSales || []).map((s) => [s.name_model, s.customer_name || "-", s.customer_phone || "-", Number(s.due_amount).toLocaleString()]),
            emptyLabel: "No outstanding due",
          },
          footerNote: "Generated from Phone Fantasy — Profit Tab (all-time)",
        },
        previewWin
      );
    }
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
          <SummaryStat label="স্টক প্রফিট" value={summary?.stock_profit} tone="up" onClick={() => openDetail("stock")} />
          <SummaryStat label="আউটসাইড স্টক প্রফিট" value={summary?.outside_stock_profit} tone="up" onClick={() => openDetail("outsideStock")} />
          <SummaryStat label="Outside প্রফিট" value={summary?.outside_profit} tone="up" onClick={() => openDetail("outside")} />
          <SummaryStat label="মোট খরচ" value={summary?.total_expense} tone="down" negative onClick={() => openDetail("expense")} />
          <SummaryStat label="বকেয়া বাকি" value={summary?.total_due_outstanding} tone="due" onClick={() => openDetail("due")} />
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

      <Sheet
        open={detailKind === "stock"}
        onClose={() => setDetailKind(null)}
        title="স্টক প্রফিটের হিসাব"
      >
        {detailLoading && !stockSales ? (
          <p className="py-6 text-center text-sm text-ink-muted">লোড হচ্ছে...</p>
        ) : stockSales && stockSales.length > 0 ? (
          <div className="space-y-3">
            <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
              {stockSales.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <p className="text-sm text-ink-muted truncate">{s.name_model}</p>
                  <p className={`tabular text-sm font-semibold shrink-0 ${s.profit >= 0 ? "text-up" : "text-down"}`}>
                    {s.profit >= 0 ? "+" : ""}৳{money(s.profit)}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">স্টক প্রফিট</p>
              <p className="tabular font-display text-xl font-extrabold text-up">৳{money(summary?.stock_profit)}</p>
            </div>
            <DetailDownloadButton onClick={() => downloadDetailReport("stock")} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">এই মাসে কোনো সেল নেই</p>
        )}
      </Sheet>

      <Sheet
        open={detailKind === "outsideStock"}
        onClose={() => setDetailKind(null)}
        title="আউটসাইড স্টক প্রফিটের হিসাব"
      >
        {detailLoading && !outsideStockSales ? (
          <p className="py-6 text-center text-sm text-ink-muted">লোড হচ্ছে...</p>
        ) : outsideStockSales && outsideStockSales.length > 0 ? (
          <div className="space-y-3">
            <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
              {outsideStockSales.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-muted truncate">{s.name_model}</p>
                    <p className="text-[11px] text-ink-faint truncate">
                      IMEI: {s.imei} · ফুল প্রফিট: ৳{money(s.profit)}
                    </p>
                  </div>
                  <p className={`tabular text-sm font-semibold shrink-0 ${s.share_profit >= 0 ? "text-up" : "text-down"}`}>
                    {s.share_profit >= 0 ? "+" : ""}৳{money(s.share_profit)}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">আউটসাইড স্টক প্রফিট</p>
              <p className="tabular font-display text-xl font-extrabold text-up">৳{money(summary?.outside_stock_profit)}</p>
            </div>
            <DetailDownloadButton onClick={() => downloadDetailReport("outsideStock")} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">এই মাসে কোনো আউটসাইড স্টক সেল নেই</p>
        )}
      </Sheet>

      <Sheet
        open={detailKind === "outside"}
        onClose={() => setDetailKind(null)}
        title="Outside প্রফিটের হিসাব"
      >
        {deals.length > 0 ? (
          <div className="space-y-3">
            <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
              {deals.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3">
                  <p className="text-sm text-ink-muted truncate">{d.model || d.name}</p>
                  <p className={`tabular text-sm font-semibold shrink-0 ${d.profit >= 0 ? "text-up" : "text-down"}`}>
                    {d.profit >= 0 ? "+" : ""}৳{money(d.profit)}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">Outside প্রফিট</p>
              <p className="tabular font-display text-xl font-extrabold text-up">৳{money(summary?.outside_profit)}</p>
            </div>
            <DetailDownloadButton onClick={() => downloadDetailReport("outside")} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">এই মাসে কোনো Outside Sell এন্ট্রি নেই</p>
        )}
      </Sheet>

      <Sheet
        open={detailKind === "expense"}
        onClose={() => setDetailKind(null)}
        title="মোট খরচের হিসাব (খাত অনুযায়ী)"
      >
        {detailLoading && !expenseCategories ? (
          <p className="py-6 text-center text-sm text-ink-muted">লোড হচ্ছে...</p>
        ) : expenseCategories && expenseCategories.length > 0 ? (
          <div className="space-y-3">
            <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
              {expenseCategories.map((c) => (
                <div key={c.name} className="flex items-center justify-between gap-3">
                  <p className="text-sm text-ink-muted truncate">{c.name}</p>
                  <p className="tabular text-sm font-semibold shrink-0 text-down">−৳{money(c.total)}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">মোট খরচ</p>
              <p className="tabular font-display text-xl font-extrabold text-down">৳{money(summary?.total_expense)}</p>
            </div>
            <DetailDownloadButton onClick={() => downloadDetailReport("expense")} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">এই মাসে কোনো খরচ এন্ট্রি নেই</p>
        )}
      </Sheet>

      <Sheet
        open={detailKind === "due"}
        onClose={() => setDetailKind(null)}
        title="বকেয়া বাকির হিসাব"
      >
        {detailLoading && !dueSales ? (
          <p className="py-6 text-center text-sm text-ink-muted">লোড হচ্ছে...</p>
        ) : dueSales && dueSales.length > 0 ? (
          <div className="space-y-3">
            <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
              {dueSales.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <p className="text-sm text-ink-muted truncate">
                    {s.name_model} {s.customer_name ? `— ${s.customer_name}` : ""}
                  </p>
                  <p className="tabular text-sm font-semibold shrink-0 text-due">৳{money(s.due_amount)}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">মোট বকেয়া</p>
              <p className="tabular font-display text-xl font-extrabold text-due">৳{money(summary?.total_due_outstanding)}</p>
            </div>
            <DetailDownloadButton onClick={() => downloadDetailReport("due")} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">কোনো বকেয়া নেই</p>
        )}
      </Sheet>
    </div>
  );
}

function DetailDownloadButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold text-teal"
    >
      <Download size={13} /> PDF ডাউনলোড
    </button>
  );
}

function SummaryStat({
  label,
  value,
  tone,
  negative,
  onClick,
}: {
  label: string;
  value: number | undefined;
  tone: "up" | "down" | "due";
  negative?: boolean;
  onClick?: () => void;
}) {
  const colors = { up: "text-up", down: "text-down", due: "text-due" };
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl bg-surface-2 p-2.5 text-left"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-ink-muted">{label}</p>
        {onClick && <ChevronRight size={12} className="text-ink-faint" />}
      </div>
      <p className={`tabular font-semibold ${colors[tone]}`}>
        {negative && value ? "-" : ""}৳{money(value)}
      </p>
    </button>
  );
}
