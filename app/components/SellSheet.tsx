"use client";

import { useEffect, useState } from "react";
import { ScanLine, History, X, Search, Download } from "lucide-react";
import { Button, Field, inputClass, Sheet, Badge, money, formatDate } from "./ui";
import BarcodeScanner from "./BarcodeScanner";
import { printSalesInvoice } from "@/lib/sales-invoice";
import { generateReportPDF } from "@/lib/report-pdf";
import { emitDashboardRefresh } from "@/lib/events";
import { useLang } from "@/lib/i18n";
import type { Phone } from "@/lib/types";

const SHOP_NAME = "Apple Store Satkhira";

// "YYYY-MM-DD" for today, in the browser's local time -- used to
// pre-fill the Sale Date field so a normal sale doesn't require typing a
// date at all; the field stays editable for the rare case of a backdated
// entry.
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function makeEmptyForm() {
  return {
    selling_date: todayStr(),
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    customer_email: "",
    narration: "",
    model: "",
    imei: "",
    selling_price: "",
    ram_rom: "",
    battery_health: "",
  };
}

export default function SellSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [form, setForm] = useState(makeEmptyForm);
  const [matchedPhone, setMatchedPhone] = useState<Phone | null>(null);
  const [suggestions, setSuggestions] = useState<Phone[]>([]);
  const [checkingImei, setCheckingImei] = useState(false);
  const [isDue, setIsDue] = useState(false);
  const [paidNow, setPaidNow] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Sale History panel -- lets the shop owner browse past sales by date,
  // or find one specific sale by customer name/phone/invoice number and
  // reprint its memo (see loadHistory/viewHistoryMemo below).
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyResults, setHistoryResults] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyReportLoading, setHistoryReportLoading] = useState(false);

  // As soon as an IMEI is typed/scanned, look it up in stock. A full exact
  // match auto-fills Model/RAM-ROM/Battery Health straight away; a partial
  // IMEI (just a few digits) instead shows a pick-list of matching unsold
  // phones below the field, so the user doesn't have to type the whole
  // number to find the right one.
  useEffect(() => {
    const imei = form.imei.trim();
    if (!imei) {
      setMatchedPhone(null);
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingImei(true);
      try {
        const res = await fetch(`/api/stock?imei=${encodeURIComponent(imei)}`);
        const d: any = await res.json();
        const found: Phone | undefined = (d.phones || [])[0];
        if (found) {
          setMatchedPhone(found);
          setSuggestions([]);
          // Bring over what we already know about this phone from Buy
          // time, so the user doesn't have to retype RAM/ROM or Battery
          // Health for a phone that's already in stock.
          setForm((f) => ({
            ...f,
            model: found.name_model,
            ram_rom: found.ram_rom || f.ram_rom,
            battery_health: found.battery_health || f.battery_health,
          }));
        } else {
          setMatchedPhone(null);
          if (imei.length >= 2) {
            const sres = await fetch(
              `/api/stock?imei_like=${encodeURIComponent(imei)}&status=unsold&limit=8`
            );
            const sd: any = await sres.json();
            setSuggestions(sd.phones || []);
          } else {
            setSuggestions([]);
          }
        }
      } catch {
        // ignore — manual entry still works if the lookup fails
      }
      setCheckingImei(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [form.imei]);

  function selectSuggestion(p: Phone) {
    setMatchedPhone(p);
    setSuggestions([]);
    setForm((f) => ({
      ...f,
      imei: p.imei,
      model: p.name_model,
      ram_rom: p.ram_rom || f.ram_rom,
      battery_health: p.battery_health || f.battery_health,
    }));
  }

  function reset() {
    setForm(makeEmptyForm());
    setMatchedPhone(null);
    setIsDue(false);
    setPaidNow("");
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function closeHistory() {
    setHistoryOpen(false);
    setHistoryFrom("");
    setHistoryTo("");
    setHistoryQuery("");
    setHistoryResults([]);
    setHistoryError("");
  }

  // Fetches /api/sales with whatever filters are currently set (date
  // range and/or the free-text search box, which the API matches against
  // customer name, customer phone, and invoice number -- see
  // app/api/sales/route.ts). Called on open (unfiltered — most recent
  // sales first) and again whenever the user presses Search.
  async function loadHistory() {
    setHistoryError("");
    setHistoryLoading(true);
    const params = new URLSearchParams();
    if (historyFrom) params.set("from", historyFrom);
    if (historyTo) params.set("to", historyTo);
    if (historyQuery.trim()) params.set("q", historyQuery.trim());
    try {
      const res = await fetch(`/api/sales?${params.toString()}`);
      const d: any = await res.json();
      setHistoryResults(Array.isArray(d.sales) ? d.sales : []);
    } catch {
      setHistoryError(t("sell.history_load_failed"));
    }
    setHistoryLoading(false);
  }

  function openHistory() {
    setHistoryOpen(true);
    loadHistory();
  }

  // Reprints the exact same memo for a past sale -- every field it needs
  // (model, IMEI, customer contact info, price/due split, RAM-ROM/battery)
  // already came back in the /api/sales list itself (s.* plus the phones
  // join), so this needs no extra per-sale fetch.
  async function viewHistoryMemo(row: any) {
    const previewWin = window.open("", "_blank");
    await printSalesInvoice(
      {
        saleId: row.id,
        nameModel: row.name_model,
        imei: row.imei,
        sellingPrice: row.selling_price,
        sellingDate: row.selling_date,
        isDue: !!row.is_due,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        customerAddress: row.customer_address,
        customerEmail: row.customer_email,
        narration: row.narration,
        paidAmount: row.paid_amount,
        dueAmount: row.due_amount,
        ramRom: row.ram_rom,
        batteryHealth: row.battery_health,
      },
      previewWin
    );
  }

  // A plain summary-table PDF of whatever's currently listed (same
  // date-range/search filters as the on-screen list) -- separate from
  // viewHistoryMemo above, which reprints one specific sale's actual memo.
  function downloadHistoryReport() {
    const previewWin = window.open("", "_blank");
    setHistoryReportLoading(true);
    const totalValue = historyResults.reduce((s, r) => s + Number(r.selling_price || 0), 0);
    generateReportPDF(
      {
        shopName: SHOP_NAME,
        title: "Sale History Report",
        subtitle:
          historyFrom || historyTo
            ? `${historyFrom || "..."} to ${historyTo || "..."}`
            : historyQuery.trim()
              ? `Search: "${historyQuery.trim()}"`
              : "All time",
        summary: [
          { label: "Total Sales", value: String(historyResults.length) },
          { label: "Total Value", value: `Tk ${totalValue.toLocaleString()}` },
        ],
        table: {
          head: ["Date", "Model", "IMEI", "Customer", "Phone", "Price (Tk)", "Status"],
          rows: historyResults.map((r) => [
            (r.selling_date || "-").toString().slice(0, 10),
            r.name_model || "-",
            r.imei || "-",
            r.customer_name || "-",
            r.customer_phone || "-",
            Number(r.selling_price || 0).toLocaleString(),
            r.is_due ? "Due" : "Paid",
          ]),
          emptyLabel: "No sales match this search",
        },
        footerNote: "Generated from Apple Store Satkhira — Sale History",
      },
      previewWin
    );
    setHistoryReportLoading(false);
  }

  async function submit() {
    setError("");
    if (
      !form.customer_name ||
      !form.customer_phone ||
      !form.model ||
      !form.imei ||
      !form.selling_price
    ) {
      setError(t("sell.validation_all_fields"));
      return;
    }
    // Address/Email/Narration are optional -- if the shop owner doesn't
    // type them, they simply print as "-" on the memo, same as before.
    // Date defaults to today (pre-filled) but can be changed for a
    // backdated entry.
    if (matchedPhone && matchedPhone.status === "sold") {
      setError(t("sell.already_sold"));
      return;
    }
    // Open the receipt tab synchronously, still inside this click's user
    // gesture — otherwise the browser blocks window.open() once we hit the
    // awaits below. We navigate this tab to the finished PDF later.
    const previewWin = window.open("", "_blank");
    setSaving(true);

    let phoneId = matchedPhone?.id;
    if (!phoneId) {
      // IMEI not found in stock — auto-create the stock entry (buy price
      // unknown, so profit will read as the full selling price for it).
      const addRes = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name_model: form.model, imei: form.imei, buy_price: 0, auto_create: true }),
      });
      const addData: any = await addRes.json().catch(() => ({}));
      if (!addRes.ok) {
        setSaving(false);
        setError(addData.error || t("common.save_could_not"));
        return;
      }
      phoneId = addData.id;
    }

    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone_id: phoneId,
        selling_price: Number(form.selling_price),
        selling_date: form.selling_date ? `${form.selling_date} 00:00:00` : null,
        is_due: isDue,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_address: form.customer_address || null,
        customer_email: form.customer_email || null,
        narration: form.narration || null,
        paid_now: isDue ? Number(paidNow || 0) : undefined,
        ram_rom: form.ram_rom || null,
        battery_health: form.battery_health || null,
      }),
    });
    if (!res.ok) {
      setSaving(false);
      previewWin?.close();
      const d: any = await res.json().catch(() => ({}));
      setError(d.error || t("common.save_could_not"));
      return;
    }
    const d: any = await res.json();
    emitDashboardRefresh();

    const r = await fetch(`/api/sales/${d.id}`);
    const sd: any = await r.json();
    setSaving(false);
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
      },
      previewWin
    );

    handleClose();
  }

  return (
    <>
      <Sheet open={open} onClose={handleClose} title={t("sell.title")}>
        <div className="space-y-3">
          <div className="mb-1 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t("sell.history_label")}</p>
              <p className="mt-0.5 text-[11px] text-ink-faint">{t("sell.history_desc")}</p>
            </div>
            <button
              onClick={openHistory}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-teal"
            >
              <History size={14} /> {t("sell.history_button")}
            </button>
          </div>
          <Field label={t("sell.date_label")}>
            <input
              type="date"
              value={form.selling_date}
              onChange={(e) => setForm({ ...form, selling_date: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t("sell.name_label")}>
            <input
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t("sell.number_label")}>
            <input
              value={form.customer_phone}
              onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t("sell.address_label")}>
            <input
              value={form.customer_address}
              onChange={(e) => setForm({ ...form, customer_address: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t("sell.email_label")}>
            <input
              type="email"
              value={form.customer_email}
              onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t("sell.narration_label")}>
            <input
              value={form.narration}
              onChange={(e) => setForm({ ...form, narration: e.target.value })}
              placeholder={t("sell.narration_placeholder")}
              className={inputClass}
            />
          </Field>
          <Field label={t("sell.imei_label")}>
            <div className="relative">
              <div className="flex gap-2">
                <input
                  value={form.imei}
                  onChange={(e) => setForm({ ...form, imei: e.target.value })}
                  onBlur={() => setTimeout(() => setSuggestions([]), 150)}
                  placeholder={t("sell.imei_placeholder")}
                  className={inputClass}
                />
                <button
                  onClick={() => setScanOpen(true)}
                  className="flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 px-3 text-teal"
                  aria-label={t("sell.imei_scan_aria")}
                >
                  <ScanLine size={18} />
                </button>
              </div>
              {checkingImei && <p className="mt-1 text-xs text-ink-faint">{t("sell.searching")}</p>}
              {matchedPhone && (
                <p className="mt-1 text-xs text-up">
                  {t("sell.found_in_stock")} {matchedPhone.name_model}
                </p>
              )}
              {!matchedPhone && suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-border bg-bg-elevated shadow-lg">
                  {suggestions.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => selectSuggestion(p)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-surface-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.name_model}</p>
                          <p className="truncate text-xs text-ink-faint tabular">
                            IMEI: {p.imei}
                            {p.ram_rom ? ` · ${p.ram_rom}` : ""}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Field>
          <Field label={t("sell.model_label")}>
            <input
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              readOnly={!!matchedPhone}
              placeholder={t("sell.model_placeholder")}
              className={inputClass + (matchedPhone ? " opacity-70" : "")}
            />
          </Field>
          <Field label={t("sell.ram_rom_label")}>
            <input
              value={form.ram_rom}
              onChange={(e) => setForm({ ...form, ram_rom: e.target.value })}
              placeholder={t("sell.ram_rom_placeholder")}
              className={inputClass}
            />
          </Field>
          <Field label={t("sell.battery_label")}>
            <input
              value={form.battery_health}
              onChange={(e) => setForm({ ...form, battery_health: e.target.value })}
              placeholder={t("sell.battery_placeholder")}
              className={inputClass}
            />
          </Field>
          <Field label={t("sell.price_label")}>
            <input
              type="number"
              inputMode="decimal"
              value={form.selling_price}
              onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
              placeholder="0"
              className={inputClass}
            />
          </Field>

          <label className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3.5 py-3">
            <input
              type="checkbox"
              checked={isDue}
              onChange={(e) => setIsDue(e.target.checked)}
              className="h-4 w-4 accent-[var(--gold)]"
            />
            <span className="text-sm font-medium">{t("sell.due_checkbox")}</span>
          </label>

          {isDue && (
            <Field label={t("sell.paid_now_label")}>
              <input
                type="number"
                inputMode="decimal"
                value={paidNow}
                onChange={(e) => setPaidNow(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </Field>
          )}

          {error && <p className="text-sm text-down">{error}</p>}
          <Button full onClick={submit} disabled={saving}>
            {saving ? t("sell.saving") : t("sell.confirm_button")}
          </Button>
        </div>
      </Sheet>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onResult={(code) => {
          setScanOpen(false);
          setForm((f) => ({ ...f, imei: code }));
        }}
      />

      {/* Sale History -- a real full-screen overlay (matches
          BuySheet.tsx's Purchase History panel / BarcodeScanner /
          CameraCapture), not a second inline <Sheet>. Unlike Buy History
          (which is filter-then-download-a-PDF only), this one shows the
          matching sales right on screen too, so a specific customer's old
          memo can be found and reprinted without generating a report
          first. */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h3 className="font-display text-lg font-semibold">{t("sell.history_title")}</h3>
            <button
              onClick={closeHistory}
              className="rounded-full p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink transition"
              aria-label={t("common.reset_form")}
            >
              <X size={22} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-3">
              <Field label={t("sell.history_search_label")}>
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                  />
                  <input
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") loadHistory();
                    }}
                    placeholder={t("sell.history_search_placeholder")}
                    className={inputClass + " pl-9"}
                  />
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label={t("sell.history_from")}>
                  <input
                    type="date"
                    value={historyFrom}
                    onChange={(e) => setHistoryFrom(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("sell.history_to")}>
                  <input
                    type="date"
                    value={historyTo}
                    onChange={(e) => setHistoryTo(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Button full variant="secondary" onClick={loadHistory} disabled={historyLoading}>
                {historyLoading ? t("sell.history_loading") : t("sell.history_search_button")}
              </Button>
              {historyError && <p className="text-sm text-down">{historyError}</p>}

              <div className="pt-1">
                {historyLoading ? (
                  <p className="text-sm text-ink-muted">{t("sell.history_loading")}</p>
                ) : historyResults.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-ink-muted">
                    {t("sell.history_empty")}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {historyResults.map((row) => (
                      <div key={row.id} className="rounded-2xl border border-border bg-surface p-4">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-ink-faint tabular">
                            {t("sell.history_invoice_prefix")}
                            {row.id}
                          </span>
                          <Badge tone={row.is_due ? "due" : "up"}>
                            {row.is_due ? t("sell.history_due_badge") : t("sell.history_paid_badge")}
                          </Badge>
                        </div>
                        <p className="mb-0.5 font-semibold text-ink">{row.name_model}</p>
                        <p className="text-xs text-ink-faint tabular">IMEI: {row.imei}</p>
                        <p className="mt-1 text-xs text-ink-muted">
                          {row.customer_name || "-"}
                          {row.customer_phone ? ` — ${row.customer_phone}` : ""}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold tabular">{money(row.selling_price)}</p>
                            <p className="text-[11px] text-ink-faint">{formatDate(row.selling_date)}</p>
                          </div>
                          <button
                            onClick={() => viewHistoryMemo(row)}
                            className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-teal"
                          >
                            <Download size={13} /> {t("sell.history_view_memo")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-border p-4">
            <Button
              full
              onClick={downloadHistoryReport}
              disabled={historyReportLoading || historyResults.length === 0}
            >
              {historyReportLoading ? t("sell.history_generating") : t("sell.history_download_pdf")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
