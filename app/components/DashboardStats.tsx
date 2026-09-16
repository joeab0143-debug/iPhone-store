"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet2, CalendarCheck2, ShoppingBag, Boxes, TrendingUp, ChevronRight, Download } from "lucide-react";
import { money, Sheet, monthRange, currentMonthStr } from "./ui";
import { DASHBOARD_REFRESH_EVENT } from "@/lib/events";
import { generateReportPDF } from "@/lib/report-pdf";
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

interface CashBreakdown {
  total_cash: number;
  sales_paid: number;
  outside_profit: number;
  loan_cash_in: number;
  total_buy: number;
  expenses: number;
  loan_cash_out: number;
  adjustment: number;
}

interface StockSaleRow {
  name_model: string;
  imei: string;
  selling_price: number;
}

interface OutsideSaleRow {
  model: string | null;
  name: string;
  imei: string | null;
  profit: number;
  sell_date?: string;
}

interface TodaySaleBreakdown {
  stockSales: StockSaleRow[];
  outsideSales: OutsideSaleRow[];
  total: number;
}

interface BuyPhoneRow {
  name_model: string;
  imei: string;
  buy_price: number;
  buy_date: string;
  status: "unsold" | "sold";
}

interface TotalBuyBreakdown {
  phones: BuyPhoneRow[];
  unsoldValue: number;
  soldValue: number;
  total: number;
}

interface StockProfitRow {
  name_model: string;
  imei: string;
  buy_date: string;
  buy_price: number;
  selling_price: number;
  profit: number;
}

interface CashSalePaidRow {
  name_model: string;
  imei: string;
  paid_amount: number;
}

interface LoanEntryRow {
  person_name: string;
  direction: "taken" | "given";
  kind: "disburse" | "repay";
  amount: number;
  entry_date: string;
}

type SubDetailKind =
  | "stockProfitMonth"
  | "outsideProfitMonth"
  | "cashSalesPaid"
  | "cashOutsideProfit"
  | "cashLoanIn";

