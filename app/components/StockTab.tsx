"use client";

import { useEffect, useState } from "react";
import { Plus, ScanLine, Printer, Receipt, Wallet, Search } from "lucide-react";
import { Button, Field, inputClass, Sheet, Badge, money, formatDate } from "./ui";
import BarcodeScanner from "./BarcodeScanner";
import BarcodeSticker from "./BarcodeSticker";
import { generateInvoicePDF } from "@/lib/invoice";
import { emitDashboardRefresh } from "@/lib/events";
import type { Phone, Sale } from "@/lib/types";

const SHOP_NAME = "Phone Fantasy";

export default function StockTab() {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [filter, setFilter] = useState<"all" | "unsold" | "sold">("unsold");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [sellPhone, setSellPhone] = useState<Phone | null>(null);
  const [stickerPhone, setStickerPhone] = useState<Phone | null>(null);
  const [duePhone, setDuePhone] = useState<{ phone: Phone; sale: Sale } | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<"add" | "find">("find");

  const [form, setForm] = useState({ name_model: "", imei: "", buy_price: "", buy_date: "" });
  const [sellForm, setSellForm] = useState({
    selling_price: "",
    selling_date: "",
    is_due: false,
    customer_name: "",
    customer_phone: "",
    paid_now: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const q = filter === "all" ? "" : `?status=${filter}`;
    const res = await fetch(`/api/stock${q}`);
    const data: any = await res.json();
    setPhones(data.phones || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [filter]);

  const filtered = phones.filter((p) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      p.name_model.toLowerCase().includes(s) || p.imei.toLowerCase().includes(s)
    );
  });

  async function submitAdd() {
    setError("");
    if (!form.name_model || !form.imei || !form.buy_price) {
      setError("সব ঘর পূরণ করুন");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name_model: form.name_model,
        imei: form.imei,
        buy_price: Number(form.buy_price),
        buy_date: form.buy_date ? `${form.buy_date} 00:00:00` : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d: any = await res.json();
      setError(d.error || "সেভ করা যায়নি");
      return;
    }
    setForm({ name_model: "", imei: "", buy_price: "", buy_date: "" });
    setAddOpen(false);
    emitDashboardRefresh();
    load();
  }

  async function submitSell() {
    if (!sellPhone) return;
    setError("");
    if (!sellForm.selling_price) {
      setError("বিক্রয়মূল্য দিন");
      return;
    }
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
        paid_now: sellForm.is_due ? Number(sellForm.paid_now || 0) : undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d: any = await res.json();
      setError(d.error || "সেভ করা যায়নি");
      return;
    }
    const d: any = await res.json();
    setSellForm({
      selling_price: "",
      selling_date: "",
      is_due: false,
      customer_name: "",
      customer_phone: "",
      paid_now: "",
    });
    const soldSaleId = d.id;
    setSellPhone(null);
    emitDashboardRefresh();
    load();

    // fetch to build receipt
    const r = await fetch(`/api/sales/${soldSaleId}`);
    const sd: any = await r.json();
    generateInvoicePDF({
      saleId: sd.sale.id,
      shopName: SHOP_NAME,
      nameModel: sd.sale.name_model,
      imei: sd.sale.imei,
      sellingPrice: sd.sale.selling_price,
      sellingDate: formatDate(sd.sale.selling_date),
      isDue: !!sd.sale.is_due,
      customerName: sd.sale.customer_name,
      customerPhone: sd.sale.customer_phone,
      paidAmount: sd.sale.paid_amount,
      dueAmount: sd.sale.due_amount,
    });
  }

  async function openDuePanel(phone: Phone) {
    const res = await fetch(`/api/stock/${phone.id}`);
    const d: any = await res.json();
    if (d.sale) {
      setDuePhone({ phone, sale: d.sale });
    }
  }

  async function printReceiptFor(phoneId: number) {
    const res = await fetch(`/api/stock/${phoneId}`);
    const d: any = await res.json();
    if (!d.sale) return;
    generateInvoicePDF({
      saleId: d.sale.id,
      shopName: SHOP_NAME,
      nameModel: d.phone.name_model,
      imei: d.phone.imei,
      sellingPrice: d.sale.selling_price,
      sellingDate: formatDate(d.sale.selling_date),
      isDue: !!d.sale.is_due,
      customerName: d.sale.customer_name,
      customerPhone: d.sale.customer_phone,
      paidAmount: d.sale.paid_amount,
      dueAmount: d.sale.due_amount,
    });
  }

  function handleScanResult(code: string) {
    setScanOpen(false);
    if (scanTarget === "add") {
      setForm((f) => ({ ...f, imei: code }));
      setAddOpen(true);
    } else {
      setSearch(code);
      setFilter("all");
    }
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
            placeholder="নাম বা IMEI দিয়ে খুঁজুন"
            className={inputClass + " pl-9"}
          />
        </div>
        <button
          onClick={() => {
            setScanTarget("find");
            setScanOpen(true);
          }}
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-teal"
          aria-label="বারকোড স্ক্যান"
        >
          <ScanLine size={20} />
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        {(["unsold", "sold", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium border ${
              filter === f
                ? "border-teal bg-teal/15 text-teal"
                : "border-border text-ink-muted"
            }`}
          >
            {f === "unsold" ? "স্টকে আছে" : f === "sold" ? "বিক্রি হয়েছে" : "সব"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-sm text-ink-muted py-10">লোড হচ্ছে...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-ink-muted">
          কোনো ফোন নেই — নতুন ফোন যোগ করুন
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-semibold truncate">{p.name_model}</p>
                  <p className="mt-0.5 text-xs text-ink-faint tabular">IMEI: {p.imei}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    ক্রয়: <span className="tabular">৳{money(p.buy_price)}</span> ·{" "}
                    {formatDate(p.buy_date)}
                  </p>
                </div>
                <Badge tone={p.status === "unsold" ? "default" : "up"}>
                  {p.status === "unsold" ? "Unsold" : "Sold"}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {p.status === "unsold" ? (
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={() => setSellPhone(p)}
                  >
                    বিক্রি করুন
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => printReceiptFor(p.id)}
                    >
                      <Receipt size={15} /> বিল
                    </Button>
                    <Button variant="secondary" onClick={() => openDuePanel(p)}>
                      <Wallet size={15} /> বাকি দেখুন
                    </Button>
                  </>
                )}
                <button
                  onClick={() => setStickerPhone(p)}
                  className="flex items-center justify-center rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-ink-muted hover:text-teal"
                  aria-label="স্টিকার প্রিন্ট"
                >
                  <Printer size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Floating add button */}
      <button
        onClick={() => setAddOpen(true)}
        className="no-print fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-[#1a1400] shadow-lg shadow-gold/20 active:scale-95"
        aria-label="নতুন ফোন যোগ করুন"
      >
        <Plus size={26} />
      </button>

      {/* Add phone sheet */}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="নতুন ফোন যোগ করুন">
        <div className="space-y-3">
          <Field label="ফোনের নাম ও মডেল">
            <input
              value={form.name_model}
              onChange={(e) => setForm({ ...form, name_model: e.target.value })}
              placeholder="যেমন: Samsung Galaxy A15"
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
                onClick={() => {
                  setScanTarget("add");
                  setScanOpen(true);
                }}
                className="flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 px-3 text-teal"
              >
                <ScanLine size={18} />
              </button>
            </div>
          </Field>
          <Field label="ক্রয়মূল্য (৳)">
            <input
              type="number"
              inputMode="decimal"
              value={form.buy_price}
              onChange={(e) => setForm({ ...form, buy_price: e.target.value })}
              placeholder="0"
              className={inputClass}
            />
          </Field>
          <Field label="ক্রয়ের তারিখ (ফাঁকা রাখলে আজকের তারিখ বসবে)">
            <input
              type="date"
              value={form.buy_date}
              onChange={(e) => setForm({ ...form, buy_date: e.target.value })}
              className={inputClass}
            />
          </Field>
          {error && <p className="text-sm text-down">{error}</p>}
          <Button full onClick={submitAdd} disabled={saving}>
            {saving ? "সেভ হচ্ছে..." : "যোগ করুন"}
          </Button>
        </div>
      </Sheet>

      {/* Sell sheet */}
      <Sheet
        open={!!sellPhone}
        onClose={() => setSellPhone(null)}
        title={sellPhone ? `বিক্রি — ${sellPhone.name_model}` : ""}
      >
        <div className="space-y-3">
          <Field label="বিক্রয়মূল্য (৳)">
            <input
              type="number"
              inputMode="decimal"
              value={sellForm.selling_price}
              onChange={(e) => setSellForm({ ...sellForm, selling_price: e.target.value })}
              placeholder="0"
              className={inputClass}
            />
          </Field>
          <Field label="বিক্রয়ের তারিখ (ফাঁকা রাখলে আজকের তারিখ বসবে)">
            <input
              type="date"
              value={sellForm.selling_date}
              onChange={(e) => setSellForm({ ...sellForm, selling_date: e.target.value })}
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
            <span className="text-sm font-medium">বাকি বিক্রি (Due)</span>
          </label>

          {sellForm.is_due && (
            <div className="space-y-3 rounded-xl border border-due/30 bg-due/5 p-3">
              <Field label="কাস্টমারের নাম">
                <input
                  value={sellForm.customer_name}
                  onChange={(e) =>
                    setSellForm({ ...sellForm, customer_name: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="কাস্টমারের ফোন নম্বর">
                <input
                  value={sellForm.customer_phone}
                  onChange={(e) =>
                    setSellForm({ ...sellForm, customer_phone: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="এখন কত টাকা দিলো (অগ্রিম, না দিলে ০)">
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
            {saving ? "সেভ হচ্ছে..." : "বিক্রি নিশ্চিত করুন ও বিল বানান"}
          </Button>
        </div>
      </Sheet>

      {/* Sticker print sheet */}
      <Sheet
        open={!!stickerPhone}
        onClose={() => setStickerPhone(null)}
        title="বারকোড স্টিকার"
      >
        {stickerPhone && (
          <div className="flex flex-col items-center gap-4">
            <div id="sticker-print-area">
              <BarcodeSticker imei={stickerPhone.imei} label={stickerPhone.name_model} />
            </div>
            <Button
              full
              onClick={() => {
                const w = window.open("", "_blank", "width=400,height=300");
                const node = document.getElementById("sticker-print-area");
                if (w && node) {
                  w.document.write(
                    `<html><head><title>Sticker</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh">${node.innerHTML}</body></html>`
                  );
                  w.document.close();
                  w.focus();
                  setTimeout(() => w.print(), 300);
                }
              }}
            >
              <Printer size={16} /> স্টিকার প্রিন্ট করুন
            </Button>
          </div>
        )}
      </Sheet>

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

