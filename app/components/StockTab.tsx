"use client";

import { useEffect, useState } from "react";
import { ScanLine, Printer, Receipt, Wallet, Search, RotateCcw, Undo2, History, Pencil, Trash2, Download, LayoutGrid, ListPlus, X } from "lucide-react";
import { Button, Field, inputClass, Sheet, Modal, Badge, money, formatDate } from "./ui";
import BarcodeScanner from "./BarcodeScanner";
import PrintLabelCell from "./PrintLabelCell";
import { printSalesInvoice } from "@/lib/sales-invoice";
import { generateReportPDF } from "@/lib/report-pdf";
import { emitDashboardRefresh, emitApprovalsRefresh, DASHBOARD_REFRESH_EVENT } from "@/lib/events";
import { useLang } from "@/lib/i18n";
import type { Phone, Sale, PhoneReturn } from "@/lib/types";

const SHOP_NAME = "Apple Store Satkhira";

// A 1.5in x 1.46in label -- a compact landscape size meant to sit on top
// of a phone box -- fits 5 columns x 8 rows on one A4 sheet
// (8.27in / 1.5in = 5, 11.69in / 1.46in = 8) -- chosen so every label has
// enough room for all its details, rather than packing the max the sheet
// could physically hold. A full grid print job is capped at 40 labels.
const QUEUE_CAPACITY = 40;

// The print queue survives a page reload/tab close (localStorage) so the
// shop owner can keep adding a few labels a day and print the full grid
// only once it's worth a sheet of A4 label stock.
const PRINT_QUEUE_STORAGE_KEY = "stock_print_queue_v1";

// Another device/session may buy, sell, return, edit, delete, or have a
// pending POS-Manager change approved while this tab is open -- this is
// how often it quietly checks for that, on top of the instant same-tab
// event below.
const POLL_MS = 8000;

