"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Tag, ChevronRight, Download } from "lucide-react";
import { Button, Field, inputClass, money, formatDate, Sheet, Badge } from "./ui";
import { generateReportPDF } from "@/lib/report-pdf";
import { useLang } from "@/lib/i18n";
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
  const { t } = useLang();
  const [gadgets, setGadgets] = useState<Gadget[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ buy_name: "", buy_price: "", quantity: "1" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [sellTarget, setSellTarget] = useState<Gadget | null>(null);
  const [sellPrice, setSellPrice] = useState("");
  const [sellQty, setSellQty] = useState("1");
  const [sellSaving, setSellSaving] = useState(false);
  const [sellError, setSellError] = useState("");

  // Which gadgets make up each number — a separate detail sheet for each
  // of the three summary tiles (profit/buy/sell). The `gadgets` state
  // already holds everything, so no extra fetch is needed here.
  const [detailKind, setDetailKind] = useState<"profit" | "buy" | "sell" | null>(null);

  function todayLabel() {
    return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  function downloadGadgetReport(kind: "profit" | "buy" | "sell") {
    const previewWin = window.open("", "_blank");
    if (kind === "profit") {
      const sold = gadgets.filter((g) => Number(g.sold_count || 0) > 0);
      generateReportPDF(
        {
          shopName: "iPhone Store",
          title: "Gadgets Profit Report",
          subtitle: `As of ${todayLabel()}`,
          summary: [{ label: "Total Profit", value: `Tk ${totalProfit.toLocaleString()}`, tone: totalProfit >= 0 ? "up" : "down" }],
          table: {
            head: ["Item", "Sold Qty", "Total Sell (Tk)", "Profit (Tk)"],
            rows: sold.map((g) => [g.buy_name, Number(g.sold_count || 0), Number(g.total_sell || 0).toLocaleString(), Number(g.total_profit || 0).toLocaleString()]),
            emptyLabel: "No gadgets sold yet",
          },
          footerNote: "Generated from iPhone Store — Gadgets & Accessories",
        },
        previewWin
      );
    } else if (kind === "buy") {
      generateReportPDF(
        {
          shopName: "iPhone Store",
          title: "Gadgets Buy Report",
          subtitle: `As of ${todayLabel()}`,
          summary: [{ label: "Total Buy Value", value: `Tk ${totalBuy.toLocaleString()}`, tone: "down" }],
          table: {
            head: ["Item", "Quantity", "Buy Price / Unit (Tk)", "Total (Tk)"],
            rows: gadgets.map((g) => [
              g.buy_name,
              g.quantity,
              Number(g.buy_price).toLocaleString(),
              (Number(g.buy_price) * Number(g.quantity)).toLocaleString(),
            ]),
            emptyLabel: "No gadgets bought yet",
          },
          footerNote: "Generated from iPhone Store — Gadgets & Accessories",
        },
        previewWin
      );
    } else {
      const sold = gadgets.filter((g) => Number(g.total_sell || 0) > 0);
      generateReportPDF(
        {
          shopName: "iPhone Store",
          title: "Gadgets Sell Report",
          subtitle: `As of ${todayLabel()}`,
          summary: [{ label: "Total Sell", value: `Tk ${totalSell.toLocaleString()}`, tone: "up" }],
          table: {
            head: ["Item", "Sold Qty", "Total Sell (Tk)"],
            rows: sold.map((g) => [g.buy_name, Number(g.sold_count || 0), Number(g.total_sell || 0).toLocaleString()]),
            emptyLabel: "No gadgets sold yet",
          },
          footerNote: "Generated from iPhone Store — Gadgets & Accessories",
        },
        previewWin
      );
    }
  }

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
      setError(t("gadgets.all_fields_required"));
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
      setError(d.error || t("gadgets.save_failed"));
      return;
    }
    setForm({ buy_name: "", buy_price: "", quantity: "1" });
    setAddOpen(false);
    load();
  }

  async function deleteGadget(id: number) {
    if (!confirm(t("gadgets.delete_confirm"))) return;
    const res = await fetch(`/api/gadgets/${id}`, { method: "DELETE" });
    const d: any = await res.json().catch(() => ({}));
    if (d.pending) {
      window.alert(t("approvals.pending_submitted_message"));
      return;
    }
    load();
  }

  function openSell(g: Gadget) {
    setSellTarget(g);
    setSellPrice("");
    setSellQty("1");
    setSellError("");
  }

  async function confirmSell() {
    if (!sellTarget) return;
    setSellError("");
    const remaining = Number(sellTarget.quantity) - Number(sellTarget.sold_count || 0);
    const qty = Math.floor(Number(sellQty));
    if (!sellPrice || Number(sellPrice) <= 0) {
      setSellError(t("gadgets.invalid_sell_price"));
      return;
    }
    if (!qty || qty < 1) {
      setSellError(t("gadgets.invalid_quantity"));
      return;
    }
    if (qty > remaining) {
      setSellError(t("gadgets.exceeds_stock").replace("{remaining}", String(remaining)));
      return;
    }
    setSellSaving(true);
    const res = await fetch(`/api/gadgets/${sellTarget.id}/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sell_price: Number(sellPrice), quantity: qty }),
    });
    setSellSaving(false);
    if (!res.ok) {
      const d: any = await res.json().catch(() => ({}));
      setSellError(d.error || t("gadgets.save_failed"));
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
      <button
        type="button"
        onClick={() => setDetailKind("profit")}
        className="mb-4 phone-card w-full text-left transition active:scale-[0.99]"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-muted">{t("gadgets.hero_label")}</p>
          <ChevronRight size={16} className="text-ink-faint" />
        </div>
        <p
          className={`tabular font-display text-3xl font-extrabold mt-1 ${
            totalProfit >= 0 ? "text-up" : "text-down"
          }`}
        >
          ৳{money(totalProfit)}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2.5 text-sm">
          <div
            onClick={(e) => {
              e.stopPropagation();
              setDetailKind("buy");
            }}
            className="rounded-xl bg-surface-2 p-2.5 text-left"
          >
            <p className="text-[11px] text-ink-muted">{t("gadgets.total_buy")}</p>
            <p className="tabular font-semibold">৳{money(totalBuy)}</p>
          </div>
          <div
            onClick={(e) => {
              e.stopPropagation();
              setDetailKind("sell");
            }}
            className="rounded-xl bg-surface-2 p-2.5 text-left"
          >
            <p className="text-[11px] text-ink-muted">{t("gadgets.total_sell")}</p>
            <p className="tabular font-semibold">৳{money(totalSell)}</p>
          </div>
        </div>
      </button>

      {loading ? (
        <p className="text-center text-sm text-ink-muted py-10">{t("gadgets.loading")}</p>
      ) : gadgets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-ink-muted">
          {t("gadgets.no_entries")}
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
                      {t("gadgets.stock_status")
                        .replace("{remaining}", String(remaining))
                        .replace("{quantity}", String(g.quantity))}
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
        className="no-print fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-white shadow-lg shadow-gold/20 active:scale-95"
        aria-label={t("gadgets.add_new_aria")}
      >
        <Plus size={26} />
      </button>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Gadgets & Accessories">
        <div className="space-y-3">
          <Field label="Buy Name">
            <input
              value={form.buy_name}
              onChange={(e) => setForm({ ...form, buy_name: e.target.value })}
              placeholder={t("gadgets.buy_name_placeholder")}
              className={inputClass}
            />
          </Field>
          <Field label={t("gadgets.buy_price_label")}>
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
            {saving ? t("gadgets.saving") : t("gadgets.add_button")}
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
              {t("gadgets.sell_info")
                .replace("{price}", money(sellTarget.buy_price))
                .replace(
                  "{remaining}",
                  String(Number(sellTarget.quantity) - Number(sellTarget.sold_count || 0))
                )}
            </p>
            <Field label={t("gadgets.sell_price_label")}>
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
            <Field label={t("gadgets.sell_qty_label")}>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={Number(sellTarget.quantity) - Number(sellTarget.sold_count || 0)}
                value={sellQty}
                onChange={(e) => setSellQty(e.target.value)}
                placeholder="1"
                className={inputClass}
              />
            </Field>
            {sellPrice && sellQty && Number(sellQty) > 1 && (
              <p className="text-xs text-ink-muted">
                {t("gadgets.sell_total_summary")
                  .replace("{total}", money(Number(sellPrice) * Number(sellQty)))
                  .replace("{qty}", sellQty)
                  .replace("{price}", money(Number(sellPrice)))}
              </p>
            )}
            {sellError && <p className="text-sm text-down">{sellError}</p>}
            <Button full onClick={confirmSell} disabled={sellSaving}>
              {sellSaving ? t("gadgets.saving") : t("gadgets.confirm_sell_button")}
            </Button>
          </div>
        )}
      </Sheet>

      <Sheet
        open={detailKind !== null}
        onClose={() => setDetailKind(null)}
        title={
          detailKind === "profit"
            ? t("gadgets.detail_profit_title")
            : detailKind === "buy"
            ? t("gadgets.detail_buy_title")
            : t("gadgets.detail_sell_title")
        }
      >
        {detailKind === "profit" && (
          <div className="space-y-3">
            {gadgets.filter((g) => Number(g.sold_count || 0) > 0).length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-ink-muted">
                {t("gadgets.no_gadgets_sold")}
              </p>
            ) : (
              <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                {gadgets
                  .filter((g) => Number(g.sold_count || 0) > 0)
                  .map((g) => (
                    <div key={g.id} className="flex items-center justify-between gap-3">
                      <p className="text-sm text-ink-muted truncate">
                        {g.buy_name}{" "}
                        <span className="text-ink-faint">
                          {t("gadgets.sold_count_suffix").replace("{count}", String(g.sold_count))}
                        </span>
                      </p>
                      <p className={`tabular text-sm font-semibold shrink-0 ${Number(g.total_profit) >= 0 ? "text-up" : "text-down"}`}>
                        {Number(g.total_profit) >= 0 ? "+" : ""}৳{money(g.total_profit)}
                      </p>
                    </div>
                  ))}
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">{t("gadgets.total_profit_label")}</p>
              <p className={`tabular font-display text-xl font-extrabold ${totalProfit >= 0 ? "text-up" : "text-down"}`}>
                ৳{money(totalProfit)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadGadgetReport("profit")}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold text-teal"
            >
              <Download size={13} /> {t("gadgets.download_pdf")}
            </button>
          </div>
        )}

        {detailKind === "buy" && (
          <div className="space-y-3">
            {gadgets.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-ink-muted">
                {t("gadgets.no_gadgets_bought")}
              </p>
            ) : (
              <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                {gadgets.map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-3">
                    <p className="text-sm text-ink-muted truncate">
                      {g.buy_name}{" "}
                      <span className="text-ink-faint">
                        {t("gadgets.qty_times_price_suffix")
                          .replace("{qty}", String(g.quantity))
                          .replace("{price}", money(g.buy_price))}
                      </span>
                    </p>
                    <p className="tabular text-sm font-semibold shrink-0 text-down">
                      −৳{money(Number(g.buy_price) * Number(g.quantity))}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">{t("gadgets.total_buy_label")}</p>
              <p className="tabular font-display text-xl font-extrabold text-down">৳{money(totalBuy)}</p>
            </div>
            <button
              type="button"
              onClick={() => downloadGadgetReport("buy")}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold text-teal"
            >
              <Download size={13} /> {t("gadgets.download_pdf")}
            </button>
          </div>
        )}

        {detailKind === "sell" && (
          <div className="space-y-3">
            {gadgets.filter((g) => Number(g.total_sell || 0) > 0).length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-ink-muted">
                {t("gadgets.no_gadgets_sold")}
              </p>
            ) : (
              <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
                {gadgets
                  .filter((g) => Number(g.total_sell || 0) > 0)
                  .map((g) => (
                    <div key={g.id} className="flex items-center justify-between gap-3">
                      <p className="text-sm text-ink-muted truncate">
                        {g.buy_name}{" "}
                        <span className="text-ink-faint">
                          {t("gadgets.sold_count_suffix").replace("{count}", String(g.sold_count))}
                        </span>
                      </p>
                      <p className="tabular text-sm font-semibold shrink-0 text-up">+৳{money(g.total_sell)}</p>
                    </div>
                  ))}
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">{t("gadgets.total_sell_label")}</p>
              <p className="tabular font-display text-xl font-extrabold text-up">৳{money(totalSell)}</p>
            </div>
            <button
              type="button"
              onClick={() => downloadGadgetReport("sell")}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold text-teal"
            >
              <Download size={13} /> {t("gadgets.download_pdf")}
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