function DuePanel({
  duePhone,
  onClose,
  onUpdated,
}: {
  duePhone: { phone: Phone; sale: Sale } | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
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
      setError("বৈধ পরিমাণ দিন");
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
      setError(d.error || "সেভ করা যায়নি");
      return;
    }
    setSale({ ...sale!, due_amount: d.due_amount, paid_amount: d.paid_amount });
    setAmount("");
    emitDashboardRefresh();
    onUpdated();
  }

  return (
    <Sheet open={!!duePhone} onClose={onClose} title={`বাকি হিসাব — ${duePhone.phone.name_model}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-2 p-3 text-center">
            <p className="text-xs text-ink-muted">মোট বিক্রয়মূল্য</p>
            <p className="tabular text-lg font-semibold">৳{money(sale.selling_price)}</p>
          </div>
          <div className="rounded-xl bg-due/10 p-3 text-center">
            <p className="text-xs text-due">বাকি আছে</p>
            <p className="tabular text-lg font-semibold text-due">৳{money(sale.due_amount)}</p>
          </div>
        </div>
        {sale.customer_name && (
          <p className="text-sm text-ink-muted">
            কাস্টমার: <span className="text-ink">{sale.customer_name}</span>{" "}
            {sale.customer_phone && `· ${sale.customer_phone}`}
          </p>
        )}

        {sale.due_amount > 0 ? (
          <>
            <Field label="কত টাকা পরিশোধ হলো">
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
              {saving ? "সেভ হচ্ছে..." : "পরিশোধ যোগ করুন"}
            </Button>
          </>
        ) : (
          <p className="text-center text-sm font-medium text-up">
            সম্পূর্ণ পরিশোধ হয়ে গেছে ✓
          </p>
        )}
      </div>
    </Sheet>
  );
}
