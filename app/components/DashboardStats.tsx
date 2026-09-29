"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet2, Wallet, Receipt, CalendarCheck2, ShoppingCart, ShoppingBag, Boxes, TrendingUp, ChevronRight, Download } from "lucide-react";
import { money, formatDate, Sheet, monthRange, currentMonthStr, Field, Button, inputClass } from "./ui";
import { DASHBOARD_REFRESH_EVENT, emitDashboardRefresh } from "@/lib/events";
import { generateReportPDF } from "@/lib/report-pdf";
import { printSalesInvoice } from "@/lib/sales-invoice";
import { useLang } from "@/lib/i18n";
import type { DashboardSummary } from "@/lib/types";

const POLL_MS = 8000;

interface ExpenseCategoryBreakdown {
  name: string;
  total: number;
}

interface ProfitBreakdown {
  stock_profit: number;
  expense_categories: ExpenseCategoryBreakdown[];
  total_expense: number;
  net_profit: number;
}

interface CashBreakdown {
  total_cash: number;
  sales_paid: number;
  total_buy: number;
  expenses: number;
  adjustment: number;
}

interface StockSaleRow {
  name_model: string;
  imei: string;
  selling_price: number;
}

interface TodaySaleBreakdown {
  stockSales: StockSaleRow[];
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

interface GadgetBuyRow {
  buy_name: string;
  buy_price: number;
  quantity: number;
  created_at: string;
}

interface TodayBuyBreakdown {
  phones: BuyPhoneRow[];
  gadgets: GadgetBuyRow[];
  phonesTotal: number;
  gadgetsTotal: number;
  total: number;
}

// A customer's outstanding balance from either a phone sale or a gadget
// sale, normalized into one shape so both can sit in the same list. `raw`
// keeps the original row so a memo can be printed from it on demand.
interface DueSaleRow {
  kind: "phone" | "gadget";
  id: number;
  label: string;
  customerName: string | null;
  customerPhone: string | null;
  totalAmount: number;
  dueAmount: number;
  paidAmount: number;
  raw: any;
}

interface DueBreakdown {
  rows: DueSaleRow[];
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

type SubDetailKind = "stockProfitMonth" | "cashSalesPaid";

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
  const { t } = useLang();
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

  const [todayBuyOpen, setTodayBuyOpen] = useState(false);
  const [todayBuyBreakdown, setTodayBuyBreakdown] = useState<TodayBuyBreakdown | null>(null);
  const [todayBuyLoading, setTodayBuyLoading] = useState(false);

  const [dueOpen, setDueOpen] = useState(false);
  const [dueBreakdown, setDueBreakdown] = useState<DueBreakdown | null>(null);
  const [dueLoading, setDueLoading] = useState(false);

  // Drilled into from the due list -- collecting a full or partial
  // payment for one specific due sale (phone or gadget).
  const [collectDue, setCollectDue] = useState<DueSaleRow | null>(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [collectSaving, setCollectSaving] = useState(false);
  const [collectError, setCollectError] = useState("");

  // Nested details — clicking a line inside an already-open breakdown
  // sheet shows exactly which products/entries that money came from.
  const [subKind, setSubKind] = useState<SubDetailKind | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subStockProfit, setSubStockProfit] = useState<StockProfitRow[] | null>(null);
  const [subCashSales, setSubCashSales] = useState<CashSalePaidRow[] | null>(null);

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
      // transient network error — sheet will just show empty/stale
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
      const sRes = await fetch(`/api/sales?from=${today}&to=${today}`, { cache: "no-store" });
      const sData: any = sRes.ok ? await sRes.json() : { sales: [] };
      const stockSales: StockSaleRow[] = (sData.sales || []).map((s: any) => ({
        name_model: s.name_model,
        imei: s.imei,
        selling_price: s.selling_price,
      }));
      const total = stockSales.reduce((s, r) => s + Number(r.selling_price), 0);
      setTodayBreakdown({ stockSales, total });
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