// "YYYY-MM-DD" for today, in the browser's local time -- pre-fills the
// Selling Date field so a normal sale doesn't need a date typed in; stays
// editable for a backdated entry.
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function StockTab() {
  const { t } = useLang();
  const [phones, setPhones] = useState<Phone[]>([]);
  const [filter, setFilter] = useState<"all" | "unsold" | "sold">("unsold");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [sellPhone, setSellPhone] = useState<Phone | null>(null);
  const [stickerPhone, setStickerPhone] = useState<Phone | null>(null);
  const [detailsPhone, setDetailsPhone] = useState<Phone | null>(null);
  const [editPhone, setEditPhone] = useState<Phone | null>(null);
  const [duePhone, setDuePhone] = useState<{ phone: Phone; sale: Sale } | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [printQueue, setPrintQueue] = useState<Phone[]>([]);
  const [queueOpen, setQueueOpen] = useState(false);
  // "Print All Labels" (toolbar) -- a separate, transient hidden
  // pre-render list from the manual print queue above, so a bulk print
  // never disturbs whatever the shop owner is manually curating in the
  // queue. See printAllLabels() below.
  const [printAllQueue, setPrintAllQueue] = useState<Phone[]>([]);

  const [sellForm, setSellForm] = useState({
    selling_price: "",
    selling_date: todayStr(),
    is_due: false,
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    customer_email: "",
    narration: "",
    paid_now: "",
    ram_rom: "",
    battery_health: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [returningId, setReturningId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [returningSupplierId, setReturningSupplierId] = useState<number | null>(null);
  const [returnHistoryOpen, setReturnHistoryOpen] = useState(false);
  const [returnHistory, setReturnHistory] = useState<PhoneReturn[]>([]);
  const [returnHistoryLoading, setReturnHistoryLoading] = useState(false);

  async function load(opts?: { silent?: boolean }) {
    if (!opts?.silent) setLoading(true);
    // Always fetch everything — status tab and search are both applied
    // client-side below, so a search matches phones regardless of which
    // tab (In Stock/Sold/All) happens to be selected.
    const res = await fetch(`/api/stock`);
    const data: any = await res.json();
    setPhones(data.phones || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Restore any labels left in the print queue from a previous visit.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PRINT_QUEUE_STORAGE_KEY);
      if (raw) setPrintQueue(JSON.parse(raw));
    } catch {
      // Corrupt/unavailable storage -- just start with an empty queue.
    }
  }, []);

  // Keep the queue in sync with localStorage on every change so it isn't
  // lost on a reload or if the tab is closed before printing.
  useEffect(() => {
    try {
      window.localStorage.setItem(PRINT_QUEUE_STORAGE_KEY, JSON.stringify(printQueue));
    } catch {
      // Storage full/unavailable -- the queue still works for this tab.
    }
  }, [printQueue]);

  // Opening the sell sheet for a phone already tells us its RAM/ROM and
  // Battery Health (entered at Buy time) — pre-fill them instead of making
  // the user type the same specs again, and reset the rest of the form so
  // nothing carries over from a previously-opened phone.
  useEffect(() => {
    if (sellPhone) {
      setSellForm({
        selling_price: "",
        selling_date: todayStr(),
        is_due: false,
        customer_name: "",
        customer_phone: "",
        customer_address: "",
        customer_email: "",
        narration: "",
        paid_now: "",
        ram_rom: sellPhone.ram_rom || "",
        battery_health: sellPhone.battery_health || "",
      });
      setError("");
    }
  }, [sellPhone]);

  // Buy/Sell/Return elsewhere in the app (bottom action bar, etc.) fire this
  // event — reload (silently, no "Loading..." flash) so newly bought/sold
  // phones show up here instantly, without a manual page refresh. The
  // interval alongside it catches the same kind of change made from a
  // different device/browser, which can't reach this tab's event listener.
  useEffect(() => {
    const handler = () => load({ silent: true });
    window.addEventListener(DASHBOARD_REFRESH_EVENT, handler);
    const interval = setInterval(() => load({ silent: true }), POLL_MS);
    return () => {
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, handler);
      clearInterval(interval);
    };
  }, []);

  const filtered = phones.filter((p) => {
    if (search.trim()) {
      const s = search.toLowerCase();
      // While actively searching, ignore the tab entirely — a search for
      // an IMEI/name should find it whether the phone is currently
      // sold or unsold.
      return (
        p.name_model.toLowerCase().includes(s) || p.imei.toLowerCase().includes(s)
      );
    }
    if (filter === "all") return true;
    return p.status === filter;
  });

  async function submitSell() {
    if (!sellPhone) return;
    setError("");
    if (!sellForm.selling_price) {
      setError(t("stock.selling_price_required"));
      return;
    }
    // Open the receipt tab now, still inside this click's user gesture —
    // browsers block window.open() once we hit the awaits below.
    const previewWin = window.open("", "_blank");
    setSaving(true);
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone_id: sellPhone.id,
        selling_price: Number(sellForm.selling_price),
        selling_date: sellForm.selling_date ? `${sellForm.selling_date} 00:00:00` : null,
        is_due: sellForm.is_due,
        customer_name: sellForm.customer_name || null,
        customer_phone: sellForm.customer_phone || null,
        customer_address: sellForm.customer_address || null,
        customer_email: sellForm.customer_email || null,
        narration: sellForm.narration || null,
        paid_now: sellForm.is_due ? Number(sellForm.paid_now || 0) : undefined,
        ram_rom: sellForm.ram_rom || null,
        battery_health: sellForm.battery_health || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      previewWin?.close();
      const d: any = await res.json();
      setError(d.error || t("stock.save_failed"));
      return;
    }
    const d: any = await res.json();
    setSellForm({
      selling_price: "",
      selling_date: todayStr(),
      is_due: false,
      customer_name: "",
      customer_phone: "",
      customer_address: "",
      customer_email: "",
      narration: "",
      paid_now: "",
      ram_rom: "",
      battery_health: "",
    });
    const soldSaleId = d.id;
    setSellPhone(null);
    emitDashboardRefresh();
    load();

    // fetch to build receipt
    const r = await fetch(`/api/sales/${soldSaleId}`);
    const sd: any = await r.json();
    await printSalesInvoice(
      {
        saleId: sd.sale.id,
        nameModel: sd.sale.name_model,
        imei: sd.sale.imei,
        sellingPrice: sd.sale.selling_price,
        sellingDate: sd.sale.selling_date,
        isDue: !!sd.sale.is_due,
        customerName: sd.sale.customer_name,
        customerPhone: sd.sale.customer_phone,
        customerAddress: sd.sale.customer_address,
        customerEmail: sd.sale.customer_email,
        narration: sd.sale.narration,
        paidAmount: sd.sale.paid_amount,
        dueAmount: sd.sale.due_amount,
        ramRom: sd.sale.ram_rom,
        batteryHealth: sd.sale.battery_health,
        variant: sd.sale.variant,
        color: sd.sale.color,
      },
      previewWin
    );
  }

  async function openDuePanel(phone: Phone) {
    const res = await fetch(`/api/stock/${phone.id}`);
    const d: any = await res.json();
    if (d.sale) {
      setDuePhone({ phone, sale: d.sale });
    }
  }

  async function printReceiptFor(phoneId: number) {
    // Open the tab first — still inside the click's user gesture — then
    // navigate it to the PDF once it's ready below.
    const previewWin = window.open("", "_blank");
    const res = await fetch(`/api/stock/${phoneId}`);
    const d: any = await res.json();
    if (!d.sale) {
      previewWin?.close();
      return;
    }
    await printSalesInvoice(
      {
        saleId: d.sale.id,
        nameModel: d.phone.name_model,
        imei: d.phone.imei,
        sellingPrice: d.sale.selling_price,
        sellingDate: d.sale.selling_date,
        isDue: !!d.sale.is_due,
        customerName: d.sale.customer_name,
        customerPhone: d.sale.customer_phone,
        customerAddress: d.sale.customer_address,
        customerEmail: d.sale.customer_email,
        narration: d.sale.narration,
        paidAmount: d.sale.paid_amount,
        dueAmount: d.sale.due_amount,
        ramRom: d.sale.ram_rom,
        batteryHealth: d.sale.battery_health,
        variant: d.phone.variant,
        color: d.phone.color,
      },
      previewWin
    );
  }

  // Return: undoes the sale (removes it, phone goes back to unsold) and
  // reprints the same memo with a RETURNED stamp at the bottom.
  async function returnPhone(phone: Phone) {
    if (
      !window.confirm(t("stock.return_confirm").replace("{model}", phone.name_model))
    ) {
      return;
    }
    // Open the tab right after confirm (still user-gesture-attached) —
    // pointed at the PDF once it's built below.
    const previewWin = window.open("", "_blank");
    const res = await fetch(`/api/stock/${phone.id}`);
    const d: any = await res.json();
    if (!d.sale) {
      previewWin?.close();
      return;
    }
    const sale = d.sale;
    setReturningId(phone.id);
    const delRes = await fetch(`/api/sales/${sale.id}`, { method: "DELETE" });
    setReturningId(null);
    const delData: any = await delRes.json().catch(() => ({}));
    if (!delRes.ok) {
      previewWin?.close();
      setError(delData.error || t("stock.return_failed"));
      return;
    }
    if (delData.pending) {
      emitApprovalsRefresh();
      previewWin?.close();
      window.alert(t("approvals.pending_submitted_message"));
      return;
    }
    emitDashboardRefresh();
    load();
    await printSalesInvoice(
      {
        saleId: sale.id,
        nameModel: phone.name_model,
        imei: phone.imei,
        sellingPrice: sale.selling_price,
        sellingDate: sale.selling_date,
        isDue: !!sale.is_due,
        customerName: sale.customer_name,
        customerPhone: sale.customer_phone,
        customerAddress: sale.customer_address,
        customerEmail: sale.customer_email,
        narration: sale.narration,
        paidAmount: sale.paid_amount,
        dueAmount: sale.due_amount,
        ramRom: sale.ram_rom,
        batteryHealth: sale.battery_health,
        variant: phone.variant,
        color: phone.color,
        isReturn: true,
      },
      previewWin
    );
  }

  // Only for phones still in stock (unsold) — deleting a phone that's
  // already sold would leave its sale/profit history pointing at nothing,
  // so that stays out of scope here. Deleting an unsold phone removes its
  // buy price from Total Buy automatically (Total Cash/Stock count/Stock
  // total-value are all computed live from the phones table on every
  // dashboard load), so the money adjusts on its own — no extra API call
  // needed beyond the delete itself.
  async function deletePhone(phone: Phone) {
    if (
      !window.confirm(
        t("stock.delete_confirm").replace("{model}", phone.name_model).replace("{imei}", phone.imei)
      )
    ) {
      return;
    }
    setDeletingId(phone.id);
    const res = await fetch(`/api/stock/${phone.id}`, { method: "DELETE" });
    setDeletingId(null);
    const d: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error || t("stock.delete_failed"));
      return;
    }
    if (d.pending) {
      emitApprovalsRefresh();
      window.alert(t("approvals.pending_submitted_message"));
      return;
    }
    emitDashboardRefresh();
    load();
  }

  // Returns an unsold phone to whoever it was bought from (Supplier or
  // "Used Phone" seller) -- unlike deletePhone above, the phone's details
  // are kept in Return History first (see migrations/0028_phone_returns.sql)
  // so this stays visible later even though the phone itself leaves Stock
  // and its buy price drops back out of Total Cash/Buy the same way a
  // delete would.
  async function returnToSupplier(phone: Phone) {
    const supplierLabel = phone.bought_from || t("stock.return_supplier_button");
    if (
      !window.confirm(
        t("stock.return_supplier_confirm")
          .replace("{model}", phone.name_model)
          .replace("{imei}", phone.imei)
          .replace("{supplier}", supplierLabel)
      )
    ) {
      return;
    }
    setReturningSupplierId(phone.id);
    const res = await fetch(`/api/stock/${phone.id}/return`, { method: "POST" });
    setReturningSupplierId(null);
    const d: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error || t("stock.return_supplier_failed"));
      return;
    }
    if (d.pending) {
      emitApprovalsRefresh();
      window.alert(t("approvals.pending_submitted_message"));
      return;
    }
    emitDashboardRefresh();
    load();
  }

  function openReturnHistory() {
    setReturnHistoryOpen(true);
    setReturnHistoryLoading(true);
    fetch("/api/phone-returns")
      .then((r) => r.json())
      .then((d: any) => setReturnHistory(Array.isArray(d.returns) ? d.returns : []))
      .catch(() => setReturnHistory([]))
      .finally(() => setReturnHistoryLoading(false));
  }

  function handleScanResult(code: string) {
    setScanOpen(false);
    setSearch(code);
    setFilter("all");
  }

  function downloadStockReport() {
    const previewWin = window.open("", "_blank");
    const filterLabel =
      filter === "unsold"
        ? "In Stock"
        : filter === "sold"
        ? "Sold"
        : "All";
    const totalBuyValue = filtered.reduce((s, p) => s + Number(p.buy_price), 0);
    generateReportPDF(
      {
        shopName: SHOP_NAME,
        title: "Stock Report",
        subtitle: search.trim() ? `${filterLabel} (filtered: "${search.trim()}")` : filterLabel,
        summary: [
          { label: "Total Phones", value: String(filtered.length) },
          { label: "Total Buy Value", value: `Tk ${totalBuyValue.toLocaleString()}` },
        ],
        table: {
          head: ["Model", "IMEI", "Status", "Buy Price (Tk)", "Buy Date"],
          rows: filtered.map((p) => [
            p.name_model,
            p.imei,
            p.status === "sold" ? "Sold" : "In Stock",
            Number(p.buy_price).toLocaleString(),
            (p.buy_date || "-").toString().slice(0, 10),
          ]),
          emptyLabel: "No phones match this view",
        },
        footerNote: "Generated from Apple Store Satkhira — Stock Tab",
      },
      previewWin
    );
  }

  function addToQueue(phone: Phone) {
    if (printQueue.some((p) => p.imei === phone.imei)) return;
    if (printQueue.length >= QUEUE_CAPACITY) {
      window.alert(t("stock.queue_full_notice"));
      return;
    }
    setPrintQueue([...printQueue, phone]);
  }

  function removeFromQueue(imei: string) {
    setPrintQueue((prev) => prev.filter((p) => p.imei !== imei));
  }

  // Prints every queued label at once, tiled into a 5x5 grid sized so each
  // cell is exactly 1.5in x 1.46in on one A4 sheet -- no scaling, since each
  // hidden PrintLabelCell below is already rendered at that exact size.
  function printQueueGrid() {
    if (printQueue.length === 0) return;
    const cellsHtml = printQueue
      .map((p) => {
        const node = document.getElementById(`queue-label-${p.imei}`);
        return node
          ? `<div style="width:1.5in;height:1.46in;overflow:hidden;display:flex;align-items:center;justify-content:center">${node.innerHTML}</div>`
          : "";
      })
      .filter(Boolean)
      .join("");
    if (!cellsHtml) return;
    const w = window.open("", "_blank", "width=800,height=1000");
    if (!w) return;
    w.document.write(
      `<html><head><title>Print Queue</title><style>@page{size:8.27in 11.69in;margin:0}html,body{margin:0;padding:0}.grid-wrap{display:flex;justify-content:center;padding-top:0.15in}.grid{display:grid;grid-template-columns:repeat(5,1.5in);grid-auto-rows:1.46in}</style></head><body><div class="grid-wrap"><div class="grid">${cellsHtml}</div></div></body></html>`
    );
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 300);
    setPrintQueue([]);
  }

  // Prints every phone in the CURRENT filtered/searched view at once --
  // respects whatever tab (In Stock/Sold/All) and search are active, same
  // as downloadStockReport() above. Unlike the manual print queue (capped
  // at QUEUE_CAPACITY so one click stays a single A4 sheet), this can span
  // several pages: labels are chunked into groups of QUEUE_CAPACITY (one
  // full 5x8 sheet each) with an explicit page break between groups, so a
  // large stock list still prints as clean, uncut label sheets.
  function printAllLabels() {
    const toPrint = filtered;
    if (toPrint.length === 0) {
      window.alert(t("stock.print_all_empty_notice"));
      return;
    }
    // Open the window synchronously, still inside this click's user
    // gesture -- browsers block window.open() once we wait (below) for
    // the hidden labels to render (same reasoning as the Sell flow's
    // receipt tab).
    const w = window.open("", "_blank", "width=800,height=1000");
    if (!w) return;
    setPrintAllQueue(toPrint);
    // Give the hidden PrintLabelCell nodes just mounted above a tick to
    // render their barcodes before reading innerHTML.
    setTimeout(() => {
      const pagesHtml: string[] = [];
      for (let i = 0; i < toPrint.length; i += QUEUE_CAPACITY) {
        const chunk = toPrint.slice(i, i + QUEUE_CAPACITY);
        const cellsHtml = chunk
          .map((p) => {
            const node = document.getElementById(`print-all-label-${p.imei}`);
            return node
              ? `<div style="width:1.5in;height:1.46in;overflow:hidden;display:flex;align-items:center;justify-content:center">${node.innerHTML}</div>`
              : "";
          })
          .filter(Boolean)
          .join("");
        if (cellsHtml) pagesHtml.push(`<div class="page"><div class="grid">${cellsHtml}</div></div>`);
      }
      if (pagesHtml.length === 0) {
        w.close();
        setPrintAllQueue([]);
        return;
      }
      w.document.write(
        `<html><head><title>All Labels</title><style>@page{size:8.27in 11.69in;margin:0}html,body{margin:0;padding:0}.page{display:flex;justify-content:center;padding-top:0.15in;page-break-after:always}.page:last-child{page-break-after:auto}.grid{display:grid;grid-template-columns:repeat(5,1.5in);grid-auto-rows:1.46in}</style></head><body>${pagesHtml.join("")}</body></html>`
      );
      w.document.close();
      w.focus();
      setTimeout(() => {
        w.print();
      }, 300);
      setPrintAllQueue([]);
    }, 250);
  }

  return (
    <div className="pb-24">
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("stock.search_placeholder")}
            className={inputClass + " pl-9"}
          />
        </div>
        <button
          onClick={() => setScanOpen(true)}
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-teal"
          aria-label={t("stock.scan_barcode_aria")}
        >
          <ScanLine size={20} />
        </button>
        <button
          onClick={() => setQueueOpen(true)}
          className="relative flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-teal"
          aria-label={t("stock.print_queue_aria")}
        >
          <LayoutGrid size={20} />
          {printQueue.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-teal px-1 text-[10px] font-bold text-white">
              {printQueue.length}
            </span>
          )}
        </button>
        <button
          onClick={openReturnHistory}
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-teal"
          aria-label={t("stock.return_history_aria")}
        >
          <History size={20} />
        </button>
        <button
          onClick={printAllLabels}
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-teal"
          aria-label={t("stock.print_all_aria")}
        >
          <Printer size={20} />
        </button>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {(["unsold", "sold", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium border ${
              filter === f
                ? "border-teal bg-teal/15 text-teal"
                : "border-border text-ink-muted"
            }`}
          >
            {f === "unsold"
              ? t("stock.filter_unsold")
              : f === "sold"
              ? t("stock.filter_sold")
              : t("stock.filter_all")}
          </button>
        ))}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs text-ink-muted">
            {t("stock.count_summary")
              .replace("{count}", String(filtered.length))
              .replace("{total}", money(filtered.reduce((s, p) => s + Number(p.buy_price), 0)))}
          </p>
          <button
            onClick={downloadStockReport}
            className="flex items-center gap-1 text-xs font-semibold text-teal"
          >
            <Download size={13} /> {t("stock.download_pdf")}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm text-ink-muted py-10">{t("stock.loading")}</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-ink-muted">
          {t("stock.no_phones")}
        </div>
      ) : (
        <ul className="space-y-2 sm:grid sm:grid-cols-2 sm:gap-2 sm:space-y-0 lg:grid-cols-3">
          {filtered.map((p) => (
            <li
              key={p.id}
              onClick={() => setDetailsPhone(p)}
              className="cursor-pointer rounded-xl border border-border bg-surface p-3 active:bg-surface-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-display text-sm font-semibold truncate">
                      {p.name_model}
                    </p>
                    <Badge tone={p.status === "unsold" ? "default" : "up"}>
                      {p.status === "unsold" ? "Unsold" : "Sold"}
                    </Badge>
                    {p.seller_type === "individual" && (
                      <Badge tone="due">{t("stock.used_phone_badge")}</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-faint tabular">
                    IMEI: {p.imei}
                    {p.ram_rom && ` · ${p.ram_rom}`}
                    {p.bought_from && t("stock.bought_from_inline").replace("{name}", p.bought_from)} · ৳{money(p.buy_price)} ·{" "}
                    {formatDate(p.buy_date)}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                {p.status === "unsold" ? (
                  <>
                    <Button
                      variant="primary"
                      className="flex-1 !py-2 !text-xs"
                      onClick={() => setSellPhone(p)}
                    >
                      {t("stock.sell_button")}
                    </Button>
                    <button
                      onClick={() => returnToSupplier(p)}
                      disabled={returningSupplierId === p.id}
                      className="flex items-center justify-center rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-ink-muted hover:text-down disabled:opacity-50"
                      aria-label={t("stock.return_supplier_aria")}
                    >
                      <Undo2 size={15} />
                    </button>
                    <button
                      onClick={() => deletePhone(p)}
                      disabled={deletingId === p.id}
                      className="flex items-center justify-center rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-ink-muted hover:text-down disabled:opacity-50"
                      aria-label={t("stock.delete_phone_aria")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => printReceiptFor(p.id)}
                      className="flex items-center justify-center rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-ink-muted hover:text-teal"
                      aria-label={t("stock.view_bill_aria")}
                    >
                      <Receipt size={15} />
                    </button>
                    <button
                      onClick={() => openDuePanel(p)}
                      className="flex items-center justify-center rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-ink-muted hover:text-teal"
                      aria-label={t("stock.view_due_aria")}
                    >
                      <Wallet size={15} />
                    </button>
                    <button
                      onClick={() => returnPhone(p)}
                      disabled={returningId === p.id}
                      className="flex items-center justify-center rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-ink-muted hover:text-down disabled:opacity-50"
                      aria-label={t("stock.return_phone_aria")}
                    >
                      <RotateCcw size={15} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setStickerPhone(p)}
                  className="flex items-center justify-center rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-ink-muted hover:text-teal"
                  aria-label={t("stock.print_sticker_aria")}
                >
                  <Printer size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Sell sheet */}
      <Sheet
        open={!!sellPhone}
        onClose={() => setSellPhone(null)}
        title={sellPhone ? `${t("stock.sell_sheet_title_prefix")}${sellPhone.name_model}` : ""}
      >
        <div className="space-y-3">
          <Field label={t("stock.selling_price_label")}>
            <input
              type="number"
              inputMode="decimal"
              value={sellForm.selling_price}
              onChange={(e) => setSellForm({ ...sellForm, selling_price: e.target.value })}
              placeholder="0"
              className={inputClass}
            />
          </Field>
          <Field label={t("stock.selling_date_label")}>
            <input
              type="date"
              value={sellForm.selling_date}
              onChange={(e) => setSellForm({ ...sellForm, selling_date: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t("stock.ram_rom_label")}>
            <input
              value={sellForm.ram_rom}
              onChange={(e) => setSellForm({ ...sellForm, ram_rom: e.target.value })}
              placeholder={t("stock.ram_rom_placeholder")}
              className={inputClass}
            />
          </Field>
          <Field label={t("stock.battery_health_label")}>
            <input
              value={sellForm.battery_health}
              onChange={(e) => setSellForm({ ...sellForm, battery_health: e.target.value })}
              placeholder={t("stock.battery_health_placeholder")}
              className={inputClass}
            />
          </Field>
          {/* Variant/Color -- Buy-time-only fields, shown read-only here
              too (the phone is already known, so no lookup is needed, but
              the seller can still see them without leaving this sheet). */}
          {sellPhone?.variant && (
            <Field label={t("buy.variant_label")}>
              <input value={sellPhone.variant} readOnly className={inputClass + " opacity-70"} />
            </Field>
          )}
          {sellPhone?.color && (
            <Field label={t("buy.color_label")}>
              <input value={sellPhone.color} readOnly className={inputClass + " opacity-70"} />
            </Field>
          )}

          {/* Same customer fields as the bottom-bar Sell sheet — always
              shown here too, not just for due sales, so both sell flows
              collect the same information. */}
          <Field label={t("stock.customer_name_label")}>
            <input
              value={sellForm.customer_name}
              onChange={(e) =>
                setSellForm({ ...sellForm, customer_name: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label={t("stock.customer_phone_label")}>
            <input
              value={sellForm.customer_phone}
              onChange={(e) =>
                setSellForm({ ...sellForm, customer_phone: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label={t("stock.customer_address_label")}>
            <input
              value={sellForm.customer_address}
              onChange={(e) =>
                setSellForm({ ...sellForm, customer_address: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label={t("stock.customer_email_label")}>
            <input
              type="email"
              value={sellForm.customer_email}
              onChange={(e) =>
                setSellForm({ ...sellForm, customer_email: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label={t("stock.narration_label")}>
            <input
              value={sellForm.narration}
              onChange={(e) => setSellForm({ ...sellForm, narration: e.target.value })}
              placeholder={t("stock.narration_placeholder")}
              className={inputClass}
            />
          </Field>

          <label className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3.5 py-3">
            <input
              type="checkbox"
              checked={sellForm.is_due}
              onChange={(e) => setSellForm({ ...sellForm, is_due: e.target.checked })}
              className="h-4 w-4 accent-[var(--gold)]"
            />
            <span className="text-sm font-medium">{t("stock.due_sale_label")}</span>
          </label>

          {sellForm.is_due && (
            <div className="space-y-3 rounded-xl border border-due/30 bg-due/5 p-3">
              <Field label={t("stock.paid_now_label")}>
                <input
                  type="number"
                  inputMode="decimal"
                  value={sellForm.paid_now}
                  onChange={(e) => setSellForm({ ...sellForm, paid_now: e.target.value })}
                  placeholder="0"
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          {error && <p className="text-sm text-down">{error}</p>}
          <Button full onClick={submitSell} disabled={saving}>
            {saving ? t("stock.saving") : t("stock.confirm_sell_and_bill")}
          </Button>
        </div>
      </Sheet>

      {/* Sticker print popup -- fixed 1.5in x 1.46in physical label.
          A real floating Modal (not the full-page Sheet used elsewhere)
          so it shows up right away no matter how far down the phone
          list the triggering card was, or how long Stock's list is. */}
      <Modal
        open={!!stickerPhone}
        onClose={() => setStickerPhone(null)}
        title={t("stock.sticker_sheet_title")}
      >
        {stickerPhone && (
          <div className="flex flex-col items-center gap-4">
            <div id="sticker-print-area">
              <PrintLabelCell
                imei={stickerPhone.imei}
                label={stickerPhone.name_model}
                ramRom={stickerPhone.ram_rom}
                batteryHealth={stickerPhone.battery_health}
                boxStatus={stickerPhone.box_status}
                variant={stickerPhone.variant}
                color={stickerPhone.color}
              />
            </div>
            <div className="flex w-full gap-2">
              <Button
                full
                onClick={() => {
                  const node = document.getElementById("sticker-print-area");
                  if (!node) return;
                  // Every label is the same fixed 1.5in x 1.46in physical size,
                  // so the print page can just be set to that size directly
                  // -- no measuring needed.
                  const w = window.open("", "_blank", "width=400,height=300");
                  if (w) {
                    w.document.write(
                      `<html><head><title>Label</title><style>@page{size:1.5in 1.46in;margin:0}html,body{margin:0;padding:0}</style></head><body style="width:1.5in;height:1.46in;display:flex;align-items:center;justify-content:center">${node.innerHTML}</body></html>`
                    );
                    w.document.close();
                    w.focus();
                    setTimeout(() => w.print(), 300);
                  }
                }}
              >
                <Printer size={16} /> {t("stock.print_sticker_button")}
              </Button>
              <Button
                full
                variant="secondary"
                disabled={
                  printQueue.length >= QUEUE_CAPACITY ||
                  printQueue.some((p) => p.imei === stickerPhone.imei)
                }
                onClick={() => addToQueue(stickerPhone)}
              >
                <ListPlus size={16} /> {t("stock.add_to_queue_button")}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Print queue popup -- same reasoning as the sticker popup above:
          a floating Modal so it's visible immediately, lets the queue
          fill up over several prints, then print every label in one
          grid-print pass on a single A4 sheet, 5 columns x 8 rows of
          1.5in x 1.46in labels. */}
      <Modal
        open={queueOpen}
        onClose={() => setQueueOpen(false)}
        title={t("stock.print_queue_title")}
      >
        <div className="space-y-3">
          <p className="text-xs text-ink-muted">
            {t("stock.print_queue_count")
              .replace("{count}", String(printQueue.length))
              .replace("{capacity}", String(QUEUE_CAPACITY))}
          </p>
          {printQueue.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-ink-muted">
              {t("stock.print_queue_empty")}
            </div>
          ) : (
            <ul className="space-y-2">
              {printQueue.map((p) => (
                <li
                  key={p.imei}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name_model}</p>
                    <p className="truncate text-xs text-ink-faint tabular">IMEI: {p.imei}</p>
                  </div>
                  <button
                    onClick={() => removeFromQueue(p.imei)}
                    className="flex items-center justify-center rounded-lg border border-border bg-surface px-2 py-1.5 text-ink-muted hover:text-down"
                    aria-label={t("stock.remove_from_queue_aria")}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button full onClick={printQueueGrid} disabled={printQueue.length === 0}>
            <Printer size={16} /> {t("stock.print_queue_button")}
          </Button>
        </div>
      </Modal>

      {/* Return History popup -- a read-only look at every phone ever
          returned to whoever it was bought from (see
          migrations/0028_phone_returns.sql + POST /api/stock/[id]/return).
          A floating Modal for the same reason as the two above: opened
          from the toolbar, so it should show up right away regardless of
          scroll position. */}
      <Modal
        open={returnHistoryOpen}
        onClose={() => setReturnHistoryOpen(false)}
        title={t("stock.return_history_title")}
      >
        {returnHistoryLoading ? (
          <p className="py-6 text-center text-sm text-ink-muted">{t("approvals.loading")}</p>
        ) : returnHistory.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-ink-muted">
            {t("stock.return_history_empty")}
          </div>
        ) : (
          <ul className="space-y-2">
            {returnHistory.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-border bg-surface-2 px-3 py-2"
              >
                <p className="truncate text-sm font-medium">{r.name_model}</p>
                <p className="truncate text-xs text-ink-faint tabular">IMEI: {r.imei}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {t("stock.return_history_returned_to_prefix")}
                  {r.bought_from || "-"} · {money(r.buy_price)}
                </p>
                <p className="text-xs text-ink-faint">
                  {t("stock.return_history_on_prefix")}
                  {formatDate(r.returned_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* Hidden, always-mounted pre-render of every queued label -- each
          PrintLabelCell's JsBarcode draw effect finishes as soon as it
          mounts, so by the time printQueueGrid() reads its innerHTML (on a
          later click) the barcode is guaranteed to already be there. */}
      <div style={{ position: "absolute", top: -99999, left: -99999, visibility: "hidden" }} aria-hidden>
        {printQueue.map((p) => (
          <div id={`queue-label-${p.imei}`} key={p.imei}>
            <PrintLabelCell
              imei={p.imei}
              label={p.name_model}
              ramRom={p.ram_rom}
              batteryHealth={p.battery_health}
              boxStatus={p.box_status}
              variant={p.variant}
              color={p.color}
            />
          </div>
        ))}
      </div>

      {/* Hidden, always-mounted pre-render for "Print All Labels" -- same
          reasoning as the print-queue block above, but for whatever
          phones are in printAllQueue (see printAllLabels()). A separate
          id prefix keeps its nodes from colliding with the manual
          queue's when the same phone happens to be in both. */}
      <div style={{ position: "absolute", top: -99999, left: -99999, visibility: "hidden" }} aria-hidden>
        {printAllQueue.map((p) => (
          <div id={`print-all-label-${p.imei}`} key={p.imei}>
            <PrintLabelCell
              imei={p.imei}
              label={p.name_model}
              ramRom={p.ram_rom}
              batteryHealth={p.battery_health}
              boxStatus={p.box_status}
              variant={p.variant}
              color={p.color}
            />
          </div>
        ))}
      </div>

      {/* Phone details — opens when tapping a card */}
      <PhoneDetailsSheet
        phone={detailsPhone}
        onClose={() => setDetailsPhone(null)}
        onSell={(p) => {
          setDetailsPhone(null);
          setSellPhone(p);
        }}
        onPrintBill={(p) => {
          setDetailsPhone(null);
          printReceiptFor(p.id);
        }}
        onViewDue={(p) => {
          setDetailsPhone(null);
          openDuePanel(p);
        }}
        onReturn={(p) => {
          setDetailsPhone(null);
          returnPhone(p);
        }}
        onEdit={(p) => {
          setDetailsPhone(null);
          setEditPhone(p);
        }}
        onDelete={(p) => {
          setDetailsPhone(null);
          deletePhone(p);
        }}
      />

      {/* Edit a stock phone's own details (model, IMEI, RAM/ROM, buy price, etc.) */}
      <EditPhoneSheet phone={editPhone} onClose={() => setEditPhone(null)} onSaved={load} />

      {/* Due panel */}
      <DuePanel duePhone={duePhone} onClose={() => setDuePhone(null)} onUpdated={load} />

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onResult={handleScanResult}
      />
    </div>
  );
}

function PhoneDetailsSheet({
  phone,
  onClose,
  onSell,
  onPrintBill,
  onViewDue,
  onReturn,
  onEdit,
  onDelete,
}: {
  phone: Phone | null;
  onClose: () => void;
  onSell: (phone: Phone) => void;
  onPrintBill: (phone: Phone) => void;
  onViewDue: (phone: Phone) => void;
  onReturn: (phone: Phone) => void;
  onEdit: (phone: Phone) => void;
  onDelete: (phone: Phone) => void;
}) {
  const { t } = useLang();
  const [sale, setSale] = useState<Sale | null>(null);

  useEffect(() => {
    setSale(null);
    if (phone && phone.status === "sold") {
      fetch(`/api/stock/${phone.id}`)
        .then((r) => r.json())
        .then((d: any) => setSale(d.sale || null))
        .catch(() => {});
    }
  }, [phone]);

  if (!phone) return null;

  const detailRows: { label: string; value: string }[] = [
    { label: "IMEI", value: phone.imei },
    ...(phone.ram_rom ? [{ label: "RAM/ROM", value: phone.ram_rom }] : []),
    ...(phone.battery_health ? [{ label: "Battery Health", value: phone.battery_health }] : []),
    ...(phone.variant ? [{ label: t("buy.variant_label"), value: phone.variant }] : []),
    ...(phone.color ? [{ label: t("buy.color_label"), value: phone.color }] : []),
    ...(phone.bought_from ? [{ label: "Buy from whom", value: phone.bought_from }] : []),
    ...(phone.phone_number ? [{ label: "Number", value: phone.phone_number }] : []),
    ...(phone.nid ? [{ label: "NID", value: phone.nid }] : []),
    { label: t("stock.buy_price_label"), value: `৳${money(phone.buy_price)}` },
    { label: t("stock.buy_date_label"), value: formatDate(phone.buy_date) },
  ];

  return (
    <Sheet open={!!phone} onClose={onClose} title={phone.name_model}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Badge tone={phone.status === "unsold" ? "default" : "up"}>
              {phone.status === "unsold" ? "Unsold" : "Sold"}
            </Badge>
            {phone.seller_type === "individual" && (
              <Badge tone="due">{t("stock.used_phone_badge")}</Badge>
            )}
          </div>
          <button
            onClick={() => onEdit(phone)}
            className="flex items-center gap-1 text-xs font-semibold text-teal"
          >
            <Pencil size={13} /> {t("stock.edit_button")}
          </button>
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3.5">
          {detailRows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink-muted">{r.label}</span>
              <span className="tabular font-medium text-right">{r.value}</span>
            </div>
          ))}
        </div>

        {phone.status === "sold" && sale && (
          <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3.5">
            <p className="text-xs font-semibold text-ink-muted">{t("stock.sale_info_heading")}</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">{t("stock.selling_price_short")}</span>
              <span className="tabular font-medium">৳{money(sale.selling_price)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">{t("stock.selling_date_short")}</span>
              <span className="tabular font-medium">{formatDate(sale.selling_date)}</span>
            </div>
            {sale.customer_name && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">{t("stock.customer_label")}</span>
                <span className="font-medium">{sale.customer_name}</span>
              </div>
            )}
            {sale.customer_phone && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">{t("stock.number_label")}</span>
                <span className="tabular font-medium">{sale.customer_phone}</span>
              </div>
            )}
            {!!sale.is_due && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-due">{t("stock.due_remaining_label")}</span>
                <span className="tabular font-medium text-due">৳{money(sale.due_amount)}</span>
              </div>
            )}
          </div>
        )}

        {phone.status === "unsold" ? (
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => onSell(phone)}>
              {t("stock.sell_button")}
            </Button>
            <Button variant="danger" onClick={() => onDelete(phone)}>
              <Trash2 size={15} />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => onPrintBill(phone)}>
              <Receipt size={15} /> {t("stock.bill_button")}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => onViewDue(phone)}>
              <Wallet size={15} /> {t("stock.due_button")}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => onReturn(phone)}>
              <RotateCcw size={15} /> {t("stock.return_button")}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function DuePanel({
  duePhone,
  onClose,
  onUpdated,
}: {
  duePhone: { phone: Phone; sale: Sale } | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { t } = useLang();
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sale, setSale] = useState<Sale | null>(null);

  useEffect(() => {
    setSale(duePhone?.sale || null);
    setAmount("");
    setError("");
  }, [duePhone]);

  if (!duePhone || !sale) return null;

  async function submitPayment() {
    setError("");
    if (!amount || Number(amount) <= 0) {
      setError(t("stock.invalid_amount"));
      return;
    }
    setSaving(true);
    const res = await fetch("/api/due-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sale_id: sale!.id, amount: Number(amount) }),
    });
    setSaving(false);
    const d: any = await res.json();
    if (!res.ok) {
      setError(d.error || t("stock.save_failed"));
      return;
    }
    setSale({ ...sale!, due_amount: d.due_amount, paid_amount: d.paid_amount });
    setAmount("");
    emitDashboardRefresh();
    onUpdated();
  }

  return (
    <Sheet
      open={!!duePhone}
      onClose={onClose}
      title={`${t("stock.due_sheet_title_prefix")}${duePhone.phone.name_model}`}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-2 p-3 text-center">
            <p className="text-xs text-ink-muted">{t("stock.total_selling_price_label")}</p>
            <p className="tabular text-lg font-semibold">৳{money(sale.selling_price)}</p>
          </div>
          <div className="rounded-xl bg-due/10 p-3 text-center">
            <p className="text-xs text-due">{t("stock.due_remaining_label")}</p>
            <p className="tabular text-lg font-semibold text-due">৳{money(sale.due_amount)}</p>
          </div>
        </div>
        {sale.customer_name && (
          <p className="text-sm text-ink-muted">
            {t("stock.customer_prefix")}
            <span className="text-ink">{sale.customer_name}</span>{" "}
            {sale.customer_phone && `· ${sale.customer_phone}`}
          </p>
        )}

        {sale.due_amount > 0 ? (
          <>
            <Field label={t("stock.how_much_paid_label")}>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </Field>
            {error && <p className="text-sm text-down">{error}</p>}
            <Button full onClick={submitPayment} disabled={saving}>
              {saving ? t("stock.saving") : t("stock.add_payment_button")}
            </Button>
          </>
        ) : (
          <p className="text-center text-sm font-medium text-up">
            {t("stock.fully_paid")}
          </p>
        )}
      </div>
    </Sheet>
  );
}

function EditPhoneSheet({
  phone,
  onClose,
  onSaved,
}: {
  phone: Phone | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLang();
  const [form, setForm] = useState({
    name_model: "",
    imei: "",
    ram_rom: "",
    battery_health: "",
    buy_price: "",
    bought_from: "",
    phone_number: "",
    nid: "",
    box_status: "with_box" as "with_box" | "without_box",
    variant: "",
    color: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (phone) {
      setForm({
        name_model: phone.name_model || "",
        imei: phone.imei || "",
        ram_rom: phone.ram_rom || "",
        battery_health: phone.battery_health || "",
        buy_price: String(phone.buy_price ?? ""),
        bought_from: phone.bought_from || "",
        phone_number: phone.phone_number || "",
        nid: phone.nid || "",
        box_status: phone.box_status === "without_box" ? "without_box" : "with_box",
        variant: phone.variant || "",
        color: phone.color || "",
      });
      setError("");
    }
  }, [phone]);

  if (!phone) return null;

  async function submit() {
    setError("");
    if (!form.name_model || !form.imei || !form.buy_price) {
      setError(t("stock.edit_required_fields"));
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/stock/${phone!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name_model: form.name_model,
        imei: form.imei,
        buy_price: Number(form.buy_price),
        ram_rom: form.ram_rom,
        battery_health: form.battery_health,
        bought_from: form.bought_from,
        phone_number: form.phone_number,
        nid: form.nid,
        box_status: form.box_status,
        variant: form.variant,
        color: form.color,
      }),
    });
    setSaving(false);
    const d: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error || t("stock.save_failed"));
      return;
    }
    if (d.pending) {
      emitApprovalsRefresh();
      window.alert(t("approvals.pending_submitted_message"));
      onClose();
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Sheet open={!!phone} onClose={onClose} title={`${t("stock.edit_sheet_title_prefix")}${phone.name_model}`}>
      <div className="space-y-3">
        <Field label="Model Number">
          <input
            value={form.name_model}
            onChange={(e) => setForm({ ...form, name_model: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="IMEI">
          <input
            value={form.imei}
            onChange={(e) => setForm({ ...form, imei: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="RAM/ROM">
          <input
            value={form.ram_rom}
            onChange={(e) => setForm({ ...form, ram_rom: e.target.value })}
            placeholder={t("stock.ram_rom_placeholder")}
            className={inputClass}
          />
        </Field>
        <Field label="Battery Health">
          <input
            value={form.battery_health}
            onChange={(e) => setForm({ ...form, battery_health: e.target.value })}
            placeholder={t("stock.battery_health_placeholder")}
            className={inputClass}
          />
        </Field>
        <Field label={t("buy.variant_label")}>
          <input
            value={form.variant}
            onChange={(e) => setForm({ ...form, variant: e.target.value })}
            placeholder={t("buy.variant_placeholder")}
            className={inputClass}
          />
        </Field>
        <Field label={t("buy.color_label")}>
          <input
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            placeholder={t("buy.color_placeholder")}
            className={inputClass}
          />
        </Field>
        <Field label={t("buy.box_status_label")}>
          <div className="flex gap-5 pt-1">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.box_status === "with_box"}
                onChange={() => setForm({ ...form, box_status: "with_box" })}
                className="h-4 w-4"
              />
              {t("buy.with_box_label")}
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.box_status === "without_box"}
                onChange={() => setForm({ ...form, box_status: "without_box" })}
                className="h-4 w-4"
              />
              {t("buy.without_box_label")}
            </label>
          </div>
        </Field>
        <Field label="Buy Price (৳)">
          <input
            type="number"
            inputMode="decimal"
            value={form.buy_price}
            onChange={(e) => setForm({ ...form, buy_price: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Buy from whom">
          <input
            value={form.bought_from}
            onChange={(e) => setForm({ ...form, bought_from: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Number">
          <input
            value={form.phone_number}
            onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="NID">
          <input
            value={form.nid}
            onChange={(e) => setForm({ ...form, nid: e.target.value })}
            className={inputClass}
          />
        </Field>
        {error && <p className="text-sm text-down">{error}</p>}
        <Button full onClick={submit} disabled={saving}>
          {saving ? t("stock.saving") : t("stock.save_changes_button")}
        </Button>
      </div>
    </Sheet>
  );
}
