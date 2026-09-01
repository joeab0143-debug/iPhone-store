"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Tag } from "lucide-react";
import { Button, Field, inputClass, money, formatDate, Sheet, Badge } from "./ui";
import type { Gadget } from "@/lib/types";

// Gadgets & Accessories — a private buy/sell log for the user's own
// reference. Its profit is intentionally separate from the phone
// business's numbers: it never touches /api/dashboard or the Profit tab,
// only shows here when the user opens this tab.
//
// Entry = Buy Name + Buy Price + Quantity (how many units came in).
// Each unit is then sold separately, whenever it actually sells, with its
// own manually-entered sell price — remaining stock shrinks by one each
// time until it hits zero.
export default function GadgetsTab() {
  const [gadgets, setGadgets] = useState<Gadget[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ buy_name: "", buy_price: "", quantity: "1" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [sellTarget, setSellTarget] = useState<Gadget | null>(null);
  const [sellPrice, setSellPrice] = useState("");
  const [sellSaving, setSellSaving] = useState(false);
  const [sellError, setSellError] = useState("");

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
    if (!form.buy_name || !form.buy_price || !form.quantity) {
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
        quantity: Number(form.quantity),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d: any = await res.json().catch(() => ({}));
      setError(d.error || "সেভ করা যায়নি");
      return;
    }
    setForm({ buy_name: "", buy_price: "", quantity: "1" });
    setAddOpen(false);
    load();
  }

  async function deleteGadget(id: number) {
    if (!confirm("এই এন্ট্রিটি মুছে ফেলবেন?")) return;
    await fetch(`/api/gadgets/${id}`, { method: "DELETE" });
    load();
  }

  function openSell(g: Gadget) {
    setSellTarget(g);
    setSellPrice("");
    setSellError("");
  }

  async function confirmSell() {
    if (!sellTarget) return;
    setSellError("");
    if (!sellPrice || Number(sellPrice) <= 0) {
      setSellError("সঠিক Sell দাম দিন");
      return;
    }
    setSellSaving(true);
    const res = await fetch(`/api/gadgets/${sellTarget.id}/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sell_price: Number(sellPrice) }),
    });
    setSellSaving(false);
    if (!res.ok) {
      const d: any = await res.json().catch(() => ({}));
      setSellError(d.error || "সেভ করা যায়নি");
      return;
    }
    setSellTarget(null);
    load();
  }

  const totalBuy = gadgets.reduce((s, g) => s + Number(g.buy_price) * Number(g.quantity), 0);
  const totalSell = gadgets.reduce((s, g) => s + Number(g.total_sell || 0), 0);
  const totalProfit = gadgets.reduce((s, g) => s + Number(g.total_profit || 0), 0);

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
            <p className="text-[11px] text-ink-muted">মোট ক্রয় (Buy)</p>
            <p className="tabular font-semibold">৳{money(totalBuy)}</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-2.5">
            <p className="text-[11px] text-ink-muted">মোট বিক্রি (Sell)</p>
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
            const remaining = Number(g.quantity) - Number(g.sold_count || 0);
            const soldOut = remaining <= 0;
            return (
              <li
                key={g.id}
                className="rounded-xl border border-border bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{g.buy_name}</p>
                    <p className="text-xs text-ink-faint tabular">
                      Buy ৳{money(g.buy_price)} / unit · {formatDate(g.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteGadget(g.id)}
                    className="shrink-0 text-ink-faint hover:text-down"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Badge tone={soldOut ? "default" : "up"}>
                      স্টকে আছে: {remaining} / {g.quantity}
                    </Badge>
                    {Number(g.sold_count || 0) > 0 && (
                      <span
                        className={`tabular text-xs font-semibold ${
                          Number(g.total_profit) >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        {Number(g.total_profit) >= 0 ? "+" : ""}৳{money(g.total_profit)}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    className="!px-3 !py-1.5 !text-xs"
                    onClick={() => openSell(g)}
                    disabled={soldOut}
                  >
                    <Tag size={13} /> Sell
                  </Button>
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
          <Field label="Buy Price (৳ / প্রতি পিস)">
            <input
              type="number"
              inputMode="decimal"
              value={form.buy_price}
              onChange={(e) => setForm({ ...form, buy_price: e.target.value })}
              placeholder="0"
              className={inputClass}
            />
          </Field>
          <Field label="Quantity">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              placeholder="1"
              className={inputClass}
            />
          </Field>
          {error && <p className="text-sm text-down">{error}</p>}
          <Button full onClick={submit} disabled={saving}>
            {saving ? "সেভ হচ্ছে..." : "যোগ করুন"}
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={!!sellTarget}
        onClose={() => setSellTarget(null)}
        title={sellTarget ? `Sell — ${sellTarget.buy_name}` : "Sell"}
      >
        {sellTarget && (
          <div className="space-y-3">
            <p className="text-xs text-ink-muted">
              Buy দাম ছিল ৳{money(sellTarget.buy_price)} / unit · স্টকে আছে{" "}
              {Number(sellTarget.quantity) - Number(sellTarget.sold_count || 0)}টা
            </p>
            <Field label="Sell দাম (৳)">
              <input
                type="number"
                inputMode="decimal"
                autoFocus
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </Field>
            {sellError && <p className="text-sm text-down">{sellError}</p>}
            <Button full onClick={confirmSell} disabled={sellSaving}>
              {sellSaving ? "সেভ হচ্ছে..." : "বিক্রি নিশ্চিত করুন"}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
