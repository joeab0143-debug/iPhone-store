"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Wallet } from "lucide-react";
import { Button, Field, Sheet, inputClass, money } from "./ui";
import { emitDashboardRefresh } from "@/lib/events";
import { useLang } from "@/lib/i18n";

export default function SettingsSheet({
  open,
  onClose,
  username,
}: {
  open: boolean;
  onClose: () => void;
  username: string;
}) {
  const router = useRouter();
  const { t } = useLang();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const [currentCash, setCurrentCash] = useState<number | null>(null);
  const [newCash, setNewCash] = useState("");
  const [cashSaving, setCashSaving] = useState(false);
  const [cashError, setCashError] = useState("");
  const [cashSuccess, setCashSuccess] = useState("");

  // Fetch the live Total Cash every time the sheet opens, so it's never
  // showing a stale number by the time someone goes to correct it.
  useEffect(() => {
    if (!open) return;
    fetch("/api/cash-adjustment")
      .then((r) => r.json())
      .then((d: any) => setCurrentCash(typeof d.current_total_cash === "number" ? d.current_total_cash : null))
      .catch(() => {});
  }, [open]);

  function reset() {
    setCurrentPassword("");
    setNewUsername("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
    setNewCash("");
    setCashError("");
    setCashSuccess("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function submitCashFix() {
    setCashError("");
    setCashSuccess("");
    if (newCash === "" || Number.isNaN(Number(newCash))) {
      setCashError(t("settings.cash_invalid"));
      return;
    }
    const target = Number(newCash);
    const confirmMsg = t("settings.cash_confirm")
      .replace("{from}", money(currentCash ?? 0))
      .replace("{to}", money(target));
    if (!window.confirm(confirmMsg)) {
      return;
    }
    setCashSaving(true);
    const res = await fetch("/api/cash-adjustment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_total_cash: target }),
    });
    setCashSaving(false);
    const d: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCashError(d.error || t("common.save_could_not"));
      return;
    }
    setCurrentCash(d.total_cash);
    setNewCash("");
    setCashSuccess(t("settings.cash_updated"));
    emitDashboardRefresh();
  }

  async function submit() {
    setError("");
    setSuccess("");
    if (!currentPassword) {
      setError(t("settings.enter_current_password"));
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError(t("settings.password_mismatch"));
      return;
    }
    if (!newUsername && !newPassword) {
      setError(t("settings.need_username_or_password"));
      return;
    }
    setSaving(true);
    const res = await fetch("/api/auth/credentials", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: currentPassword,
        new_username: newUsername || undefined,
        new_password: newPassword || undefined,
      }),
    });
    setSaving(false);
    const d: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error || t("common.save_could_not"));
      return;
    }
    setSuccess(t("settings.saved_success"));
    setCurrentPassword("");
    setNewUsername("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <Sheet open={open} onClose={handleClose} title={t("settings.title")}>
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface-2 px-3.5 py-2.5">
          <p className="text-xs text-ink-faint">{t("settings.current_username_label")}</p>
          <p className="font-medium">{username}</p>
        </div>

        <div className="space-y-3 border-t border-border-soft pt-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Wallet size={15} /> {t("settings.fix_cash_heading")}
          </p>
          <div className="rounded-xl border border-border bg-surface-2 px-3.5 py-2.5">
            <p className="text-xs text-ink-faint">{t("settings.current_total_cash")}</p>
            <p className="tabular font-medium">
              ৳{currentCash !== null ? money(currentCash) : "..."}
            </p>
          </div>
          <Field label={t("settings.new_total_cash_label")}>
            <input
              type="number"
              inputMode="decimal"
              value={newCash}
              onChange={(e) => setNewCash(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </Field>
          {cashError && <p className="text-sm text-down">{cashError}</p>}
          {cashSuccess && <p className="text-sm text-up">{cashSuccess}</p>}
          <Button full variant="secondary" onClick={submitCashFix} disabled={cashSaving}>
            {cashSaving ? t("settings.cash_saving") : t("settings.cash_fix_button")}
          </Button>
          <p className="text-xs text-ink-faint">{t("settings.cash_note")}</p>
        </div>

        <div className="space-y-3 border-t border-border-soft pt-4">
          <p className="text-sm font-semibold">{t("settings.change_credentials_heading")}</p>
          <Field label={t("settings.current_password_label")}>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className={inputClass}
            />
          </Field>
          <Field label={t("settings.new_username_label")}>
            <input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder={username}
              autoComplete="username"
              className={inputClass}
            />
          </Field>
          <Field label={t("settings.new_password_label")}>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>
          {newPassword && (
            <Field label={t("settings.confirm_password_label")}>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className={inputClass}
              />
            </Field>
          )}
          {error && <p className="text-sm text-down">{error}</p>}
          {success && <p className="text-sm text-up">{success}</p>}
          <Button full onClick={submit} disabled={saving}>
            {saving ? t("settings.saving") : t("settings.save_button")}
          </Button>
        </div>

        <div className="border-t border-border-soft pt-4">
          <Button
            full
            variant="danger"
            onClick={logout}
            disabled={loggingOut}
          >
            <LogOut size={16} />
            {loggingOut ? t("settings.logging_out") : t("settings.logout_button")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