  // Today's phone buys (Stock, date-filtered via /api/stock's from/to) +
  // today's gadget buys (filtered client-side since /api/gadgets has no
  // date filter of its own -- the list is small, this is cheap).
  const openTodayBuyBreakdown = useCallback(async () => {
    setTodayBuyOpen(true);
    setTodayBuyLoading(true);
    try {
      const today = todayStr();
      const [pRes, gRes] = await Promise.all([
        fetch(`/api/stock?from=${today}&to=${today}`, { cache: "no-store" }),
        fetch(`/api/gadgets`, { cache: "no-store" }),
      ]);
      const pData: any = pRes.ok ? await pRes.json() : { phones: [] };
      const gData: any = gRes.ok ? await gRes.json() : { gadgets: [] };
      const phones: BuyPhoneRow[] = (pData.phones || []).map((p: any) => ({
        name_model: p.name_model,
        imei: p.imei,
        buy_price: p.buy_price,
        buy_date: p.buy_date,
        status: p.status,
      }));
      const gadgets: GadgetBuyRow[] = (gData.gadgets || [])
        .filter((g: any) => (g.created_at || "").slice(0, 10) === today)
        .map((g: any) => ({
          buy_name: g.buy_name,
          buy_price: g.buy_price,
          quantity: g.quantity,
          created_at: g.created_at,
        }));
      const phonesTotal = phones.reduce((s, p) => s + Number(p.buy_price), 0);
      const gadgetsTotal = gadgets.reduce((s, g) => s + Number(g.buy_price) * Number(g.quantity), 0);
      setTodayBuyBreakdown({ phones, gadgets, phonesTotal, gadgetsTotal, total: phonesTotal + gadgetsTotal });
    } catch {
      // transient network error
    } finally {
      setTodayBuyLoading(false);
    }
  }, []);

  // Combined outstanding due -- phone sales (GET /api/sales?due_only=1) +
  // gadget sales (GET /api/gadgets/due) -- sorted highest-due first.
  const openDueBreakdown = useCallback(async () => {
    setDueOpen(true);
    setDueLoading(true);
    try {
      const [pRes, gRes] = await Promise.all([
        fetch(`/api/sales?due_only=1`, { cache: "no-store" }),
        fetch(`/api/gadgets/due`, { cache: "no-store" }),
      ]);
      const pData: any = pRes.ok ? await pRes.json() : { sales: [] };
      const gData: any = gRes.ok ? await gRes.json() : { sales: [] };
      const phoneRows: DueSaleRow[] = (pData.sales || []).map((s: any) => ({
        kind: "phone" as const,
        id: s.id,
        label: s.name_model,
        customerName: s.customer_name,
        customerPhone: s.customer_phone,
        totalAmount: s.selling_price,
        dueAmount: s.due_amount,
        paidAmount: s.paid_amount,
        raw: s,
      }));
      const gadgetRows: DueSaleRow[] = (gData.sales || []).map((s: any) => ({
        kind: "gadget" as const,
        id: s.id,
        label: s.buy_name,
        customerName: s.customer_name,
        customerPhone: s.customer_phone,
        totalAmount: s.sell_price,
        dueAmount: s.due_amount,
        paidAmount: s.paid_amount,
        raw: s,
      }));
      const rows = [...phoneRows, ...gadgetRows].sort((a, b) => Number(b.dueAmount) - Number(a.dueAmount));
      const total = rows.reduce((s, r) => s + Number(r.dueAmount), 0);
      setDueBreakdown({ rows, total });
    } catch {
      // transient network error
    } finally {
      setDueLoading(false);
    }
  }, []);

  // Prints/reprints the memo for one due sale, straight from the
  // breakdown -- phones reuse the full Sales Invoice with all their
  // fields; gadgets go through the same template with no IMEI (there
  // isn't one) and none of the phone-only fields.
  async function viewDueMemo(row: DueSaleRow) {
    const previewWin = window.open("", "_blank");
    const s = row.raw;
    if (row.kind === "phone") {
      await printSalesInvoice(
        {
          saleId: s.id,
          nameModel: s.name_model,
          imei: s.imei,
          sellingPrice: s.selling_price,
          sellingDate: s.selling_date,
          isDue: !!s.is_due,
          customerName: s.customer_name,
          customerPhone: s.customer_phone,
          customerAddress: s.customer_address,
          customerEmail: s.customer_email,
          narration: s.narration,
          paidAmount: s.paid_amount,
          dueAmount: s.due_amount,
          ramRom: s.ram_rom,
          batteryHealth: s.battery_health,
          variant: s.variant,
          color: s.color,
        },
        previewWin
      );
    } else {
      await printSalesInvoice(
        {
          saleId: s.id,
          nameModel: s.buy_name,
          imei: "-",
          sellingPrice: s.sell_price,
          sellingDate: s.sold_at,
          isDue: true,
          customerName: s.customer_name,
          customerPhone: s.customer_phone,
          paidAmount: s.paid_amount,
          dueAmount: s.due_amount,
        },
        previewWin
      );
    }
  }

