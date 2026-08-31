"use client";

import { useEffect, useState } from "react";
import { ScanLine } from "lucide-react";
import { Button, Field, inputClass, Sheet } from "./ui";
import BarcodeScanner from "./BarcodeScanner";
import { generateInvoicePDF } from "@/lib/invoice";
import { emitDashboardRefresh } from "@/lib/events";
import type { OutsideDeal } from "@/lib/types";

const SHOP_NAME = "Phone Fantasy";

const EMPTY_FORM = {
  customer_name: "",
  customer_phone: "",
  model: "",
  imei: "",
  sell_price: "",
};

export default function OutsideSellSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [matched, setMatched] = useState<OutsideDeal | null>(null);
  const [checkingImei, setCheckingImei] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Outside Sell only works on phones already logged through Buy, so we
  // look them up by IMEI among unsold outside_deals rows.
  useEffect(() => {
    const imei = form.imei.trim();
    if (!imei) {
      setMatched(null);
      return;
    }
    const t = setTimeout(async () => {
      setCheckingImei(true);
      try {
        const res = await fetch(`/api/outside?status=unsold&imei=${encodeURIComponent(imei)}`);
        const d: any = await res.json();
        const found: OutsideDeal | undefined = (d.deals || [])[0];
        if (found) {
          setMatched(found);
          setForm((f) => ({ ...f, model: found.model || "" }));
        } else {
          setMatched(null);
        }
      } catch {
        // ignore
      }
      setCheckingImei(false);
    }, 400);
    return () => clearTimeout(t);
  }, [form.imei]);

  function reset() {
    setForm(EMPTY_FORM);
    setMatched(null);
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function submit() {
    setError("");
    if (!form.customer_name || !form.customer_phone || !form.imei || !form.sell_price) {
      setError("সব ঘর পূরণ করুন");
      return;
    }
    if (!matched) {
      setError("এই IMEI দিয়ে কেনা কোনো ফোন Buy তালিকায় পাওয়া যায়নি — আগে Buy করুন");
      return;
    }
    setSaving(true);
    const nowSql = new Date().toISOString().slice(0, 19).replace("T", " ");
    const res = await fetch(`/api/outside/${matched.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sell_price: Number(form.sell_price),
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        status: "sold",
        sell_date: nowSql,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d: any = await res.json().catch(() => ({}));
      setError(d.error || "সেভ করা যায়নি");
      return;
    }
    emitDashboardRefresh();

    generateInvoicePDF({
      saleId: matched.id,
      shopName: SHOP_NAME,
      nameModel: form.model || matched.model || "-",
      imei: matched.imei || form.imei,
      sellingPrice: Number(form.sell_price),
      sellingDate: nowSql,
      isDue: false,
      customerName: form.customer_name,
      customerPhone: form.customer_phone,
      paidAmount: Number(form.sell_price),
      dueAmount: 0,
    });

    handleClose();
  }

  return (
    <>
      <Sheet open={open} onClose={handleClose} title="Outside Sell">
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
            {matched ? (
              <p className="mt-1 text-xs text-up">Buy তালিকা থেকে পাওয়া গেছে — {matched.model}</p>
            ) : (
              form.imei.trim() && (
                <p className="mt-1 text-xs text-down">Buy তালিকায় এই IMEI পাওয়া যায়নি</p>
              )
            )}
          </Field>
          <Field label="Model">
            <input value={form.model} readOnly className={inputClass + " opacity-70"} />
          </Field>
          <Field label="Price (৳)">
            <input
              type="number"
              inputMode="decimal"
              value={form.sell_price}
              onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
              placeholder="0"
              className={inputClass}
            />
          </Field>
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
