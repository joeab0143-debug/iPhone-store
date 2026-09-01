"use client";

import { useEffect, useState } from "react";
import { ScanLine } from "lucide-react";
import { Button, Field, inputClass, Sheet } from "./ui";
import BarcodeScanner from "./BarcodeScanner";
import { generateInvoicePDF } from "@/lib/invoice";
import { emitDashboardRefresh } from "@/lib/events";
import type { Phone } from "@/lib/types";

const SHOP_NAME = "Phone Fantasy";

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
  const [form, setForm] = useState(EMPTY_FORM);
  const [matchedPhone, setMatchedPhone] = useState<Phone | null>(null);
  const [checkingImei, setCheckingImei] = useState(false);
  const [isDue, setIsDue] = useState(false);
  const [paidNow, setPaidNow] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // As soon as an IMEI is typed/scanned, look it up in stock so Model
  // auto-fills and the sale can be linked to the right phone + buy price.
  useEffect(() => {
    const imei = form.imei.trim();
    if (!imei) {
      setMatchedPhone(null);
      return;
    }
    const t = setTimeout(async () => {
      setCheckingImei(true);
      try {
        const res = await fetch(`/api/stock?imei=${encodeURIComponent(imei)}`);
        const d: any = await res.json();
        const found: Phone | undefined = (d.phones || [])[0];
        if (found) {
          setMatchedPhone(found);
          setForm((f) => ({ ...f, model: found.name_model }));
        } else {
          setMatchedPhone(null);
        }
      } catch {
        // ignore — manual entry still works if the lookup fails
      }
      setCheckingImei(false);
    }, 400);
    return () => clearTimeout(t);
  }, [form.imei]);

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
      setError("সব ঘর পূরণ করুন");
      return;
    }
    if (matchedPhone && matchedPhone.status === "sold") {
      setError("এই ফোনটি ইতিমধ্যে বিক্রি হয়ে গেছে");
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
        body: JSON.stringify({ name_model: form.model, imei: form.imei, buy_price: 0 }),
      });
      const addData: any = await addRes.json().catch(() => ({}));
      if (!addRes.ok) {
        setSaving(false);
        setError(addData.error || "সেভ করা যায়নি");
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
      setError(d.error || "সেভ করা যায়নি");
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
      <Sheet open={open} onClose={handleClose} title="ফোন বিক্রি (Sell)">
        <div className="space-y-3">
          <Field label="Name">
            <input
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Number">
            <input
              value={form.customer_phone}
              onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="IMEI">
            <div className="flex gap-2">
              <input
                value={form.imei}
                onChange={(e) => setForm({ ...form, imei: e.target.value })}
                placeholder="IMEI নম্বর"
                className={inputClass}
              />
              <button
                onClick={() => setScanOpen(true)}
                className="flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 px-3 text-teal"
                aria-label="IMEI স্ক্যান করুন"
              >
                <ScanLine size={18} />
              </button>
            </div>
            {checkingImei && <p className="mt-1 text-xs text-ink-faint">খোঁজা হচ্ছে...</p>}
            {matchedPhone && (
              <p className="mt-1 text-xs text-up">স্টক থেকে পাওয়া গেছে — {matchedPhone.name_model}</p>
            )}
          </Field>
          <Field label="Model">
            <input
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              readOnly={!!matchedPhone}
              placeholder="ফোনের নাম ও মডেল"
              className={inputClass + (matchedPhone ? " opacity-70" : "")}
            />
          </Field>
          <Field label="RAM/ROM (ঐচ্ছিক)">
            <input
              value={form.ram_rom}
              onChange={(e) => setForm({ ...form, ram_rom: e.target.value })}
              placeholder="যেমন: 4/64 GB"
              className={inputClass}
            />
          </Field>
          <Field label="Battery Health (ঐচ্ছিক)">
            <input
              value={form.battery_health}
              onChange={(e) => setForm({ ...form, battery_health: e.target.value })}
              placeholder="যেমন: 92%"
              className={inputClass}
            />
          </Field>
          <Field label="Price (৳)">
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
            <span className="text-sm font-medium">বাকি বিক্রি (Due)</span>
          </label>

          {isDue && (
            <Field label="এখন কত টাকা দিলো (অগ্রিম, না দিলে ০)">
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
            {saving ? "সেভ হচ্ছে..." : "বিক্রি নিশ্চিত করুন ও মেমো বানান"}
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
