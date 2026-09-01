"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Field, inputClass, money, formatDate, Sheet } from "./ui";
import type { Gadget } from "@/lib/types";

// Gadgets & Accessories — a private buy/sell log for the user's own
// reference. Its profit is intentionally separate from the phone
// business's numbers: it never touches /api/dashboard or the Profit tab,
// only shows here when the user opens this tab.
export default function GadgetsTab() {
  const [gadgets, setGadgets] = useState<Gadget[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ buy_name: "", buy_price: "", sell_price: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/gadgets");
    const data: any = await res.json();
    setGadgets(data.gadgets || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit() {
    setError("");
    if (!form.buy_name || !form.buy_price || !form.sell_price) {
      setError("সব ঘর পূরণ করুন");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/gadgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buy_name: form.buy_name,
        buy_price: Number(form.buy_price),
        sell_price: Number(form.sell_price),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d: any = await res.json().catch(() => ({}));
      setError(d.error || "সেভ করা যায়নি");
      return;
    }
    setForm({ buy_name: "", buy_price: "", sell_price: "" });
    setAddOpen(false);
    load();
  }

  async function deleteGadget(id: number) {
    if (!confirm("এই এন্ট্রিটি মুছে ফেলবেন?")) return;
    await fetch(`/api/gadgets/${id}`, { method: "DELETE" });
    load();
  }

  const totalBuy = gadgets.reduce((s, g) => s + Number(g.buy_price), 0);
  const totalSell = gadgets.reduce((s, g) => s + Number(g.sell_price), 0);
  const totalProfit = totalSell - totalBuy;

  return (
    <div className="pb-24">
      <div className="mb-4 phone-card">
        <p className="text-xs text-ink-muted">Gadgets প্রফিট (শুধু এখানেই দেখা যাবে — মোট প্রফিটে যোগ হয় না)</p>
        <p
          className={`tabular font-display text-3xl font-extrabold mt-1 ${
            totalProfit >= 0 ? "text-up" : "text-down"
          }`}
        >
          ৳{money(totalProfit)}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2.5 text-sm">
          <div className="rounded-xl bg-surface-2 p-2.5">
            <p className="text-[11px] text-ink-muted">মোট Buy</p>
            <p className="tabular font-semibold">৳{money(totalBuy)}</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-2.5">
            <p className="text-[11px] text-ink-muted">মোট Sell</p>
            <p className="tabular font-semibold">৳{money(totalSell)}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-ink-muted py-10">লোড হচ্ছে...</p>
      ) : gadgets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-ink-muted">
          কোনো এন্ট্রি নেই — নতুন যোগ করুন
        </div>
      ) : (
        <ul className="space-y-2">
          {gadgets.map((g) => {
            const profit = Number(g.sell_price) - Number(g.buy_price);
            return (
              <li
                key={g.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{g.buy_name}</p>
                  <p className="text-xs text-ink-faint tabular">
                    Buy ৳{money(g.buy_price)} · Sell ৳{money(g.sell_price)} ·{" "}
                    {formatDate(g.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`tabular text-sm font-semibold ${
                      profit >= 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {profit >= 0 ? "+" : ""}৳{money(profit)}
                  </span>
                  <button
                    onClick={() => deleteGadget(g.id)}
                    className="text-ink-faint hover:text-down"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={() => setAddOpen(true)}
        className="no-print fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-[#1a1400] shadow-lg shadow-gold/20 active:scale-95"
        aria-label="নতুন এন্ট্রি যোগ করুন"
      >
        <Plus size={26} />
      </button>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Gadgets & Accessories">
        <div className="space-y-3">
          <Field label="Buy Name">
            <input
              value={form.buy_name}
              onChange={(e) => setForm({ ...form, buy_name: e.target.value })}
              placeholder="যেমন: Earphone, Charger, Cover"
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
          <Field label="Sell (৳)">
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
            {saving ? "সেভ হচ্ছে..." : "যোগ করুন"}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
