"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Download, ChevronRight } from "lucide-react";
import { money, formatDate, MonthPicker, currentMonthStr, monthRange, Sheet } from "./ui";
import { generateReportPDF } from "@/lib/report-pdf";
import { useLang } from "@/lib/i18n";
import type { NetProfitSummary } from "@/lib/types";

export default function ProfitTab() {
  const { t } = useLang();
  // Profit/expense totals start at zero at the beginning of each month —
  // this picker lets any previous month's history be viewed, nothing is
  // ever lost.
  const [month, setMonth] = useState(currentMonthStr());
  const [summary, setSummary] = useState<NetProfitSummary | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { from, to } = monthRange(month);
    const res = await fetch(`/api/summary?from=${from}&to=${to}`);
    setSummary(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  function monthLabel(m: string) {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  // A separate detail sheet for each tile under the profit hero.
  const [detailKind, setDetailKind] = useState<"stock" | "outsideStock" | "expense" | "due" | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [stockSales, setStockSales] = useState<{ name_model: string; imei: string; selling_price: number; profit: number }[] | null>(null);
  const [outsideStockSales, setOutsideStockSales] = useState<
    { name_model: string; imei: string; buy_date: string; buy_price: number; selling_price: number; profit: number; share_profit: number }[] | null
  >(null);
  const [expenseCategories, setExpenseCategories] = useState<{ name: string; total: number }[] | null>(null);
  const [dueSales, setDueSales] = useState<{ name_model: string; customer_name: string | null; customer_phone: string | null; due_amount: number }[] | null>(null);

  async function openDetail(kind: "stock" | "outsideStock" | "expense" | "due") {
    setDetailKind(kind);
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
          const key = e.category_name || t("expense.unknown_category");
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

  function downloadDetailReport(kind: "stock" | "outsideStock" | "expense" | "due") {
    const previewWin = window.open("", "_blank");
    if (kind === "stock") {
      generateReportPDF(
        {
          shopName: "iPhone Store",
          title: "Stock Profit Report",
          subtitle: monthLabel(month),
          summary: [{ label: "Stock Profit", value: `Tk ${(summary?.stock_profit ?? 0).toLocaleString()}`, tone: "up" }],
          table: {
            head: ["Model", "IMEI", "Selling Price (Tk)", "Profit (Tk)"],
            rows: (stockSales || []).map((s) => [s.name_model, s.imei, Number(s.selling_price).toLocaleString(), Number(s.profit).toLocaleString()]),
            emptyLabel: "No sales this month",
          },
          footerNote: "Generated from iPhone Store — Profit Tab",
        },
        previewWin
      );
    } else if (kind === "outsideStock") {
      generateReportPDF(
        {
          shopName: "iPhone Store",
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
          footerNote: "Generated from iPhone Store — Profit Tab",
        },
        previewWin
      );
    } else if (kind === "expense") {
      generateReportPDF(
        {
          shopName: "iPhone Store",
          title: "Expense Report",
          subtitle: monthLabel(month),
          summary: [{ label: "Total Expense", value: `Tk ${(summary?.total_expense ?? 0).toLocaleString()}`, tone: "down" }],
          table: {
            head: ["Category", "Amount (Tk)"],
            rows: (expenseCategories || []).map((c) => [c.name, c.total.toLocaleString()]),
            emptyLabel: "No expense entries this month",
          },
          footerNote: "Generated from iPhone Store — Profit Tab",
        },
        previewWin
      );
    } else {
      generateReportPDF(
        {
          shopName: "iPhone Store",
          title: "Due Outstanding Report",
          subtitle: `As of ${monthLabel(currentMonthStr())}`,
          summary: [{ label: "Total Due Outstanding", value: `Tk ${(summary?.total_due_outstanding ?? 0).toLocaleString()}` }],
          table: {
            head: ["Model", "Customer", "Phone", "Due (Tk)"],
            rows: (dueSales || []).map((s) => [s.name_model, s.customer_name || "-", s.customer_phone || "-", Number(s.due_amount).toLocaleString()]),
            emptyLabel: "No outstanding due",
          },
          footerNote: "Generated from iPhone Store — Profit Tab (all-time)",
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
          <p className="text-xs text-ink-muted">{t("profit.net_profit_label")}</p>
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
          <SummaryStat label={t("profit.stock_profit")} value={summary?.stock_profit} tone="up" onClick={() => openDetail("stock")} />
          <SummaryStat label={t("profit.outside_stock_profit")} value={summary?.outside_stock_profit} tone="up" onClick={() => openDetail("outsideStock")} />
          <SummaryStat label={t("profit.total_expense")} value={summary?.total_expense} tone="down" negative onClick={() => openDetail("expense")} />
          <SummaryStat label={t("profit.due_outstanding")} value={summary?.total_due_outstanding} tone="due" onClick={() => openDetail("due")} />
        </div>
      </div>

      <Sheet
        open={detailKind === "stock"}
        onClose={() => setDetailKind(null)}
        title={t("profit.stock_detail_title")}
      >
        {detailLoading && !stockSales ? (
          <p className="py-6 text-center text-sm text-ink-muted">{t("profit.loading")}</p>
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
              <p className="text-sm font-semibold">{t("profit.stock_profit")}</p>
              <p className="tabular font-display text-xl font-extrabold text-up">৳{money(summary?.stock_profit)}</p>
            </div>
            <DetailDownloadButton label={t("profit.download_pdf")} onClick={() => downloadDetailReport("stock")} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">{t("profit.no_sales_month")}</p>
        )}
      </Sheet>

      <Sheet
        open={detailKind === "outsideStock"}
        onClose={() => setDetailKind(null)}
        title={t("profit.outside_stock_detail_title")}
      >
        {detailLoading && !outsideStockSales ? (
          <p className="py-6 text-center text-sm text-ink-muted">{t("profit.loading")}</p>
        ) : outsideStockSales && outsideStockSales.length > 0 ? (
          <div className="space-y-3">
            <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
              {outsideStockSales.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-muted truncate">{s.name_model}</p>
                    <p className="text-[11px] text-ink-faint truncate">
                      IMEI: {s.imei} · {t("profit.full_profit_prefix")}{money(s.profit)}
                    </p>
                  </div>
                  <p className={`tabular text-sm font-semibold shrink-0 ${s.share_profit >= 0 ? "text-up" : "text-down"}`}>
                    {s.share_profit >= 0 ? "+" : ""}৳{money(s.share_profit)}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">{t("profit.outside_stock_profit")}</p>
              <p className="tabular font-display text-xl font-extrabold text-up">৳{money(summary?.outside_stock_profit)}</p>
            </div>
            <DetailDownloadButton label={t("profit.download_pdf")} onClick={() => downloadDetailReport("outsideStock")} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">{t("profit.no_outside_stock_sales_month")}</p>
        )}
      </Sheet>

      <Sheet
        open={detailKind === "expense"}
        onClose={() => setDetailKind(null)}
        title={t("profit.expense_detail_title")}
      >
        {detailLoading && !expenseCategories ? (
          <p className="py-6 text-center text-sm text-ink-muted">{t("profit.loading")}</p>
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
              <p className="text-sm font-semibold">{t("profit.total_expense")}</p>
              <p className="tabular font-display text-xl font-extrabold text-down">৳{money(summary?.total_expense)}</p>
            </div>
            <DetailDownloadButton label={t("profit.download_pdf")} onClick={() => downloadDetailReport("expense")} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">{t("profit.no_expense_entries_month")}</p>
        )}
      </Sheet>

      <Sheet
        open={detailKind === "due"}
        onClose={() => setDetailKind(null)}
        title={t("profit.due_detail_title")}
      >
        {detailLoading && !dueSales ? (
          <p className="py-6 text-center text-sm text-ink-muted">{t("profit.loading")}</p>
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
              <p className="text-sm font-semibold">{t("profit.total_due_label")}</p>
              <p className="tabular font-display text-xl font-extrabold text-due">৳{money(summary?.total_due_outstanding)}</p>
            </div>
            <DetailDownloadButton label={t("profit.download_pdf")} onClick={() => downloadDetailReport("due")} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">{t("profit.no_due")}</p>
        )}
      </Sheet>
    </div>
  );
}

function DetailDownloadButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold text-teal"
    >
      <Download size={13} /> {label}
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
