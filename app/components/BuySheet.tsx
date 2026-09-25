"use client";

import { useEffect, useState } from "react";
import { ScanLine, Download, Camera, X } from "lucide-react";
import { Button, Field, inputClass, Sheet } from "./ui";
import BarcodeScanner from "./BarcodeScanner";
import CameraCapture from "./CameraCapture";
import { generateReportPDF, type ReportPhotoEntry } from "@/lib/report-pdf";
import { emitDashboardRefresh } from "@/lib/events";
import { useLang } from "@/lib/i18n";
import type { Supplier } from "@/lib/types";

const SHOP_NAME = "Apple Store Satkhira";

// "YYYY-MM-DD" for today, in the browser's local time -- pre-fills the
// Buy Date field so a normal purchase doesn't need a date typed in; stays
// editable for a backdated entry.
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Loads a "data:image/..." URL's natural pixel size -- used so the Purchase
// History PDF's photo appendix (see downloadBuyHistory) can fit each NID/
// portrait photo into its box without stretching it out of shape.
function loadImageDims(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = dataUrl;
  });
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

// A single photo capture slot: shows a "Take Photo" button that opens the
// CameraCapture modal (a real live-camera flow, not a file picker) -- see
// CameraCapture.tsx for why: a plain `<input capture="environment">` only
// forces the camera on some mobile browsers and just opens the
// gallery/file picker everywhere else, desktop Chrome included.
function PhotoField({
  label,
  value,
  onTakePhoto,
}: {
  label: string;
  value: string;
  onTakePhoto: () => void;
}) {
  const { t } = useLang();

  return (
    <Field label={label}>
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-2">
          <img
            src={value}
            alt={label}
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
          <button
            type="button"
            onClick={onTakePhoto}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-center text-xs font-semibold text-teal"
          >
            <Camera size={14} />
            {t("buy.photo_retake")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onTakePhoto}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 px-3.5 py-3 text-sm font-semibold text-teal"
        >
          <Camera size={16} />
          {t("buy.photo_take")}
        </button>
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
  // Which of the 3 individual-seller photo fields the camera modal is
  // currently capturing for -- null means the modal is closed.
  const [cameraTarget, setCameraTarget] = useState<
    "nid_front_photo" | "nid_back_photo" | "person_photo" | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Supplier autocomplete -- only relevant for the "supplier" seller type.
  // The full list is fetched once per sheet-open (suppliers are few enough
  // that client-side filtering is simpler than a search-as-you-type API,
  // matching how small this shop's supplier list realistically stays).
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSuggestions, setSupplierSuggestions] = useState<Supplier[]>([]);
  const [matchedSupplier, setMatchedSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then((d: any) => setSuppliers(d.suppliers || []))
      .catch(() => {});
  }, [open]);

  // Same exact-match-vs-suggestions pattern as the Sell sheet's IMEI
  // lookup: typing a name that exactly matches a saved supplier (case
  // insensitive) auto-fills their known Number/NID and hides those fields;
  // otherwise a partial match shows a pick-list below the field.
  useEffect(() => {
    if (form.seller_type !== "supplier") {
      setMatchedSupplier(null);
      setSupplierSuggestions([]);
      return;
    }
    const typed = form.bought_from.trim();
    if (!typed) {
      setMatchedSupplier(null);
      setSupplierSuggestions([]);
      return;
    }
    const exact = suppliers.find((s) => s.name.toLowerCase() === typed.toLowerCase());
    if (exact) {
      setMatchedSupplier(exact);
      setSupplierSuggestions([]);
      setForm((f) => ({
        ...f,
        phone_number: exact.phone_number || f.phone_number,
        nid: exact.nid || f.nid,
      }));
    } else {
      setMatchedSupplier(null);
      if (typed.length >= 2) {
        setSupplierSuggestions(
          suppliers.filter((s) => s.name.toLowerCase().includes(typed.toLowerCase())).slice(0, 8)
        );
      } else {
        setSupplierSuggestions([]);
      }
    }
  }, [form.bought_from, form.seller_type, suppliers]);

  function selectSupplier(s: Supplier) {
    setMatchedSupplier(s);
    setSupplierSuggestions([]);
    setForm((f) => ({
      ...f,
      bought_from: s.name,
      phone_number: s.phone_number || "",
      nid: s.nid || "",
    }));
  }

  // Purchase history download — even after a phone sells and leaves stock,
  // who it was bought from is never lost (stays in the phones table); this
  // downloads that history any time, all-time or a chosen date range, as a
  // PDF. Renders as a real full-screen overlay (see the JSX below) rather
  // than a second inline <Sheet> -- it used to just get appended below the
  // whole Buy form, which made the Download button look broken since nothing
  // visible happened until you scrolled all the way past Save Purchase.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  // all -> every purchase; supplier -> Buy sheet's "Supplier" seller type,
  // optionally narrowed to one saved supplier; individual -> "Used Phone"
  // purchases, whose PDF also gets each seller's NID + portrait photos.
  const [historyFilterType, setHistoryFilterType] = useState<"all" | "supplier" | "individual">("all");
  const [historySupplier, setHistorySupplier] = useState(""); // "" = all suppliers
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

  function closeHistory() {
    setHistoryOpen(false);
    setHistoryFrom("");
    setHistoryTo("");
    setHistoryFilterType("all");
    setHistorySupplier("");
    setHistoryError("");
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
    if (historyFilterType === "supplier" || historyFilterType === "individual") {
      params.set("seller_type", historyFilterType);
    }
    if (historyFilterType === "supplier" && historySupplier) {
      params.set("bought_from", historySupplier);
    }
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
    const phones: any[] = data?.phones || [];

    // Any "Used Phone" purchases in the downloaded set also carry each
    // seller's NID (both sides) and portrait photo in the PDF, so the
    // printed record can prove who it was actually bought from -- this
    // applies whether the download is filtered to "Used Phone" specifically
    // or is an "All" / date-range / mixed download that happens to include
    // some Used Phone entries. Image natural dimensions are loaded up front
    // so report-pdf.ts can fit each one into its box without stretching it.
    let photoSections: ReportPhotoEntry[] | undefined;
    {
      const withPhotos = phones.filter(
        (p) =>
          p.seller_type === "individual" &&
          (p.nid_front_photo || p.nid_back_photo || p.person_photo)
      );
      photoSections = await Promise.all(
        withPhotos.map(async (p) => {
          const slots: [string, string, string][] = [
            ["nid_front_photo", t("buy.nid_front"), p.nid_front_photo],
            ["nid_back_photo", t("buy.nid_back"), p.nid_back_photo],
            ["person_photo", t("buy.person_photo"), p.person_photo],
          ];
          const photos = (
            await Promise.all(
              slots.map(async ([, label, dataUrl]) => {
                if (!dataUrl) return null;
                const dims = await loadImageDims(dataUrl);
                return { label, dataUrl, ...dims };
              })
            )
          ).filter((x): x is NonNullable<typeof x> => x !== null);
          return {
            heading: `${p.name_model} — ${p.bought_from || "-"} — ${(p.buy_date || "-")
              .toString()
              .slice(0, 10)} — IMEI ${p.imei}`,
            photos,
          };
        })
      );
    }

    setHistoryLoading(false);
    const totalBuyValue = phones.reduce((s, p) => s + Number(p.buy_price), 0);
    const rangeLabel =
      historyFrom || historyTo
        ? `${historyFrom || t("buy.pdf_from_start")} — ${historyTo || t("buy.pdf_until_today")}`
        : "All Time";
    const filterLabel =
      historyFilterType === "individual"
        ? "Used Phone"
        : historyFilterType === "supplier"
          ? historySupplier || "Supplier"
          : "";
    const subtitle = filterLabel ? `${filterLabel} — ${rangeLabel}` : rangeLabel;
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
          head: ["Model", "IMEI", "Buy Date", "Type", "Bought From", "Number", "NID", "Buy Price (Tk)", "Status"],
          rows: phones.map((p) => [
            p.name_model,
            p.imei,
            (p.buy_date || "-").toString().slice(0, 10),
            p.seller_type === "individual" ? "Used Phone" : "Supplier",
            p.bought_from || "-",
            p.phone_number || "-",
            p.nid || "-",
            Number(p.buy_price).toLocaleString(),
            p.status === "sold" ? "Sold" : "In Stock",
          ]),
          emptyLabel: t("buy.pdf_empty"),
        },
        footerNote: "Generated from Apple Store Satkhira — Buy History",
        photoSections,
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
                  onTakePhoto={() => setCameraTarget("nid_front_photo")}
                />
                <PhotoField
                  label={t("buy.nid_back")}
                  value={form.nid_back_photo}
                  onTakePhoto={() => setCameraTarget("nid_back_photo")}
                />
                <PhotoField
                  label={t("buy.person_photo")}
                  value={form.person_photo}
                  onTakePhoto={() => setCameraTarget("person_photo")}
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
              {form.seller_type === "supplier" ? (
                <div className="relative">
                  <input
                    value={form.bought_from}
                    onChange={(e) => {
                      setMatchedSupplier(null);
                      setForm({ ...form, bought_from: e.target.value });
                    }}
                    onBlur={() => setTimeout(() => setSupplierSuggestions([]), 150)}
                    placeholder={t("buy.bought_from_placeholder")}
                    className={inputClass}
                  />
                  {matchedSupplier && (
                    <p className="mt-1 text-xs text-up">{t("buy.supplier_matched_note")}</p>
                  )}
                  {!matchedSupplier && supplierSuggestions.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-border bg-bg-elevated shadow-lg">
                      {supplierSuggestions.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => selectSupplier(s)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-surface-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{s.name}</p>
                              {(s.phone_number || s.nid) && (
                                <p className="truncate text-xs text-ink-faint tabular">
                                  {[s.phone_number, s.nid].filter(Boolean).join(" · ")}
                                </p>
                              )}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <input
                  value={form.bought_from}
                  onChange={(e) => setForm({ ...form, bought_from: e.target.value })}
                  className={inputClass}
                />
              )}
            </Field>
            {!(form.seller_type === "supplier" && matchedSupplier) && (
              <>
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
              </>
            )}
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

      <CameraCapture
        open={!!cameraTarget}
        onClose={() => setCameraTarget(null)}
        onCapture={(dataUrl) => {
          if (cameraTarget) {
            setForm((f) => ({ ...f, [cameraTarget]: dataUrl }));
          }
          setCameraTarget(null);
        }}
      />

      {/* Purchase History download -- a real full-screen overlay (matches
          BarcodeScanner/CameraCapture), not a second inline <Sheet>; see
          the comment on historyOpen above for why. */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h3 className="font-display text-lg font-semibold">{t("buy.history_title")}</h3>
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
              <Field label={t("buy.history_filter_label")}>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-surface-2 p-1">
                  {(["all", "supplier", "individual"] as const).map((ft) => (
                    <button
                      key={ft}
                      type="button"
                      onClick={() => {
                        setHistoryFilterType(ft);
                        if (ft !== "supplier") setHistorySupplier("");
                      }}
                      className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                        historyFilterType === ft ? "bg-teal text-white" : "text-ink-muted"
                      }`}
                    >
                      {ft === "all"
                        ? t("buy.history_filter_all")
                        : ft === "supplier"
                          ? t("buy.seller_supplier")
                          : t("buy.seller_individual")}
                    </button>
                  ))}
                </div>
              </Field>

              {historyFilterType === "supplier" && (
                <Field label={t("buy.history_supplier_select_label")}>
                  <select
                    value={historySupplier}
                    onChange={(e) => setHistorySupplier(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">{t("buy.history_supplier_all_option")}</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

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
              {historyFilterType === "individual" && (
                <p className="text-[11px] text-ink-faint">{t("buy.history_photos_note")}</p>
              )}
              {historyError && <p className="text-sm text-down">{historyError}</p>}
            </div>
          </div>
          <div className="border-t border-border p-4">
            <Button full onClick={downloadBuyHistory} disabled={historyLoading}>
              {historyLoading ? t("buy.history_generating") : t("buy.history_download_pdf")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
