"use client";

import { useState } from "react";
import { ScanLine, Download } from "lucide-react";
import { Button, Field, inputClass, Sheet } from "./ui";
import BarcodeScanner from "./BarcodeScanner";
import { generateReportPDF } from "@/lib/report-pdf";
import { emitDashboardRefresh } from "@/lib/events";

const SHOP_NAME = "iPhone Store";

const EMPTY_FORM = {
  model: "",
  imei: "",
  ram_rom: "",
  battery_health: "",
  buy_price: "",
  bought_from: "",
  phone_number: "",
  nid: "",
  stock_type: "regular" as "regular" | "outside",
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

  // ক্রয় ইতিহাস ডাউনলোড — ফোন বিক্রি হয়ে স্টক থেকে চলে গেলেও কার কাছ থেকে
  // কী কেনা হয়েছিল সেই তথ্য (phones টেবিলে) হারিয়ে যায় না; এখান থেকে যে
  // কোনো সময় পুরো ইতিহাস, বা ডেট রেঞ্জ বেছে, PDF আকারে নামানো যাবে।
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  function reset() {
    setForm(EMPTY_FORM);
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
      setHistoryError("ইতিহাস লোড করা যায়নি");
      return;
    }
    setHistoryLoading(false);
    const phones: any[] = data?.phones || [];
    const totalBuyValue = phones.reduce((s, p) => s + Number(p.buy_price), 0);
    const subtitle =
      historyFrom || historyTo
        ? `${historyFrom || "শুরু থেকে"} — ${historyTo || "আজ পর্যন্ত"}`
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
          head: ["Model", "IMEI", "Buy Date", "Bought From", "Number", "NID", "Buy Price (Tk)", "Type", "Status"],
          rows: phones.map((p) => [
            p.name_model,
            p.imei,
            (p.buy_date || "-").toString().slice(0, 10),
            p.bought_from || "-",
            p.phone_number || "-",
            p.nid || "-",
            Number(p.buy_price).toLocaleString(),
            p.stock_type === "outside" ? "Outside" : "Regular",
            p.status === "sold" ? "Sold" : "In Stock",
          ]),
          emptyLabel: "এই সময়ের মধ্যে কোনো ক্রয় নেই",
        },
        footerNote: "Generated from iPhone Store — Buy History",
      },
      previewWin
    );
  }

  async function submit() {
    setError("");
    if (!form.model || !form.imei || !form.buy_price || !form.bought_from) {
      setError("Model Number, IMEI, Buy Price ও Buy from whom — এই ঘরগুলো পূরণ করুন");
      return;
    }
    setSaving(true);
    // Buy always adds the phone straight into the main stock (phones table)
    // so it shows up in the Stock tab immediately — no separate table for
    // "outside" phones. stock_type just flags whether this purchase should
    // deduct from Total Cash (regular) or not (outside — see /api/stock and
    // lib/cash.ts).
    const res = await fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name_model: form.model,
        imei: form.imei,
        buy_price: Number(form.buy_price),
        ram_rom: form.ram_rom || null,
        battery_health: form.battery_health || null,
        bought_from: form.bought_from,
        phone_number: form.phone_number || null,
        nid: form.nid || null,
        stock_type: form.stock_type,
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
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">ক্রয় ইতিহাস</p>
            <p className="mt-0.5 text-[11px] text-ink-faint">
              কার কাছ থেকে কী কেনা হয়েছে — এ যাবতকালের বা ডেট বেছে ডাউনলোড করুন
            </p>
          </div>
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-teal"
          >
            <Download size={14} /> ডাউনলোড
          </button>
        </div>

        {done ? (
          <div className="py-6 text-center">
            <p className="mb-4 text-lg font-semibold text-up">ক্রয় সেভ হয়েছে — স্টকে যোগ হয়েছে ✓</p>
            <Button full onClick={reset}>
              আরেকটা ফোন ক্রয় করুন
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="এই ফোনটি কোথায় যাবে?">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-1.5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, stock_type: "regular" })}
                  className={`rounded-lg py-2 text-sm font-semibold transition ${
                    form.stock_type === "regular"
                      ? "bg-gold text-white"
                      : "text-ink-muted"
                  }`}
                >
                  রেগুলার স্টক
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, stock_type: "outside" })}
                  className={`rounded-lg py-2 text-sm font-semibold transition ${
                    form.stock_type === "outside"
                      ? "bg-gold text-white"
                      : "text-ink-muted"
                  }`}
                >
                  আউটসাইড স্টক
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-ink-faint">
                {form.stock_type === "outside"
                  ? "আউটসাইড স্টক নির্বাচন করলে ক্রয়মূল্য টোটাল ক্যাশ থেকে কাটবে না — বিক্রি হলে লাভের ৫০% প্রফিটে যোগ হবে।"
                  : "রেগুলার স্টক নির্বাচন করলে ক্রয়মূল্য টোটাল ক্যাশ থেকে কাটা হবে, আগের মতোই।"}
              </p>
            </Field>
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
            <Field label="Battery Health (ঐচ্ছিক)">
              <input
                value={form.battery_health}
                onChange={(e) => setForm({ ...form, battery_health: e.target.value })}
                placeholder="যেমন: 92%"
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

      <Sheet
        open={historyOpen}
        onClose={() => {
          setHistoryOpen(false);
          setHistoryFrom("");
          setHistoryTo("");
          setHistoryError("");
        }}
        title="ক্রয় ইতিহাস ডাউনলোড"
      >
        <div className="space-y-3">
          <Field label="শুরুর তারিখ (ঐচ্ছিক)">
            <input
              type="date"
              value={historyFrom}
              onChange={(e) => setHistoryFrom(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="শেষ তারিখ (ঐচ্ছিক)">
            <input
              type="date"
              value={historyTo}
              onChange={(e) => setHistoryTo(e.target.value)}
              className={inputClass}
            />
          </Field>
          <p className="text-[11px] text-ink-faint">
            দুটোই ফাঁকা রাখলে এ যাবতকালের সকল ক্রয় ইতিহাস ডাউনলোড হবে।
          </p>
          {historyError && <p className="text-sm text-down">{historyError}</p>}
          <Button full onClick={downloadBuyHistory} disabled={historyLoading}>
            {historyLoading ? "তৈরি হচ্ছে..." : "PDF ডাউনলোড করুন"}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