// "YYYY-MM-DD" for today, in the browser's local time — same approach the
// rest of the app already uses for "today" comparisons (e.g. ExpenseTab's
// totalToday), so this always matches what the user sees elsewhere.
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayLabel() {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DashboardStats() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  const [profitOpen, setProfitOpen] = useState(false);
  const [profitBreakdown, setProfitBreakdown] = useState<ProfitBreakdown | null>(null);
  const [profitLoading, setProfitLoading] = useState(false);

  const [cashOpen, setCashOpen] = useState(false);
  const [cashBreakdown, setCashBreakdown] = useState<CashBreakdown | null>(null);
  const [cashLoading, setCashLoading] = useState(false);

  const [todayOpen, setTodayOpen] = useState(false);
  const [todayBreakdown, setTodayBreakdown] = useState<TodaySaleBreakdown | null>(null);
  const [todayLoading, setTodayLoading] = useState(false);

  const [buyOpen, setBuyOpen] = useState(false);
  const [buyBreakdown, setBuyBreakdown] = useState<TotalBuyBreakdown | null>(null);
  const [buyLoading, setBuyLoading] = useState(false);

  // নেস্টেড ডিটেইলস — ইতিমধ্যে খোলা কোনো ব্রেকডাউন শিটের ভেতরের একটা লাইনে
  // ক্লিক করলে, ঠিক কোন কোন প্রোডাক্ট/এন্ট্রি থেকে ওই টাকাটা এলো তা দেখানো হয়।
  const [subKind, setSubKind] = useState<SubDetailKind | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subStockProfit, setSubStockProfit] = useState<StockProfitRow[] | null>(null);
  const [subOutsideDeals, setSubOutsideDeals] = useState<OutsideSaleRow[] | null>(null);
  const [subCashSales, setSubCashSales] = useState<CashSalePaidRow[] | null>(null);
  const [subLoanIn, setSubLoanIn] = useState<LoanEntryRow[] | null>(null);

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

  const openCashBreakdown = useCallback(async () => {
    setCashOpen(true);
    setCashLoading(true);
    try {
      const res = await fetch("/api/cash-breakdown", { cache: "no-store" });
      if (res.ok) setCashBreakdown(await res.json());
    } catch {
      // transient network error
    } finally {
      setCashLoading(false);
    }
  }, []);

  const openTodayBreakdown = useCallback(async () => {
    setTodayOpen(true);
    setTodayLoading(true);
    try {
      const today = todayStr();
      const [sRes, oRes] = await Promise.all([
        fetch(`/api/sales?from=${today}&to=${today}`, { cache: "no-store" }),
        fetch(`/api/outside?status=sold`, { cache: "no-store" }),
      ]);
      const sData: any = sRes.ok ? await sRes.json() : { sales: [] };
      const oData: any = oRes.ok ? await oRes.json() : { deals: [] };
      const stockSales: StockSaleRow[] = (sData.sales || []).map((s: any) => ({
        name_model: s.name_model,
        imei: s.imei,
        selling_price: s.selling_price,
      }));
      const outsideSales: OutsideSaleRow[] = (oData.deals || [])
        .filter((d: any) => (d.sell_date || "").slice(0, 10) === today)
        .map((d: any) => ({ model: d.model, name: d.name, imei: d.imei, profit: d.profit }));
      const total =
        stockSales.reduce((s, r) => s + Number(r.selling_price), 0) +
        outsideSales.reduce((s, r) => s + Number(r.profit), 0);
      setTodayBreakdown({ stockSales, outsideSales, total });
    } catch {
      // transient network error
    } finally {
      setTodayLoading(false);
    }
  }, []);

  const openBuyBreakdown = useCallback(async () => {
    setBuyOpen(true);
    setBuyLoading(true);
    try {
      const res = await fetch(`/api/stock`, { cache: "no-store" });
      const data: any = res.ok ? await res.json() : { phones: [] };
      const phones: BuyPhoneRow[] = (data.phones || []).map((p: any) => ({
        name_model: p.name_model,
        imei: p.imei,
        buy_price: p.buy_price,
        buy_date: p.buy_date,
        status: p.status,
      }));
      const unsoldValue = phones.filter((p) => p.status === "unsold").reduce((s, p) => s + Number(p.buy_price), 0);
      const soldValue = phones.filter((p) => p.status === "sold").reduce((s, p) => s + Number(p.buy_price), 0);
      setBuyBreakdown({ phones, unsoldValue, soldValue, total: unsoldValue + soldValue });
    } catch {
      // transient network error
    } finally {
      setBuyLoading(false);
    }
  }, []);

  const openSub = useCallback(async (kind: SubDetailKind) => {
    setSubKind(kind);
    setSubLoading(true);
    try {
      if (kind === "stockProfitMonth") {
        const { from, to } = monthRange(currentMonthStr());
        const res = await fetch(`/api/sales?from=${from}&to=${to}`, { cache: "no-store" });
        const data: any = res.ok ? await res.json() : { sales: [] };
        setSubStockProfit(
          (data.sales || []).map((s: any) => ({
            name_model: s.name_model,
            imei: s.imei,
            buy_date: s.buy_date,
            buy_price: s.buy_price,
            selling_price: s.selling_price,
            profit: s.profit,
          }))
        );
      } else if (kind === "outsideProfitMonth") {
        // /api/outside ফিল্টার করে deal_date দিয়ে, কিন্তু মাসিক প্রফিট
        // হিসাব হয় sell_date দিয়ে (profit-breakdown route দ্রষ্টব্য) — তাই
        // সবগুলো sold ডিল এনে ক্লায়েন্ট-সাইডে sell_date দিয়ে ফিল্টার করা
        // হচ্ছে, ঠিক openTodayBreakdown-এর মতোই।
        const monthPrefix = currentMonthStr();
        const res = await fetch(`/api/outside?status=sold`, { cache: "no-store" });
        const data: any = res.ok ? await res.json() : { deals: [] };
        setSubOutsideDeals(
          (data.deals || [])
            .filter((d: any) => (d.sell_date || "").slice(0, 7) === monthPrefix)
            .map((d: any) => ({ model: d.model, name: d.name, imei: d.imei, profit: d.profit, sell_date: d.sell_date }))
        );
      } else if (kind === "cashSalesPaid") {
        const res = await fetch(`/api/sales`, { cache: "no-store" });
        const data: any = res.ok ? await res.json() : { sales: [] };
        setSubCashSales(
          (data.sales || [])
            .filter((s: any) => Number(s.paid_amount) > 0)
            .map((s: any) => ({ name_model: s.name_model, imei: s.imei, paid_amount: s.paid_amount }))
        );
      } else if (kind === "cashOutsideProfit") {
        const res = await fetch(`/api/outside?status=sold`, { cache: "no-store" });
        const data: any = res.ok ? await res.json() : { deals: [] };
        setSubOutsideDeals(
          (data.deals || []).map((d: any) => ({ model: d.model, name: d.name, imei: d.imei, profit: d.profit, sell_date: d.sell_date }))
        );
      } else if (kind === "cashLoanIn") {
        const res = await fetch(`/api/loan-entries`, { cache: "no-store" });
        const data: any = res.ok ? await res.json() : { entries: [] };
        setSubLoanIn(
          (data.entries || [])
            .filter((e: any) => (e.direction === "taken" && e.kind === "disburse") || (e.direction === "given" && e.kind === "repay"))
            .map((e: any) => ({
              person_name: e.person_name,
              direction: e.direction,
              kind: e.kind,
              amount: e.amount,
              entry_date: e.entry_date,
            }))
        );
      }
    } catch {
      // transient network error
    } finally {
      setSubLoading(false);
    }
  }, []);

  function downloadCashReport() {
    if (!cashBreakdown) return;
    const previewWin = window.open("", "_blank");
    generateReportPDF(
      {
        shopName: "Phone Fantasy",
        title: "Total Cash Report",
        subtitle: `As of ${todayLabel()}`,
        summary: [
          { label: "Total Cash", value: `Tk ${cashBreakdown.total_cash.toLocaleString()}`, tone: cashBreakdown.total_cash >= 0 ? "up" : "down" },
          { label: "Sales Received", value: `Tk ${cashBreakdown.sales_paid.toLocaleString()}`, tone: "up" },
          { label: "Outside Sell Profit", value: `Tk ${cashBreakdown.outside_profit.toLocaleString()}`, tone: "up" },
          { label: "Loan Cash In", value: `Tk ${cashBreakdown.loan_cash_in.toLocaleString()}`, tone: "up" },
          { label: "Total Buy (Stock)", value: `Tk ${cashBreakdown.total_buy.toLocaleString()}`, tone: "down" },
          { label: "Total Expenses", value: `Tk ${cashBreakdown.expenses.toLocaleString()}`, tone: "down" },
          { label: "Loan Cash Out", value: `Tk ${cashBreakdown.loan_cash_out.toLocaleString()}`, tone: "down" },
          { label: "Manual Adjustment", value: `Tk ${cashBreakdown.adjustment.toLocaleString()}` },
        ],
        footerNote: "Generated from Phone Fantasy — Total Cash (all-time)",
      },
      previewWin
    );
  }

  function downloadTodayReport() {
    if (!todayBreakdown) return;
    const previewWin = window.open("", "_blank");
    const rows: (string | number)[][] = [
      ...todayBreakdown.stockSales.map((s) => ["Stock Sale", s.name_model, s.imei, s.selling_price.toLocaleString()]),
      ...todayBreakdown.outsideSales.map((o) => ["Outside Sell", o.model || o.name, o.imei || "-", o.profit.toLocaleString()]),
    ];
    generateReportPDF(
      {
        shopName: "Phone Fantasy",
        title: "Today's Sale Report",
        subtitle: todayLabel(),
        summary: [{ label: "Total (Today)", value: `Tk ${todayBreakdown.total.toLocaleString()}`, tone: "up" }],
        table: {
          head: ["Source", "Model", "IMEI", "Amount (Tk)"],
          rows,
          emptyLabel: "No sales today",
        },
        footerNote: "Generated from Phone Fantasy — Dashboard",
      },
      previewWin
    );
  }

  function downloadBuyReport() {
    if (!buyBreakdown) return;
    const previewWin = window.open("", "_blank");
    generateReportPDF(
      {
        shopName: "Phone Fantasy",
        title: "Total Buy Report",
        subtitle: `As of ${todayLabel()}`,
        summary: [
          { label: "Total Buy Value", value: `Tk ${buyBreakdown.total.toLocaleString()}`, tone: "down" },
          { label: "In Stock (Unsold)", value: `Tk ${buyBreakdown.unsoldValue.toLocaleString()}` },
          { label: "Sold", value: `Tk ${buyBreakdown.soldValue.toLocaleString()}` },
        ],
        table: {
          head: ["Model", "IMEI", "Status", "Buy Price (Tk)", "Buy Date"],
          rows: buyBreakdown.phones.map((p) => [
            p.name_model,
            p.imei,
            p.status === "sold" ? "Sold" : "In Stock",
            Number(p.buy_price).toLocaleString(),
            (p.buy_date || "-").toString().slice(0, 10),
          ]),
          emptyLabel: "No phones bought yet",
        },
        footerNote: "Generated from Phone Fantasy — Total Buy (all-time)",
      },
      previewWin
    );
  }

  function downloadProfitReport() {
    if (!profitBreakdown) return;
    const previewWin = window.open("", "_blank");
    generateReportPDF(
      {
        shopName: "Phone Fantasy",
        title: "Profit Report",
        subtitle: "This Month",
        summary: [
          { label: "Net Profit", value: `Tk ${profitBreakdown.net_profit.toLocaleString()}`, tone: profitBreakdown.net_profit >= 0 ? "up" : "down" },
          { label: "Stock Profit", value: `Tk ${profitBreakdown.stock_profit.toLocaleString()}`, tone: "up" },
          { label: "Outside Sell Profit", value: `Tk ${profitBreakdown.outside_profit.toLocaleString()}`, tone: "up" },
          { label: "Total Expense", value: `Tk ${profitBreakdown.total_expense.toLocaleString()}`, tone: "down" },
        ],
        table: {
          head: ["Expense Category", "Amount (Tk)"],
          rows: profitBreakdown.expense_categories.map((c) => [c.name, c.total.toLocaleString()]),
          emptyLabel: "No expense entries this month",
        },
        footerNote: "Generated from Phone Fantasy — Dashboard (This Month's Profit)",
      },
      previewWin
    );
  }

  function downloadSubReport() {
    if (!subKind) return;
    const previewWin = window.open("", "_blank");
    if (subKind === "stockProfitMonth") {
      generateReportPDF(
        {
          shopName: "Phone Fantasy",
          title: "Stock Profit Detail",
          subtitle: "This Month",
          summary: [{ label: "Stock Profit", value: `Tk ${(profitBreakdown?.stock_profit ?? 0).toLocaleString()}`, tone: "up" }],
          table: {
            head: ["Model", "IMEI", "Buy Date", "Buy Price (Tk)", "Sell Price (Tk)", "Profit (Tk)"],
            rows: (subStockProfit || []).map((s) => [
              s.name_model,
              s.imei,
              (s.buy_date || "-").toString().slice(0, 10),
              Number(s.buy_price).toLocaleString(),
              Number(s.selling_price).toLocaleString(),
              Number(s.profit).toLocaleString(),
            ]),
            emptyLabel: "No sales this month",
          },
          footerNote: "Generated from Phone Fantasy — Dashboard",
        },
        previewWin
      );
    } else if (subKind === "outsideProfitMonth") {
      generateReportPDF(
        {
          shopName: "Phone Fantasy",
          title: "Outside Sell Profit Detail",
          subtitle: "This Month",
          summary: [{ label: "Outside Sell Profit", value: `Tk ${(profitBreakdown?.outside_profit ?? 0).toLocaleString()}`, tone: "up" }],
          table: {
            head: ["Model", "IMEI", "Sell Date", "Profit (Tk)"],
            rows: (subOutsideDeals || []).map((d) => [
              d.model || d.name,
              d.imei || "-",
              (d.sell_date || "-").toString().slice(0, 10),
              Number(d.profit).toLocaleString(),
            ]),
            emptyLabel: "No Outside Sell entries this month",
          },
          footerNote: "Generated from Phone Fantasy — Dashboard",
        },
        previewWin
      );
    } else if (subKind === "cashSalesPaid") {
      generateReportPDF(
        {
          shopName: "Phone Fantasy",
          title: "Sales Received Detail",
          subtitle: `As of ${todayLabel()}`,
          summary: [{ label: "Sales Received", value: `Tk ${(cashBreakdown?.sales_paid ?? 0).toLocaleString()}`, tone: "up" }],
          table: {
            head: ["Model", "IMEI", "Paid (Tk)"],
            rows: (subCashSales || []).map((s) => [s.name_model, s.imei, Number(s.paid_amount).toLocaleString()]),
            emptyLabel: "No sales yet",
          },
          footerNote: "Generated from Phone Fantasy — Dashboard (Total Cash, all-time)",
        },
        previewWin
      );
    } else if (subKind === "cashOutsideProfit") {
      generateReportPDF(
        {
          shopName: "Phone Fantasy",
          title: "Outside Sell Profit Detail",
          subtitle: `As of ${todayLabel()}`,
          summary: [{ label: "Outside Sell Profit", value: `Tk ${(cashBreakdown?.outside_profit ?? 0).toLocaleString()}`, tone: "up" }],
          table: {
            head: ["Model / IMEI", "Profit (Tk)"],
            rows: (subOutsideDeals || []).map((d) => [d.model || d.name, Number(d.profit).toLocaleString()]),
            emptyLabel: "No Outside Sell entries yet",
          },
          footerNote: "Generated from Phone Fantasy — Dashboard (Total Cash, all-time)",
        },
        previewWin
      );
    } else {
      generateReportPDF(
        {
          shopName: "Phone Fantasy",
          title: "Loan Cash-In Detail",
          subtitle: `As of ${todayLabel()}`,
          summary: [{ label: "Loan Cash In", value: `Tk ${(cashBreakdown?.loan_cash_in ?? 0).toLocaleString()}`, tone: "up" }],
          table: {
            head: ["Person", "Type", "Amount (Tk)", "Date"],
            rows: (subLoanIn || []).map((e) => [
              e.person_name,
              e.direction === "taken" ? "Taken" : "Repayment Received",
              Number(e.amount).toLocaleString(),
              (e.entry_date || "-").toString().slice(0, 10),
            ]),
            emptyLabel: "No loan cash-in entries yet",
          },
          footerNote: "Generated from Phone Fantasy — Dashboard (Total Cash, all-time)",
        },
        previewWin
      );
    }
  }

  const cashPositive = (summary?.total_cash ?? 0) >= 0;
  const profitPositive = (summary?.profit_till_now ?? 0) >= 0;

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={openCashBreakdown}
        className="phone-card w-full text-left transition active:scale-[0.99]"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-muted">টোটাল ক্যাশ (এখন পর্যন্ত)</p>
          <Wallet2 size={16} className="text-gold" />
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <p
            className={`tabular font-display text-3xl font-extrabold ${
              cashPositive ? "text-up" : "text-down"
            }`}
          >
            ৳{money(summary?.total_cash)}
          </p>
          <ChevronRight size={18} className="text-ink-faint" />
        </div>
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <StatTile icon={CalendarCheck2} label="আজকের সেল" value={summary?.today_sale} tone="up" onClick={openTodayBreakdown} />
        <StatTile icon={ShoppingBag} label="মোট ক্রয়" value={summary?.total_buy} tone="down" onClick={openBuyBreakdown} />
        <StatTile icon={Boxes} label="স্টক" value={summary?.stock_count} tone="default" isCount />
        <StatTile
          icon={TrendingUp}
          label="এই মাসের প্রফিট"
          value={summary?.profit_till_now}
          tone={profitPositive ? "up" : "down"}
          onClick={openProfitBreakdown}
        />
      </div>

      {/* ---- টোটাল ক্যাশ ---- */}
      <Sheet open={cashOpen} onClose={() => setCashOpen(false)} title="টোটাল ক্যাশের হিসাব">
        {cashLoading && !cashBreakdown ? (
          <p className="py-6 text-center text-sm text-ink-muted">লোড হচ্ছে...</p>
        ) : cashBreakdown ? (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold text-up">যা যোগ হয়েছে (ক্যাশ ইন)</p>
              <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                <BreakdownRow
                  label="সেল থেকে পাওয়া টাকা"
                  value={cashBreakdown.sales_paid}
                  tone="up"
                  onClick={() => openSub("cashSalesPaid")}
                />
                <BreakdownRow
                  label="Outside Sell প্রফিট"
                  value={cashBreakdown.outside_profit}
                  tone="up"
                  onClick={() => openSub("cashOutsideProfit")}
                />
                <BreakdownRow
                  label="ধার থেকে পাওয়া টাকা"
                  value={cashBreakdown.loan_cash_in}
                  tone="up"
                  onClick={() => openSub("cashLoanIn")}
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-down">যা বিয়োগ হয়েছে (ক্যাশ আউট)</p>
              <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                <BreakdownRow label="মোট ক্রয় (স্টক)" value={cashBreakdown.total_buy} tone="down" negative />
                <BreakdownRow label="মোট খরচ" value={cashBreakdown.expenses} tone="down" negative />
                <BreakdownRow label="ধার হিসেবে দেওয়া টাকা" value={cashBreakdown.loan_cash_out} tone="down" negative />
              </div>
            </div>
            {cashBreakdown.adjustment !== 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-ink-muted">ম্যানুয়াল এডজাস্টমেন্ট</p>
                <div className="rounded-xl border border-border bg-surface-2 p-3">
                  <BreakdownRow
                    label="সেটিংস থেকে ঠিক করা হয়েছে"
                    value={cashBreakdown.adjustment}
                    tone={cashBreakdown.adjustment >= 0 ? "up" : "down"}
                    negative={cashBreakdown.adjustment < 0}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">টোটাল ক্যাশ</p>
              <p
                className={`tabular font-display text-xl font-extrabold ${
                  cashBreakdown.total_cash >= 0 ? "text-up" : "text-down"
                }`}
              >
                ৳{money(cashBreakdown.total_cash)}
              </p>
            </div>
            <DownloadPdfButton onClick={downloadCashReport} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">তথ্য লোড করা যায়নি</p>
        )}
      </Sheet>

      {/* ---- আজকের সেল ---- */}
      <Sheet open={todayOpen} onClose={() => setTodayOpen(false)} title="আজকের সেলের হিসাব">
        {todayLoading && !todayBreakdown ? (
          <p className="py-6 text-center text-sm text-ink-muted">লোড হচ্ছে...</p>
        ) : todayBreakdown ? (
          <div className="space-y-4">
            {todayBreakdown.stockSales.length === 0 && todayBreakdown.outsideSales.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-ink-muted">
                আজ এখনো কোনো সেল হয়নি
              </p>
            ) : (
              <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                {todayBreakdown.stockSales.map((s, i) => (
                  <BreakdownRow key={`s-${i}`} label={s.name_model} value={s.selling_price} tone="up" />
                ))}
                {todayBreakdown.outsideSales.map((o, i) => (
                  <BreakdownRow key={`o-${i}`} label={`${o.model || o.name} (Outside)`} value={o.profit} tone="up" />
                ))}
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">আজকের মোট</p>
              <p className="tabular font-display text-xl font-extrabold text-up">৳{money(todayBreakdown.total)}</p>
            </div>
            <DownloadPdfButton onClick={downloadTodayReport} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">তথ্য লোড করা যায়নি</p>
        )}
      </Sheet>

      {/* ---- মোট ক্রয় ---- */}
      <Sheet open={buyOpen} onClose={() => setBuyOpen(false)} title="মোট ক্রয়ের হিসাব">
        {buyLoading && !buyBreakdown ? (
          <p className="py-6 text-center text-sm text-ink-muted">লোড হচ্ছে...</p>
        ) : buyBreakdown ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-surface-2 p-2.5">
                <p className="text-[11px] text-ink-muted">স্টকে আছে (Unsold)</p>
                <p className="tabular font-semibold">৳{money(buyBreakdown.unsoldValue)}</p>
              </div>
              <div className="rounded-xl bg-surface-2 p-2.5">
                <p className="text-[11px] text-ink-muted">বিক্রি হয়েছে (Sold)</p>
                <p className="tabular font-semibold">৳{money(buyBreakdown.soldValue)}</p>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
              {buyBreakdown.phones.map((p, i) => (
                <BreakdownRow key={i} label={p.name_model} value={p.buy_price} tone="down" negative />
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">মোট ক্রয়</p>
              <p className="tabular font-display text-xl font-extrabold text-down">৳{money(buyBreakdown.total)}</p>
            </div>
            <DownloadPdfButton onClick={downloadBuyReport} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">তথ্য লোড করা যায়নি</p>
        )}
      </Sheet>

      {/* ---- এই মাসের প্রফিট ---- */}
      <Sheet open={profitOpen} onClose={() => setProfitOpen(false)} title="এই মাসের প্রফিটের হিসাব">
        {profitLoading && !profitBreakdown ? (
          <p className="py-6 text-center text-sm text-ink-muted">লোড হচ্ছে...</p>
        ) : profitBreakdown ? (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold text-up">যা যোগ হয়েছে (লাভ)</p>
              <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                <BreakdownRow
                  label="স্টক প্রফিট (এই মাসের সেল থেকে)"
                  value={profitBreakdown.stock_profit}
                  tone="up"
                  onClick={() => openSub("stockProfitMonth")}
                />
                <BreakdownRow
                  label="Outside Sell প্রফিট"
                  value={profitBreakdown.outside_profit}
                  tone="up"
                  onClick={() => openSub("outsideProfitMonth")}
                />
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
            <DownloadPdfButton onClick={downloadProfitReport} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">তথ্য লোড করা যায়নি</p>
        )}
      </Sheet>

      {/* ---- নেস্টেড ডিটেইলস — কোন প্রোডাক্ট/এন্ট্রি থেকে এই টাকা এলো ---- */}
      <Sheet
        open={subKind !== null}
        onClose={() => setSubKind(null)}
        title={
          subKind === "stockProfitMonth"
            ? "স্টক প্রফিটের ডিটেইলস (এই মাসে)"
            : subKind === "outsideProfitMonth"
            ? "Outside Sell প্রফিটের ডিটেইলস (এই মাসে)"
            : subKind === "cashSalesPaid"
            ? "সেল থেকে পাওয়া টাকার ডিটেইলস"
            : subKind === "cashOutsideProfit"
            ? "Outside Sell প্রফিটের ডিটেইলস (সর্বমোট)"
            : "ধার থেকে পাওয়া টাকার ডিটেইলস"
        }
      >
        {subLoading ? (
          <p className="py-6 text-center text-sm text-ink-muted">লোড হচ্ছে...</p>
        ) : subKind === "stockProfitMonth" ? (
          subStockProfit && subStockProfit.length > 0 ? (
            <div className="space-y-3">
              <div className="max-h-72 overflow-y-auto space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                {subStockProfit.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <p className="text-sm text-ink-muted truncate">{s.name_model}</p>
                    <p className={`tabular text-sm font-semibold shrink-0 ${Number(s.profit) >= 0 ? "text-up" : "text-down"}`}>
                      {Number(s.profit) >= 0 ? "+" : ""}৳{money(s.profit)}
                    </p>
                  </div>
                ))}
              </div>
              <DownloadPdfButton onClick={downloadSubReport} />
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-ink-muted">এই মাসে কোনো স্টক সেল নেই</p>
          )
        ) : subKind === "outsideProfitMonth" || subKind === "cashOutsideProfit" ? (
          subOutsideDeals && subOutsideDeals.length > 0 ? (
            <div className="space-y-3">
              <div className="max-h-72 overflow-y-auto space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                {subOutsideDeals.map((d, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <p className="text-sm text-ink-muted truncate">{d.model || d.name}</p>
                    <p className={`tabular text-sm font-semibold shrink-0 ${Number(d.profit) >= 0 ? "text-up" : "text-down"}`}>
                      {Number(d.profit) >= 0 ? "+" : ""}৳{money(d.profit)}
                    </p>
                  </div>
                ))}
              </div>
              <DownloadPdfButton onClick={downloadSubReport} />
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-ink-muted">কোনো Outside Sell এন্ট্রি নেই</p>
          )
        ) : subKind === "cashSalesPaid" ? (
          subCashSales && subCashSales.length > 0 ? (
            <div className="space-y-3">
              <div className="max-h-72 overflow-y-auto space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                {subCashSales.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <p className="text-sm text-ink-muted truncate">{s.name_model}</p>
                    <p className="tabular text-sm font-semibold shrink-0 text-up">৳{money(s.paid_amount)}</p>
                  </div>
                ))}
              </div>
              <DownloadPdfButton onClick={downloadSubReport} />
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-ink-muted">কোনো সেল এন্ট্রি নেই</p>
          )
        ) : subKind === "cashLoanIn" ? (
          subLoanIn && subLoanIn.length > 0 ? (
            <div className="space-y-3">
              <div className="max-h-72 overflow-y-auto space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                {subLoanIn.map((e, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <p className="text-sm text-ink-muted truncate">
                      {e.person_name}{" "}
                      <span className="text-[11px] text-ink-faint">
                        ({e.direction === "taken" ? "ধার নিয়েছেন" : "ফেরত দিয়েছেন"})
                      </span>
                    </p>
                    <p className="tabular text-sm font-semibold shrink-0 text-up">৳{money(e.amount)}</p>
                  </div>
                ))}
              </div>
              <DownloadPdfButton onClick={downloadSubReport} />
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-ink-muted">কোনো এন্ট্রি নেই</p>
          )
        ) : null}
      </Sheet>
    </div>
  );
}

export function DownloadPdfButton({ onClick }: { onClick: () => void }) {
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

function BreakdownRow({
  label,
  value,
  tone,
  negative = false,
  onClick,
}: {
  label: string;
  value: number;
  tone: "up" | "down";
  negative?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <p className="text-sm text-ink-muted truncate">{label}</p>
      <div className="flex shrink-0 items-center gap-1">
        <p className={`tabular text-sm font-semibold ${tone === "up" ? "text-up" : "text-down"}`}>
          {negative ? "−" : "+"}৳{money(Math.abs(value))}
        </p>
        {onClick && <ChevronRight size={13} className="text-ink-faint" />}
      </div>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 text-left">
        {inner}
      </button>
    );
  }
  return <div className="flex items-center justify-between gap-3">{inner}</div>;
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