  function openCollect(row: DueSaleRow) {
    setCollectDue(row);
    setCollectAmount("");
    setCollectError("");
  }

  async function backFromCollect() {
    setCollectDue(null);
    // A payment may have just changed the due list and the all-time total.
    await Promise.all([openDueBreakdown(), load()]);
  }

  async function submitCollectDue() {
    if (!collectDue) return;
    setCollectError("");
    if (!collectAmount || Number(collectAmount) <= 0) {
      setCollectError(t("stock.invalid_amount"));
      return;
    }
    setCollectSaving(true);
    const endpoint = collectDue.kind === "phone" ? "/api/due-payments" : "/api/gadget-due-payments";
    const payload =
      collectDue.kind === "phone"
        ? { sale_id: collectDue.id, amount: Number(collectAmount) }
        : { gadget_sale_id: collectDue.id, amount: Number(collectAmount) };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setCollectSaving(false);
    const d: any = await res.json();
    if (!res.ok) {
      setCollectError(d.error || t("stock.save_failed"));
      return;
    }
    setCollectDue({ ...collectDue, dueAmount: d.due_amount, paidAmount: d.paid_amount });
    setCollectAmount("");
    emitDashboardRefresh();
  }

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
      } else if (kind === "cashSalesPaid") {
        const res = await fetch(`/api/sales`, { cache: "no-store" });
        const data: any = res.ok ? await res.json() : { sales: [] };
        setSubCashSales(
          (data.sales || [])
            .filter((s: any) => Number(s.paid_amount) > 0)
            .map((s: any) => ({ name_model: s.name_model, imei: s.imei, paid_amount: s.paid_amount }))
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
        shopName: "Apple Store Satkhira",
        title: "Total Cash Report",
        subtitle: `As of ${todayLabel()}`,
        summary: [
          { label: "Total Cash", value: `Tk ${cashBreakdown.total_cash.toLocaleString()}`, tone: cashBreakdown.total_cash >= 0 ? "up" : "down" },
          { label: "Sales Received", value: `Tk ${cashBreakdown.sales_paid.toLocaleString()}`, tone: "up" },
          { label: "Total Buy (Stock)", value: `Tk ${cashBreakdown.total_buy.toLocaleString()}`, tone: "down" },
          { label: "Total Expenses", value: `Tk ${cashBreakdown.expenses.toLocaleString()}`, tone: "down" },
          { label: "Manual Adjustment", value: `Tk ${cashBreakdown.adjustment.toLocaleString()}` },
        ],
        footerNote: "Generated from Apple Store Satkhira — Total Cash (all-time)",
      },
      previewWin
    );
  }

  function downloadTodayReport() {
    if (!todayBreakdown) return;
    const previewWin = window.open("", "_blank");
    const rows: (string | number)[][] = todayBreakdown.stockSales.map((s) => [
      "Stock Sale",
      s.name_model,
      s.imei,
      s.selling_price.toLocaleString(),
    ]);
    generateReportPDF(
      {
        shopName: "Apple Store Satkhira",
        title: "Today's Sale Report",
        subtitle: todayLabel(),
        summary: [{ label: "Total (Today)", value: `Tk ${todayBreakdown.total.toLocaleString()}`, tone: "up" }],
        table: {
          head: ["Source", "Model", "IMEI", "Amount (Tk)"],
          rows,
          emptyLabel: "No sales today",
        },
        footerNote: "Generated from Apple Store Satkhira — Dashboard",
      },
      previewWin
    );
  }

  function downloadBuyReport() {
    if (!buyBreakdown) return;
    const previewWin = window.open("", "_blank");
    generateReportPDF(
      {
        shopName: "Apple Store Satkhira",
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
        footerNote: "Generated from Apple Store Satkhira — Total Buy (all-time)",
      },
      previewWin
    );
  }

  function downloadTodayBuyReport() {
    if (!todayBuyBreakdown) return;
    const previewWin = window.open("", "_blank");
    const rows: (string | number)[][] = [
      ...todayBuyBreakdown.phones.map((p) => ["Phone", p.name_model, p.imei, Number(p.buy_price).toLocaleString()]),
      ...todayBuyBreakdown.gadgets.map((g) => [
        "Gadget",
        g.buy_name,
        `x${g.quantity}`,
        (Number(g.buy_price) * Number(g.quantity)).toLocaleString(),
      ]),
    ];
    generateReportPDF(
      {
        shopName: "Apple Store Satkhira",
        title: "Today's Buy Report",
        subtitle: todayLabel(),
        summary: [{ label: "Total (Today)", value: `Tk ${todayBuyBreakdown.total.toLocaleString()}`, tone: "down" }],
        table: {
          head: ["Type", "Item", "IMEI / Qty", "Amount (Tk)"],
          rows,
          emptyLabel: "No purchases today",
        },
        footerNote: "Generated from Apple Store Satkhira — Dashboard",
      },
      previewWin
    );
  }

  function downloadDueReport() {
    if (!dueBreakdown) return;
    const previewWin = window.open("", "_blank");
    generateReportPDF(
      {
        shopName: "Apple Store Satkhira",
        title: "Due Outstanding Report",
        subtitle: `As of ${todayLabel()}`,
        summary: [{ label: "Total Due Outstanding", value: `Tk ${dueBreakdown.total.toLocaleString()}` }],
        table: {
          head: ["Item", "Customer", "Phone", "Due (Tk)"],
          rows: dueBreakdown.rows.map((r) => [r.label, r.customerName || "-", r.customerPhone || "-", Number(r.dueAmount).toLocaleString()]),
          emptyLabel: "No outstanding due",
        },
        footerNote: "Generated from Apple Store Satkhira — Dashboard (all-time)",
      },
      previewWin
    );
  }

  function downloadProfitReport() {
    if (!profitBreakdown) return;
    const previewWin = window.open("", "_blank");
    generateReportPDF(
      {
        shopName: "Apple Store Satkhira",
        title: "Profit Report",
        subtitle: "This Month",
        summary: [
          { label: "Net Profit", value: `Tk ${profitBreakdown.net_profit.toLocaleString()}`, tone: profitBreakdown.net_profit >= 0 ? "up" : "down" },
          { label: "Stock Profit", value: `Tk ${profitBreakdown.stock_profit.toLocaleString()}`, tone: "up" },
          { label: "Total Expense", value: `Tk ${profitBreakdown.total_expense.toLocaleString()}`, tone: "down" },
        ],
        table: {
          head: ["Expense Category", "Amount (Tk)"],
          rows: profitBreakdown.expense_categories.map((c) => [c.name, c.total.toLocaleString()]),
          emptyLabel: "No expense entries this month",
        },
        footerNote: "Generated from Apple Store Satkhira — Dashboard (This Month's Profit)",
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
          shopName: "Apple Store Satkhira",
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
          footerNote: "Generated from Apple Store Satkhira — Dashboard",
        },
        previewWin
      );
    } else if (subKind === "cashSalesPaid") {
      generateReportPDF(
        {
          shopName: "Apple Store Satkhira",
          title: "Sales Received Detail",
          subtitle: `As of ${todayLabel()}`,
          summary: [{ label: "Sales Received", value: `Tk ${(cashBreakdown?.sales_paid ?? 0).toLocaleString()}`, tone: "up" }],
          table: {
            head: ["Model", "IMEI", "Paid (Tk)"],
            rows: (subCashSales || []).map((s) => [s.name_model, s.imei, Number(s.paid_amount).toLocaleString()]),
            emptyLabel: "No sales yet",
          },
          footerNote: "Generated from Apple Store Satkhira — Dashboard (Total Cash, all-time)",
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
          <p className="text-xs text-ink-muted">{t("dashboard.total_cash_label")}</p>
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
        <StatTile icon={CalendarCheck2} label={t("dashboard.today_sale_label")} value={summary?.today_sale} tone="up" onClick={openTodayBreakdown} />
        <StatTile icon={ShoppingCart} label={t("dashboard.today_buy_label")} value={summary?.today_buy} tone="down" onClick={openTodayBuyBreakdown} />
        <StatTile icon={ShoppingBag} label={t("dashboard.total_buy_label")} value={summary?.total_buy} tone="down" onClick={openBuyBreakdown} />
        <StatTile icon={Boxes} label={t("dashboard.stock_label")} value={summary?.stock_count} tone="default" isCount />
        <StatTile
          icon={TrendingUp}
          label={t("dashboard.month_profit_label")}
          value={summary?.profit_till_now}
          tone={profitPositive ? "up" : "down"}
          onClick={openProfitBreakdown}
        />
        <StatTile icon={Wallet} label={t("dashboard.due_label")} value={summary?.total_due_outstanding} tone="due" onClick={openDueBreakdown} />
      </div>

      {/* ---- Total Cash ---- */}
      <Sheet open={cashOpen} onClose={() => setCashOpen(false)} title={t("dashboard.total_cash_sheet_title")}>
        {cashLoading && !cashBreakdown ? (
          <p className="py-6 text-center text-sm text-ink-muted">{t("dashboard.loading")}</p>
        ) : cashBreakdown ? (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold text-up">{t("dashboard.cash_in_heading")}</p>
              <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                <BreakdownRow
                  label={t("dashboard.sales_received_label")}
                  value={cashBreakdown.sales_paid}
                  tone="up"
                  onClick={() => openSub("cashSalesPaid")}
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-down">{t("dashboard.cash_out_heading")}</p>
              <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                <BreakdownRow label={t("dashboard.total_buy_stock_label")} value={cashBreakdown.total_buy} tone="down" negative />
                <BreakdownRow label={t("dashboard.total_expense_label")} value={cashBreakdown.expenses} tone="down" negative />
              </div>
            </div>
            {cashBreakdown.adjustment !== 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-ink-muted">{t("dashboard.manual_adjustment_heading")}</p>
                <div className="rounded-xl border border-border bg-surface-2 p-3">
                  <BreakdownRow
                    label={t("dashboard.settings_adjustment_label")}
                    value={cashBreakdown.adjustment}
                    tone={cashBreakdown.adjustment >= 0 ? "up" : "down"}
                    negative={cashBreakdown.adjustment < 0}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">{t("dashboard.total_cash_label_short")}</p>
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
          <p className="py-6 text-center text-sm text-ink-muted">{t("dashboard.data_load_failed")}</p>
        )}
      </Sheet>

      {/* ---- Today's Sale ---- */}
      <Sheet open={todayOpen} onClose={() => setTodayOpen(false)} title={t("dashboard.today_sale_sheet_title")}>
        {todayLoading && !todayBreakdown ? (
          <p className="py-6 text-center text-sm text-ink-muted">{t("dashboard.loading")}</p>
        ) : todayBreakdown ? (
          <div className="space-y-4">
            {todayBreakdown.stockSales.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-ink-muted">
                {t("dashboard.no_sales_today")}
              </p>
            ) : (
              <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                {todayBreakdown.stockSales.map((s, i) => (
                  <BreakdownRow key={`s-${i}`} label={s.name_model} value={s.selling_price} tone="up" />
                ))}
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">{t("dashboard.today_total_label")}</p>
              <p className="tabular font-display text-xl font-extrabold text-up">৳{money(todayBreakdown.total)}</p>
            </div>
            <DownloadPdfButton onClick={downloadTodayReport} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">{t("dashboard.data_load_failed")}</p>
        )}
      </Sheet>

      {/* ---- Today's Buy ---- */}
      <Sheet open={todayBuyOpen} onClose={() => setTodayBuyOpen(false)} title={t("dashboard.today_buy_sheet_title")}>
        {todayBuyLoading && !todayBuyBreakdown ? (
          <p className="py-6 text-center text-sm text-ink-muted">{t("dashboard.loading")}</p>
        ) : todayBuyBreakdown ? (
          <div className="space-y-4">
            {todayBuyBreakdown.phones.length === 0 && todayBuyBreakdown.gadgets.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-ink-muted">
                {t("dashboard.no_buys_today")}
              </p>
            ) : (
              <>
                {todayBuyBreakdown.phones.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-ink-muted">{t("dashboard.today_buy_phones_heading")}</p>
                    <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                      {todayBuyBreakdown.phones.map((p, i) => (
                        <BreakdownRow key={`p-${i}`} label={p.name_model} value={p.buy_price} tone="down" negative />
                      ))}
                    </div>
                  </div>
                )}
                {todayBuyBreakdown.gadgets.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-ink-muted">{t("dashboard.today_buy_gadgets_heading")}</p>
                    <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                      {todayBuyBreakdown.gadgets.map((g, i) => (
                        <BreakdownRow
                          key={`g-${i}`}
                          label={g.quantity > 1 ? `${g.buy_name} (x${g.quantity})` : g.buy_name}
                          value={Number(g.buy_price) * Number(g.quantity)}
                          tone="down"
                          negative
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">{t("dashboard.today_buy_total_label")}</p>
              <p className="tabular font-display text-xl font-extrabold text-down">৳{money(todayBuyBreakdown.total)}</p>
            </div>
            <DownloadPdfButton onClick={downloadTodayBuyReport} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">{t("dashboard.data_load_failed")}</p>
        )}
      </Sheet>

      {/* ---- Total Buy ---- */}
      <Sheet open={buyOpen} onClose={() => setBuyOpen(false)} title={t("dashboard.total_buy_sheet_title")}>
        {buyLoading && !buyBreakdown ? (
          <p className="py-6 text-center text-sm text-ink-muted">{t("dashboard.loading")}</p>
        ) : buyBreakdown ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-surface-2 p-2.5">
                <p className="text-[11px] text-ink-muted">{t("dashboard.in_stock_unsold_label")}</p>
                <p className="tabular text-sm font-semibold">৳{money(buyBreakdown.unsoldValue)}</p>
              </div>
              <div className="rounded-xl bg-surface-2 p-2.5">
                <p className="text-[11px] text-ink-muted">{t("dashboard.sold_label")}</p>
                <p className="tabular text-sm font-semibold">৳{money(buyBreakdown.soldValue)}</p>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
              {buyBreakdown.phones.map((p, i) => (
                <BreakdownRow key={i} label={p.name_model} value={p.buy_price} tone="down" negative />
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">{t("dashboard.total_buy_label")}</p>
              <p className="tabular font-display text-xl font-extrabold text-down">৳{money(buyBreakdown.total)}</p>
            </div>
            <DownloadPdfButton onClick={downloadBuyReport} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">{t("dashboard.data_load_failed")}</p>
        )}
      </Sheet>

      {/* ---- This Month's Profit ---- */}
      <Sheet open={profitOpen} onClose={() => setProfitOpen(false)} title={t("dashboard.month_profit_sheet_title")}>
        {profitLoading && !profitBreakdown ? (
          <p className="py-6 text-center text-sm text-ink-muted">{t("dashboard.loading")}</p>
        ) : profitBreakdown ? (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold text-up">{t("dashboard.profit_added_heading")}</p>
              <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                <BreakdownRow
                  label={t("dashboard.stock_profit_month_label")}
                  value={profitBreakdown.stock_profit}
                  tone="up"
                  onClick={() => openSub("stockProfitMonth")}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-down">{t("dashboard.expense_deducted_heading")}</p>
              {profitBreakdown.expense_categories.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-ink-muted">
                  {t("dashboard.no_expense_entries_month")}
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
              <p className="text-sm font-semibold">{t("dashboard.net_profit_month_label")}</p>
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
          <p className="py-6 text-center text-sm text-ink-muted">{t("dashboard.data_load_failed")}</p>
        )}
      </Sheet>

      {/* ---- Due Outstanding — combined phone + gadget dues ---- */}
      <Sheet
        open={dueOpen}
        onClose={() => {
          setDueOpen(false);
          setCollectDue(null);
        }}
        title={collectDue ? `${t("stock.due_sheet_title_prefix")}${collectDue.label}` : t("dashboard.due_sheet_title")}
      >
        {collectDue ? (
          <div className="space-y-4">
            <button type="button" onClick={backFromCollect} className="text-xs font-semibold text-teal">
              {t("profit.back_to_due_list")}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface-2 p-3 text-center">
                <p className="text-xs text-ink-muted">{t("stock.total_selling_price_label")}</p>
                <p className="tabular text-lg font-semibold">৳{money(collectDue.totalAmount)}</p>
              </div>
              <div className="rounded-xl bg-due/10 p-3 text-center">
                <p className="text-xs text-due">{t("stock.due_remaining_label")}</p>
                <p className="tabular text-lg font-semibold text-due">৳{money(collectDue.dueAmount)}</p>
              </div>
            </div>
            {collectDue.customerName && (
              <p className="text-sm text-ink-muted">
                {t("stock.customer_prefix")}
                <span className="text-ink">{collectDue.customerName}</span>{" "}
                {collectDue.customerPhone && `· ${collectDue.customerPhone}`}
              </p>
            )}
            <button
              type="button"
              onClick={() => viewDueMemo(collectDue)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold text-teal"
            >
              <Receipt size={13} /> {t("dashboard.view_memo_button")}
            </button>
            {collectDue.dueAmount > 0 ? (
              <>
                <Field label={t("stock.how_much_paid_label")}>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value)}
                    placeholder="0"
                    className={inputClass}
                  />
                </Field>
                {collectError && <p className="text-sm text-down">{collectError}</p>}
                <Button full onClick={submitCollectDue} disabled={collectSaving}>
                  {collectSaving ? t("stock.saving") : t("stock.add_payment_button")}
                </Button>
              </>
            ) : (
              <p className="text-center text-sm font-medium text-up">{t("stock.fully_paid")}</p>
            )}
          </div>
        ) : dueLoading && !dueBreakdown ? (
          <p className="py-6 text-center text-sm text-ink-muted">{t("dashboard.loading")}</p>
        ) : dueBreakdown ? (
          <div className="space-y-4">
            {dueBreakdown.rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-ink-muted">
                {t("profit.no_due")}
              </p>
            ) : (
              <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                {dueBreakdown.rows.map((r) => (
                  <button
                    key={`${r.kind}-${r.id}`}
                    type="button"
                    onClick={() => openCollect(r)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-surface"
                  >
                    <p className="text-sm text-ink-muted truncate">
                      {r.label} {r.customerName ? `— ${r.customerName}` : ""}
                    </p>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="tabular text-sm font-semibold text-due">৳{money(r.dueAmount)}</span>
                      <ChevronRight size={14} className="text-ink-faint" />
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">{t("dashboard.due_total_label")}</p>
              <p className="tabular font-display text-xl font-extrabold text-due">৳{money(dueBreakdown.total)}</p>
            </div>
            <DownloadPdfButton onClick={downloadDueReport} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">{t("dashboard.data_load_failed")}</p>
        )}
      </Sheet>

      {/* ---- Nested details — which product/entry this money came from ---- */}
      <Sheet
        open={subKind !== null}
        onClose={() => setSubKind(null)}
        title={
          subKind === "stockProfitMonth"
            ? t("dashboard.sub_title_stock_profit_month")
            : t("dashboard.sub_title_cash_sales_paid")
        }
      >
        {subLoading ? (
          <p className="py-6 text-center text-sm text-ink-muted">{t("dashboard.loading")}</p>
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
            <p className="py-6 text-center text-sm text-ink-muted">{t("dashboard.no_stock_sales_month")}</p>
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
            <p className="py-6 text-center text-sm text-ink-muted">{t("dashboard.no_sale_entries")}</p>
          )
        ) : null}
      </Sheet>
    </div>
  );
}

export function DownloadPdfButton({ onClick }: { onClick: () => void }) {
  const { t } = useLang();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold text-teal"
    >
      <Download size={13} /> {t("dashboard.download_pdf")}
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
  wide = false,
}: {
  icon: any;
  label: string;
  value: number | undefined;
  tone: "up" | "down" | "default" | "due";
  isCount?: boolean;
  onClick?: () => void;
  wide?: boolean;
}) {
  const colors: Record<string, string> = {
    up: "text-up",
    down: "text-down",
    default: "text-ink",
    due: "text-due",
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
  const wideClass = wide ? " col-span-2" : "";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`rounded-2xl border border-border bg-surface p-3.5 text-left transition active:scale-[0.97]${wideClass}`}
      >
        {content}
      </button>
    );
  }

  return <div className={`rounded-2xl border border-border bg-surface p-3.5${wideClass}`}>{content}</div>;
}
