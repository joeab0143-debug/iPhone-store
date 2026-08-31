"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";
import { Button, Field, inputClass, Sheet } from "./ui";
import BarcodeScanner from "./BarcodeScanner";
import { emitDashboardRefresh } from "@/lib/events";

// Outside Sell is a standalone profit log — no invoice, no stock lookup.
// Just record what was sold (Model, IMEI) and the profit made on it; that
// profit adds straight into the total/net profit and cash.
const EMPTY_FORM = {
  model: "",
  imei: "",
  profit: "",
};

export default function OutsideSellSheet({
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
    if (!form.model || !form.imei || form.profit === "") {
      setError("Model, IMEI ও Profit — সব ঘর পূরণ করুন");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/outside", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: form.model,
        imei: form.imei,
        profit: Number(form.profit),
        status: "sold",
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
      <Sheet open={open} onClose={handleClose} title="Outside Sell">
        {done ? (
          <div className="py-6 text-center">
            <p className="mb-4 text-lg font-semibold text-up">প্রফিট যোগ হয়েছে ✓</p>
            <Button full onClick={reset}>
              আরেকটা Outside Sell যোগ করুন
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Model">
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
            <Field label="Profit (৳)">
              <input
                type="number"
                inputMode="decimal"
                value={form.profit}
                onChange={(e) => setForm({ ...form, profit: e.target.value })}
                placeholder="0"
                className={inputClass}
              />
            </Field>
            {error && <p className="text-sm text-down">{error}</p>}
            <Button full onClick={submit} disabled={saving}>
              {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
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
