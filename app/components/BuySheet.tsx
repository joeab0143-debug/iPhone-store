"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";
import { Button, Field, inputClass, Sheet } from "./ui";
import BarcodeScanner from "./BarcodeScanner";
import { emitDashboardRefresh } from "@/lib/events";

const EMPTY_FORM = {
  model: "",
  imei: "",
  ram_rom: "",
  buy_price: "",
  bought_from: "",
  phone_number: "",
  nid: "",
};

export default function BuySheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [scanOpen, setScanOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function reset() {
    setForm(EMPTY_FORM);
    setError("");
    setDone(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function submit() {
    setError("");
    if (!form.model || !form.imei || !form.buy_price || !form.bought_from) {
      setError("Model Number, IMEI, Buy Price ও Buy from whom — এই ঘরগুলো পূরণ করুন");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/outside", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: form.model,
        imei: form.imei,
        ram_rom: form.ram_rom || null,
        buy_price: Number(form.buy_price),
        bought_from: form.bought_from,
        phone_number: form.phone_number || null,
        nid: form.nid || null,
        status: "unsold",
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d: any = await res.json().catch(() => ({}));
      setError(d.error || "সেভ করা যায়নি");
      return;
    }
    emitDashboardRefresh();
    setDone(true);
  }

  return (
    <>
      <Sheet open={open} onClose={handleClose} title="ফোন ক্রয় (Buy)">
        {done ? (
          <div className="py-6 text-center">
            <p className="mb-4 text-lg font-semibold text-up">ক্রয় সেভ হয়েছে ✓</p>
            <Button full onClick={reset}>
              আরেকটা ফোন ক্রয় করুন
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Model Number">
              <input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="যেমন: iPhone 12, 128GB"
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
            </Field>
            <Field label="RAM/ROM">
              <input
                value={form.ram_rom}
                onChange={(e) => setForm({ ...form, ram_rom: e.target.value })}
                placeholder="যেমন: 4/64 GB"
                className={inputClass}
              />
            </Field>
            <Field label="Buy Price (৳)">
              <input
                type="number"
                inputMode="decimal"
                value={form.buy_price}
                onChange={(e) => setForm({ ...form, buy_price: e.target.value })}
                placeholder="0"
                className={inputClass}
              />
            </Field>
            <Field label="Buy from whom (কার কাছ থেকে কেনা হয়েছে)">
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
              {saving ? "সেভ হচ্ছে..." : "ক্রয় সেভ করুন"}
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
    </>
  );
}
