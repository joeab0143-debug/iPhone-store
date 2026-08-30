"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { Button, Field, inputClass, Sheet, money, formatDate } from "./ui";
import type { NetProfitSummary, OutsideDeal } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

export default function ProfitTab() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [summary, setSummary] = useState<NetProfitSummary | null>(null);
  const [deals, setDeals] = useState<OutsideDeal[]>([]);
  const [loading, setLoading] = useState(true);

  const [dealOpen, setDealOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    model: "",
    imei: "",
    buy_price: "",
    nid: "",
    phone_number: "",
    sell_price: "",
    profit: "",
    deal_date: "",
  });

  async function load() {
    setLoading(true);
    const qs = `?from=${from}&to=${to}`;
    const [sRes, dRes] = await Promise.all([
      fetch(`/api/summary${qs}`),
      fetch(`/api/outside${qs}`),
    ]);
    setSummary(await sRes.json());
    const dData: any = await dRes.json();
    setDeals(dData.deals || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function submitDeal() {
    setError("");
    if (!form.name) {
      setError("নাম দিন");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/outside", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        model: form.model || null,
        imei: form.imei || null,
        buy_price: form.buy_price ? Number(form.buy_price) : 0,
        nid: form.nid || null,
        phone_number: form.phone_number || null,
        sell_price: form.sell_price ? Number(form.sell_price) : null,
        profit: form.profit ? Number(form.profit) : null,
        deal_date: form.deal_date ? `${form.deal_date} 00:00:00` : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("সেভ করা যায়নি");
      return;
    }
    setForm({
      name: "",
      model: "",
      imei: "",
      buy_price: "",
      nid: "",
      phone_number: "",
      sell_price: "",
      profit: "",
      deal_date: "",
    });
    setDealOpen(false);
    load();
  }

  async function deleteDeal(id: number) {
    await fetch(`/api/outside/${id}`, { method: "DELETE" });
    load();
  }

  const netPositive = (summary?.net_profit ?? 0) >= 0;

  return (
    <div className="pb-24">
      {/* Date range filter */}
      <div className="mb-4 flex items-center gap-2">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className={inputClass + " flex-1"}
        />
        <span className="text-ink-faint">—</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={inputClass + " flex-1"}
        />
      </div>

      {/* Net profit hero */}
      <div className="phone-card mb-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-muted">নিট প্রফিট (নির্বাচিত সময়ে)</p>
          {netPositive ? (
            <TrendingUp size={18} className="text-up" />
          ) : (
            <TrendingDown size={18} className="text-down" />
          )}
        </div>
        <p
          className={`tabular font-display text-4xl font-extrabold mt-1 ${
            netPositive ? "text-up" : "text-down"
          }`}
        >
          ৳{money(summary?.net_profit)}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2.5 text-sm">
          <SummaryStat label="স্টক প্রফিট" value={summary?.stock_profit} tone="up" />
          <SummaryStat label="Outside প্রফিট" value={summary?.outside_profit} tone="up" />
          <SummaryStat label="মোট খরচ" value={summary?.total_expense} tone="down" negative />
          <SummaryStat label="বকেয়া বাকি" value={summary?.total_due_outstanding} tone="due" />
        </div>
      </div>

      {/* Outside profit deals */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display font-semibold">Outside Profit — পুরনো ফোন কেনাবেচা</h3>
      </div>

      {loading ? (
        <p className="text-center text-sm text-ink-muted py-10">লোড হচ্ছে...</p>
      ) : deals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center text-ink-muted">
          এই সময়ে কোনো ডিল নেই
        </div>
      ) : (
        <ul className="space-y-2">
          {deals.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-border bg-surface p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{d.name}</p>
                  {(d.model || d.imei) && (
                    <p className="text-xs text-ink-faint truncate">
                      {d.model}
                      {d.model && d.imei ? " · " : ""}
                      {d.imei && `IMEI: ${d.imei}`}
                    </p>
                  )}
                  <p className="text-xs text-ink-faint">{formatDate(d.deal_date)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`tabular font-semibold ${
                      d.profit >= 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {d.profit >= 0 ? "+" : ""}৳{money(d.profit)}
                  </span>
                  <button
                    onClick={() => deleteDeal(d.id)}
                    className="text-ink-faint hover:text-down"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => setDealOpen(true)}
        className="no-print fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-[#1a1400] shadow-lg shadow-gold/20 active:scale-95"
        aria-label="নতুন ডিল যোগ করুন"
      >
        <Plus size={26} />
      </button>

      <Sheet open={dealOpen} onClose={() => setDealOpen(false)} title="নতুন Outside Deal">
        <div className="space-y-3">
          <Field label="নাম">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Model">
            <input
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="IMEI">
            <input
              value={form.imei}
              onChange={(e) => setForm({ ...form, imei: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Buy Price (৳)">
            <input
              type="number"
              inputMode="decimal"
              value={form.buy_price}
              onChange={(e) => setForm({ ...form, buy_price: e.target.value })}
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
          <Field label="Phone Number">
            <input
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Sell Price (৳) — দিলে প্রফিট অটো হিসাব হবে">
            <input
              type="number"
              inputMode="decimal"
              value={form.sell_price}
              onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="অথবা সরাসরি প্রফিট লিখুন (Sell Price ফাঁকা রাখলে)">
            <input
              type="number"
              inputMode="decimal"
              value={form.profit}
              onChange={(e) => setForm({ ...form, profit: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="তারিখ (ফাঁকা রাখলে আজকের তারিখ বসবে)">
            <input
              type="date"
              value={form.deal_date}
              onChange={(e) => setForm({ ...form, deal_date: e.target.value })}
              className={inputClass}
            />
          </Field>
          {error && <p className="text-sm text-down">{error}</p>}
          <Button full onClick={submitDeal} disabled={saving}>
            {saving ? "সেভ হচ্ছে..." : "যোগ করুন"}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
  negative,
}: {
  label: string;
  value: number | undefined;
  tone: "up" | "down" | "due";
  negative?: boolean;
}) {
  const colors = { up: "text-up", down: "text-down", due: "text-due" };
  return (
    <div className="rounded-xl bg-surface-2 p-2.5">
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p className={`tabular font-semibold ${colors[tone]}`}>
        {negative && value ? "-" : ""}৳{money(value)}
      </p>
    </div>
  );
}
