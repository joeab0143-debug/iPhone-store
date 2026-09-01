"use client";

import { useEffect, useState } from "react";
import { ScanLine, Printer, Receipt, Wallet, Search, RotateCcw } from "lucide-react";
import { Button, Field, inputClass, Sheet, Badge, money, formatDate } from "./ui";
import BarcodeScanner from "./BarcodeScanner";
import BarcodeSticker from "./BarcodeSticker";
import { generateInvoicePDF } from "@/lib/invoice";
import { emitDashboardRefresh, DASHBOARD_REFRESH_EVENT } from "@/lib/events";
import type { Phone, Sale } from "@/lib/types";

const SHOP_NAME = "Phone Fantasy";

export default function StockTab() {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [filter, setFilter] = useState<"all" | "unsold" | "sold">("unsold");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [sellPhone, setSellPhone] = useState<Phone | null>(null);
  const [stickerPhone, setStickerPhone] = useState<Phone | null>(null);
  const [detailsPhone, setDetailsPhone] = useState<Phone | null>(null);
  const [duePhone, setDuePhone] = useState<{ phone: Phone; sale: Sale } | null>(null);
  const [scanOpen, setScanOpen] = useState(false);

  const [sellForm, setSellForm] = useState({
    selling_price: "",
    selling_date: "",
    is_due: false,
    customer_name: "",
    customer_phone: "",
    paid_now: "",
    ram_rom: "",
    battery_health: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [returningId, setReturningId] = useState<number | null>(null);

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

  // Buy/Sell/Return elsewhere in the app (bottom action bar, etc.) fire this
  // event — reload so newly bought phones show up here without a manual
  // page refresh.
  useEffect(() => {
    const handler = () => load();
    window.addEventListener(DASHBOARD_REFRESH_EVENT, handler);
    return () => window.removeEventListener(DASHBOARD_REFRESH_EVENT, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const filtered = phones.filter((p) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      p.name_model.toLowerCase().includes(s) || p.imei.toLowerCase().includes(s)
    );
  });

  async function submitSell() {
    if (!sellPhone) return;
    setError("");
    if (!sellForm.selling_price) {
      setError("বিক্রয়মূল্য দিন");
      return;
    }
    // Open the receipt tab now, still inside this click's user gesture —
    // browsers block window.open() once we hit the awaits below.
    const previewWin = window.open("", "_blank");
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
        ram_rom: sellForm.ram_rom || null,
        battery_health: sellForm.battery_health || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      previewWin?.close();
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
      ram_rom: "",
      battery_health: "",
    });
    const soldSaleId = d.id;
    setSellPhone(null);
    emitDashboardRefresh();
    load();

    // fetch to build receipt
    const r = await fetch(`/api/sales/${soldSaleId}`);
    const sd: any = await r.json();
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
  }

  async function openDuePanel(phone: Phone) {
    const res = await fetch(`/api/stock/${phone.id}`);
    const d: any = await res.json();
    if (d.sale) {
      setDuePhone({ phone, sale: d.sale });
    }
  }

  async function printReceiptFor(phoneId: number) {
    // Open the tab first — still inside the click's user gesture — then
    // navigate it to the PDF once it's ready below.
    const previewWin = window.open("", "_blank");
    const res = await fetch(`/api/stock/${phoneId}`);
    const d: any = await res.json();
    if (!d.sale) {
      previewWin?.close();
      return;
    }
    generateInvoicePDF(
      {
        saleId: d.sale.id,
        shopName: SHOP_NAME,
        nameModel: d.phone.name_model,
        imei: d.phone.imei,
        sellingPrice: d.sale.selling_price,
        sellingDate: d.sale.selling_date,
        isDue: !!d.sale.is_due,
        customerName: d.sale.customer_name,
        customerPhone: d.sale.customer_phone,
        paidAmount: d.sale.paid_amount,
        dueAmount: d.sale.due_amount,
        ramRom: d.sale.ram_rom,
        batteryHealth: d.sale.battery_health,
      },
      previewWin
    );
  }

  // Return: undoes the sale (removes it, phone goes back to unsold) and
  // reprints the same memo with a RETURNED stamp at the bottom.
  async function returnPhone(phone: Phone) {
    if (
      !window.confirm(`${phone.name_model} — এই ফোনটি ফেরত নিয়ে স্টকে যোগ করবেন?`)
    ) {
      return;
    }
    // Open the tab right after confirm (still user-gesture-attached) —
    // pointed at the PDF once it's built below.
    const previewWin = window.open("", "_blank");
    const res = await fetch(`/api/stock/${phone.id}`);
    const d: any = await res.json();
    if (!d.sale) {
      previewWin?.close();
      return;
    }
    const sale = d.sale;
    setReturningId(phone.id);
    const delRes = await fetch(`/api/sales/${sale.id}`, { method: "DELETE" });
    setReturningId(null);
    if (!delRes.ok) {
      previewWin?.close();
      setError("রিটার্ন করা যায়নি");
      return;
    }
    emitDashboardRefresh();
    load();
    generateInvoicePDF(
      {
        saleId: sale.id,
        shopName: SHOP_NAME,
        nameModel: phone.name_model,
        imei: phone.imei,
        sellingPrice: sale.selling_price,
        sellingDate: sale.selling_date,
        isDue: !!sale.is_due,
        customerName: sale.customer_name,
        customerPhone: sale.customer_phone,
        paidAmount: sale.paid_amount,
        dueAmount: sale.due_amount,
        ramRom: sale.ram_rom,
        batteryHealth: sale.battery_health,
        isReturn: true,
      },
      previewWin
    );
  }

  function handleScanResult(code: string) {
    setScanOpen(false);
    setSearch(code);
    setFilter("all");
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
          onClick={() => setScanOpen(true)}
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
          কোনো ফোন নেই — নিচের Buy বাটন থেকে ফোন ক্রয় করুন
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => (
            <li
              key={p.id}
              onClick={() => setDetailsPhone(p)}
              className="cursor-pointer rounded-xl border border-border bg-surface p-3 active:bg-surface-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-display text-sm font-semibold truncate">
                      {p.name_model}
                    </p>
                    <Badge tone={p.status === "unsold" ? "default" : "up"}>
                      {p.status === "unsold" ? "Unsold" : "Sold"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-faint tabular">
                    IMEI: {p.imei}
                    {p.ram_rom && ` · ${p.ram_rom}`}
                    {p.bought_from && ` · ${p.bought_from} থেকে`} · ৳{money(p.buy_price)} ·{" "}
                    {formatDate(p.buy_date)}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                {p.status === "unsold" ? (
                  <Button
                    variant="primary"
                    className="flex-1 !py-2 !text-xs"
                    onClick={() => setSellPhone(p)}
                  >
                    বিক্রি করুন
                  </Button>
                ) : (
                  <>
                    <button
                      onClick={() => printReceiptFor(p.id)}
                      className="flex items-center justify-center rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-ink-muted hover:text-teal"
                      aria-label="বিল দেখুন"
                    >
                      <Receipt size={15} />
                    </button>
                    <button
                      onClick={() => openDuePanel(p)}
                      className="flex items-center justify-center rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-ink-muted hover:text-teal"
                      aria-label="বাকি দেখুন"
                    >
                      <Wallet size={15} />
                    </button>
                    <button
                      onClick={() => returnPhone(p)}
                      disabled={returningId === p.id}
                      className="flex items-center justify-center rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-ink-muted hover:text-down disabled:opacity-50"
                      aria-label="ফোন ফেরত নিন"
                    >
                      <RotateCcw size={15} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setStickerPhone(p)}
                  className="flex items-center justify-center rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-ink-muted hover:text-teal"
                  aria-label="স্টিকার প্রিন্ট"
                >
                  <Printer size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

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
          <Field label="RAM/ROM (ঐচ্ছিক)">
            <input
              value={sellForm.ram_rom}
              onChange={(e) => setSellForm({ ...sellForm, ram_rom: e.target.value })}
              placeholder="যেমন: 4/64 GB"
              className={inputClass}
            />
          </Field>
          <Field label="Battery Health (ঐচ্ছিক)">
            <input
              value={sellForm.battery_health}
              onChange={(e) => setSellForm({ ...sellForm, battery_health: e.target.value })}
              placeholder="যেমন: 92%"
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

      {/* Phone details — opens when tapping a card */}
      <PhoneDetailsSheet
        phone={detailsPhone}
        onClose={() => setDetailsPhone(null)}
        onSell={(p) => {
          setDetailsPhone(null);
          setSellPhone(p);
        }}
        onPrintBill={(p) => {
          setDetailsPhone(null);
          printReceiptFor(p.id);
        }}
        onViewDue={(p) => {
          setDetailsPhone(null);
          openDuePanel(p);
        }}
        onReturn={(p) => {
          setDetailsPhone(null);
          returnPhone(p);
        }}
      />

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

function PhoneDetailsSheet({
  phone,
  onClose,
  onSell,
  onPrintBill,
  onViewDue,
  onReturn,
}: {
  phone: Phone | null;
  onClose: () => void;
  onSell: (phone: Phone) => void;
  onPrintBill: (phone: Phone) => void;
  onViewDue: (phone: Phone) => void;
  onReturn: (phone: Phone) => void;
}) {
  const [sale, setSale] = useState<Sale | null>(null);

  useEffect(() => {
    setSale(null);
    if (phone && phone.status === "sold") {
      fetch(`/api/stock/${phone.id}`)
        .then((r) => r.json())
        .then((d: any) => setSale(d.sale || null))
        .catch(() => {});
    }
  }, [phone]);

  if (!phone) return null;

  const detailRows: { label: string; value: string }[] = [
    { label: "IMEI", value: phone.imei },
    ...(phone.ram_rom ? [{ label: "RAM/ROM", value: phone.ram_rom }] : []),
    ...(phone.bought_from ? [{ label: "Buy from whom", value: phone.bought_from }] : []),
    ...(phone.phone_number ? [{ label: "Number", value: phone.phone_number }] : []),
    ...(phone.nid ? [{ label: "NID", value: phone.nid }] : []),
    { label: "ক্রয়মূল্য", value: `৳${money(phone.buy_price)}` },
    { label: "ক্রয়ের তারিখ", value: formatDate(phone.buy_date) },
  ];

  return (
    <Sheet open={!!phone} onClose={onClose} title={phone.name_model}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge tone={phone.status === "unsold" ? "default" : "up"}>
            {phone.status === "unsold" ? "Unsold" : "Sold"}
          </Badge>
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3.5">
          {detailRows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink-muted">{r.label}</span>
              <span className="tabular font-medium text-right">{r.value}</span>
            </div>
          ))}
        </div>

        {phone.status === "sold" && sale && (
          <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3.5">
            <p className="text-xs font-semibold text-ink-muted">বিক্রির তথ্য</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">বিক্রয়মূল্য</span>
              <span className="tabular font-medium">৳{money(sale.selling_price)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">বিক্রয়ের তারিখ</span>
              <span className="tabular font-medium">{formatDate(sale.selling_date)}</span>
            </div>
            {sale.customer_name && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">কাস্টমার</span>
                <span className="font-medium">{sale.customer_name}</span>
              </div>
            )}
            {sale.customer_phone && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">নম্বর</span>
                <span className="tabular font-medium">{sale.customer_phone}</span>
              </div>
            )}
            {!!sale.is_due && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-due">বাকি আছে</span>
                <span className="tabular font-medium text-due">৳{money(sale.due_amount)}</span>
              </div>
            )}
          </div>
        )}

        {phone.status === "unsold" ? (
          <Button full onClick={() => onSell(phone)}>
            বিক্রি করুন
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => onPrintBill(phone)}>
              <Receipt size={15} /> বিল
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => onViewDue(phone)}>
              <Wallet size={15} /> বাকি
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => onReturn(phone)}>
              <RotateCcw size={15} /> রিটার্ন
            </Button>
          </div>
        )}
      </div>
    </Sheet>
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
