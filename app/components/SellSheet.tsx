"use client";

import { useEffect, useState } from "react";
import { ScanLine } from "lucide-react";
import { Button, Field, inputClass, Sheet } from "./ui";
import BarcodeScanner from "./BarcodeScanner";
import { generateInvoicePDF } from "@/lib/invoice";
import { emitDashboardRefresh } from "@/lib/events";
import { useLang } from "@/lib/i18n";
import type { Phone } from "@/lib/types";

const SHOP_NAME = "iPhone Store";

const EMPTY_FORM = {
  customer_name: "",
  customer_phone: "",
  model: "",
  imei: "",
  selling_price: "",
  ram_rom: "",
  battery_health: "",
};

export default function SellSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [form, setForm] = useState(EMPTY_FORM);
  const [matchedPhone, setMatchedPhone] = useState<Phone | null>(null);
  const [suggestions, setSuggestions] = useState<Phone[]>([]);
  const [checkingImei, setCheckingImei] = useState(false);
  const [isDue, setIsDue] = useState(false);
  const [paidNow, setPaidNow] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    setForm(EMPTY_FORM);
    setMatchedPhone(null);
    setIsDue(false);
    setPaidNow("");
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
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
        is_due: isDue,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
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
    generateInvoicePDF(
      {
        saleId: sd.sale.id,
        shopName: SHOP_NAME,
        nameModel: sd.sale.name_model,
        imei: sd.sale.imei,
        sellingPrice: sd.sale.selling_price,
        sellingDate: sd.sale.selling_date,
        isDue: !!sd.sale.is_due,
        customerName: sd.sale.customer_name,
        customerPhone: sd.sale.customer_phone,
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
    </>
  );
}
