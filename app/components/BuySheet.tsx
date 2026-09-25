"use client";

import { useState } from "react";
import { ScanLine, Download, Camera } from "lucide-react";
import { Button, Field, inputClass, Sheet } from "./ui";
import BarcodeScanner from "./BarcodeScanner";
import { generateReportPDF } from "@/lib/report-pdf";
import { emitDashboardRefresh } from "@/lib/events";
import { compressImageFile } from "@/lib/image";
import { useLang } from "@/lib/i18n";

const SHOP_NAME = "iPhone Store";

// "YYYY-MM-DD" for today, in the browser's local time -- pre-fills the
// Buy Date field so a normal purchase doesn't need a date typed in; stays
// editable for a backdated entry.
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function makeEmptyForm() {
  return {
    buy_date: todayStr(),
    model: "",
    imei: "",
    ram_rom: "",
    battery_health: "",
    buy_price: "",
    bought_from: "",
    phone_number: "",
    nid: "",
    seller_type: "supplier" as "supplier" | "individual",
    nid_front_photo: "",
    nid_back_photo: "",
    person_photo: "",
  };
}

// A single photo capture slot: shows a "Take Photo" button, opens the
// device camera (rear camera — this is the shop owner photographing the
// card/person in front of them), then compresses the shot down before it
// ever touches state so the DB row stays small. Tap again to retake.
function PhotoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await compressImageFile(file);
      onChange(dataUrl);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label={label}>
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-2">
          <img
            src={value}
            alt={label}
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-center text-xs font-semibold text-teal">
            <Camera size={14} />
            {busy ? t("buy.photo_processing") : t("buy.photo_retake")}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFile}
              disabled={busy}
            />
          </label>
        </div>
      ) : (
        <label
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 px-3.5 py-3 text-sm font-semibold ${
            busy ? "text-ink-faint" : "text-teal"
          }`}
        >
          <Camera size={16} />
          {busy ? t("buy.photo_processing") : t("buy.photo_take")}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFile}
            disabled={busy}
          />
        </label>
      )}
    </Field>
  );
}

export default function BuySheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [form, setForm] = useState(makeEmptyForm);
  const [scanOpen, setScanOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Purchase history download — even after a phone sells and leaves stock,
  // who it was bought from is never lost (stays in the phones table); this
  // downloads that history any time, all-time or a chosen date range, as a
  // PDF.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  function reset() {
    setForm(makeEmptyForm());
    setError("");
    setDone(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function downloadBuyHistory() {
    setHistoryError("");
    // Open the tab now, inside this click's user gesture — browsers block
    // window.open() once we hit the await below.
    const previewWin = window.open("", "_blank");
    setHistoryLoading(true);
    const params = new URLSearchParams();
    if (historyFrom) params.set("from", historyFrom);
    if (historyTo) params.set("to", historyTo);
    let data: any;
    try {
      const res = await fetch(`/api/stock?${params.toString()}`);
      data = await res.json();
    } catch {
      setHistoryLoading(false);
      previewWin?.close();
      setHistoryError(t("buy.history_load_failed"));
      return;
    }
    setHistoryLoading(false);
    const phones: any[] = data?.phones || [];
    const totalBuyValue = phones.reduce((s, p) => s + Number(p.buy_price), 0);
    const subtitle =
      historyFrom || historyTo
        ? `${historyFrom || t("buy.pdf_from_start")} — ${historyTo || t("buy.pdf_until_today")}`
        : "All Time";
    generateReportPDF(
      {
        shopName: SHOP_NAME,
        title: "Buy History Report",
        subtitle,
        summary: [
          { label: "Total Purchases", value: String(phones.length) },
          { label: "Total Buy Value", value: `Tk ${totalBuyValue.toLocaleString()}` },
        ],
        table: {
          head: ["Model", "IMEI", "Buy Date", "Bought From", "Number", "NID", "Buy Price (Tk)", "Status"],
          rows: phones.map((p) => [
            p.name_model,
            p.imei,
            (p.buy_date || "-").toString().slice(0, 10),
            p.bought_from || "-",
            p.phone_number || "-",
            p.nid || "-",
            Number(p.buy_price).toLocaleString(),
            p.status === "sold" ? "Sold" : "In Stock",
          ]),
          emptyLabel: t("buy.pdf_empty"),
        },
        footerNote: "Generated from iPhone Store — Buy History",
      },
      previewWin
    );
  }

  async function submit() {
    setError("");
    if (!form.model || !form.imei || !form.buy_price || !form.bought_from) {
      setError(t("buy.validation_required"));
      return;
    }
    if (
      form.seller_type === "individual" &&
      (!form.nid_front_photo || !form.nid_back_photo || !form.person_photo)
    ) {
      setError(t("buy.validation_photos"));
      return;
    }
    setSaving(true);
    // Buy always adds the phone straight into the main stock (phones table)
    // so it shows up in the Stock tab immediately.
    const res = await fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name_model: form.model,
        imei: form.imei,
        buy_price: Number(form.buy_price),
        buy_date: form.buy_date ? `${form.buy_date} 00:00:00` : null,
        ram_rom: form.ram_rom || null,
        battery_health: form.battery_health || null,
        bought_from: form.bought_from,
        phone_number: form.phone_number || null,
        nid: form.nid || null,
        seller_type: form.seller_type,
        nid_front_photo: form.seller_type === "individual" ? form.nid_front_photo : null,
        nid_back_photo: form.seller_type === "individual" ? form.nid_back_photo : null,
        person_photo: form.seller_type === "individual" ? form.person_photo : null,
      }),
    });
    setSaving(false);
    const d: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error || t("common.save_could_not"));
      return;
    }
    if (d.pending) {
      window.alert(t("approvals.pending_submitted_message"));
      handleClose();
      return;
    }
    emitDashboardRefresh();
    setDone(true);
  }

  return (
    <>
      <Sheet open={open} onClose={handleClose} title={t("buy.title")}>
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t("buy.history_label")}</p>
            <p className="mt-0.5 text-[11px] text-ink-faint">{t("buy.history_desc")}</p>
          </div>
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-teal"
          >
            <Download size={14} /> {t("buy.download")}
          </button>
        </div>

        {done ? (
          <div className="py-6 text-center">
            <p className="mb-4 text-lg font-semibold text-up">{t("buy.saved_success")}</p>
            <Button full onClick={reset}>
              {t("buy.buy_another")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label={t("buy.date_label")}>
              <input
                type="date"
                value={form.buy_date}
                onChange={(e) => setForm({ ...form, buy_date: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label={t("buy.seller_type_label")}>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-1.5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, seller_type: "supplier" })}
                  className={`rounded-lg py-2 text-sm font-semibold transition ${
                    form.seller_type === "supplier"
                      ? "bg-gold text-white"
                      : "text-ink-muted"
                  }`}
                >
                  {t("buy.seller_supplier")}
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, seller_type: "individual" })}
                  className={`rounded-lg py-2 text-sm font-semibold transition ${
                    form.seller_type === "individual"
                      ? "bg-gold text-white"
                      : "text-ink-muted"
                  }`}
                >
                  {t("buy.seller_individual")}
                </button>
              </div>
              {form.seller_type === "individual" && (
                <p className="mt-1.5 text-[11px] text-ink-faint">
                  {t("buy.seller_individual_note")}
                </p>
              )}
            </Field>

            {form.seller_type === "individual" && (
              <>
                <PhotoField
                  label={t("buy.nid_front")}
                  value={form.nid_front_photo}
                  onChange={(v) => setForm({ ...form, nid_front_photo: v })}
                />
                <PhotoField
                  label={t("buy.nid_back")}
                  value={form.nid_back_photo}
                  onChange={(v) => setForm({ ...form, nid_back_photo: v })}
                />
                <PhotoField
                  label={t("buy.person_photo")}
                  value={form.person_photo}
                  onChange={(v) => setForm({ ...form, person_photo: v })}
                />
              </>
            )}

            <Field label={t("buy.model_label")}>
              <input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder={t("buy.model_placeholder")}
                className={inputClass}
              />
            </Field>
            <Field label={t("buy.imei_label")}>
              <div className="flex gap-2">
                <input
                  value={form.imei}
                  onChange={(e) => setForm({ ...form, imei: e.target.value })}
                  placeholder={t("buy.imei_placeholder")}
                  className={inputClass}
                />
                <button
                  onClick={() => setScanOpen(true)}
                  className="flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 px-3 text-teal"
                  aria-label={t("buy.imei_scan_aria")}
                >
                  <ScanLine size={18} />
                </button>
              </div>
            </Field>
            <Field label={t("buy.ram_rom_label")}>
              <input
                value={form.ram_rom}
                onChange={(e) => setForm({ ...form, ram_rom: e.target.value })}
                placeholder={t("buy.ram_rom_placeholder")}
                className={inputClass}
              />
            </Field>
            <Field label={t("buy.battery_label")}>
              <input
                value={form.battery_health}
                onChange={(e) => setForm({ ...form, battery_health: e.target.value })}
                placeholder={t("buy.battery_placeholder")}
                className={inputClass}
              />
            </Field>
            <Field label={t("buy.price_label")}>
              <input
                type="number"
                inputMode="decimal"
                value={form.buy_price}
                onChange={(e) => setForm({ ...form, buy_price: e.target.value })}
                placeholder="0"
                className={inputClass}
              />
            </Field>
            <Field label={t("buy.bought_from_label")}>
              <input
                value={form.bought_from}
                onChange={(e) => setForm({ ...form, bought_from: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label={t("buy.number_label")}>
              <input
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label={t("buy.nid_label")}>
              <input
                value={form.nid}
                onChange={(e) => setForm({ ...form, nid: e.target.value })}
                className={inputClass}
              />
            </Field>
            {error && <p className="text-sm text-down">{error}</p>}
            <Button full onClick={submit} disabled={saving}>
              {saving ? t("buy.saving") : t("buy.save_button")}
            </Button>
          </div>
        )}
      </Sheet>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onResult={(code) => {
          setScanOpen(false);
          setForm((f) => ({ ...f, imei: code }));
        }}
      />

      <Sheet
        open={historyOpen}
        onClose={() => {
          setHistoryOpen(false);
          setHistoryFrom("");
          setHistoryTo("");
          setHistoryError("");
        }}
        title={t("buy.history_title")}
      >
        <div className="space-y-3">
          <Field label={t("buy.history_from")}>
            <input
              type="date"
              value={historyFrom}
              onChange={(e) => setHistoryFrom(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={t("buy.history_to")}>
            <input
              type="date"
              value={historyTo}
              onChange={(e) => setHistoryTo(e.target.value)}
              className={inputClass}
            />
          </Field>
          <p className="text-[11px] text-ink-faint">{t("buy.history_note")}</p>
          {historyError && <p className="text-sm text-down">{historyError}</p>}
          <Button full onClick={downloadBuyHistory} disabled={historyLoading}>
            {historyLoading ? t("buy.history_generating") : t("buy.history_download_pdf")}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
