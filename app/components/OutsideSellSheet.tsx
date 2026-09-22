"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";
import { Button, Field, inputClass, Sheet } from "./ui";
import BarcodeScanner from "./BarcodeScanner";
import { emitDashboardRefresh } from "@/lib/events";
import { useLang } from "@/lib/i18n";

// Used Phone (formerly "Outside Sell") is a standalone profit log — no
// invoice, no stock lookup. Just record what was sold (Model, IMEI) and
// the profit made on it; that profit adds straight into the total/net
// profit and cash.
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
  const { t } = useLang();
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
      setError(t("used_phone.validation_required"));
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
      setError(d.error || t("common.save_could_not"));
      return;
    }
    emitDashboardRefresh();
    setDone(true);
  }

  return (
    <>
      <Sheet open={open} onClose={handleClose} title={t("used_phone.title")}>
        {done ? (
          <div className="py-6 text-center">
            <p className="mb-4 text-lg font-semibold text-up">{t("used_phone.saved_success")}</p>
            <Button full onClick={reset}>
              {t("used_phone.add_another")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label={t("used_phone.model_label")}>
              <input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder={t("used_phone.model_placeholder")}
                className={inputClass}
              />
            </Field>
            <Field label={t("used_phone.imei_label")}>
              <div className="flex gap-2">
                <input
                  value={form.imei}
                  onChange={(e) => setForm({ ...form, imei: e.target.value })}
                  placeholder={t("used_phone.imei_placeholder")}
                  className={inputClass}
                />
                <button
                  onClick={() => setScanOpen(true)}
                  className="flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 px-3 text-teal"
                  aria-label={t("used_phone.imei_scan_aria")}
                >
                  <ScanLine size={18} />
                </button>
              </div>
            </Field>
            <Field label={t("used_phone.profit_label")}>
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
              {saving ? t("used_phone.saving") : t("used_phone.save_button")}
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
