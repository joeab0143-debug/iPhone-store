"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Wallet, UserCog, Store, DatabaseBackup, Download, Plus, Trash2 } from "lucide-react";
import { Button, Field, Sheet, inputClass, money, formatDate } from "./ui";
import { emitDashboardRefresh } from "@/lib/events";
import { useLang } from "@/lib/i18n";

export default function SettingsSheet({
  open,
  onClose,
  username,
  role,
}: {
  open: boolean;
  onClose: () => void;
  username: string;
  role?: "admin" | "pos_manager" | "";
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

  // POS Manager account (admin-only section) — whoever the shop owner
  // hands day-to-day POS access to, with Edit/Delete/Buy gated behind the
  // admin's approval (see the Approvals tab).
  const [posManagerUsername, setPosManagerUsername] = useState<string | null>(null);
  const [posFormUsername, setPosFormUsername] = useState("");
  const [posFormPassword, setPosFormPassword] = useState("");
  const [posSaving, setPosSaving] = useState(false);
  const [posError, setPosError] = useState("");
  const [posSuccess, setPosSuccess] = useState("");

  // Shop / Invoice Info (admin-only) -- feeds the printed Sales Invoice
  // memo (see lib/sales-invoice.ts). Editable here so the shop's own
  // details don't have to be hardcoded in the app.
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [shopEmail, setShopEmail] = useState("");
  // Free-form warning/notice lines printed on the memo below the PAID
  // stamp (e.g. return/warranty policy) -- admin adds/removes lines here.
  const [shopNoticeLines, setShopNoticeLines] = useState<string[]>([]);
  const [shopSaving, setShopSaving] = useState(false);
  const [shopError, setShopError] = useState("");
  const [shopSuccess, setShopSuccess] = useState("");

  // Data Backup (admin-only) -- the manual "download everything right now"
  // button needs no setup at all; the "Weekly Automatic Backups" list below
  // it only has anything to show once an R2 bucket + secret + outside cron
  // are set up (see app/api/backup/*), so `autoBackupsConfigured` drives
  // whether that section shows the list or setup guidance.
  const [backupDownloading, setBackupDownloading] = useState(false);
  const [backupError, setBackupError] = useState("");
  const [autoBackups, setAutoBackups] = useState<{ key: string; size: number; uploaded: string }[]>([]);
  const [autoBackupsConfigured, setAutoBackupsConfigured] = useState(true);
  const [backupListLoading, setBackupListLoading] = useState(false);

  const isAdmin = role === "admin";

  // Fetch the live Total Cash every time the sheet opens, so it's never
  // showing a stale number by the time someone goes to correct it.
  useEffect(() => {
    if (!open || !isAdmin) return;
    fetch("/api/cash-adjustment")
      .then((r) => r.json())
      .then((d: any) => setCurrentCash(typeof d.current_total_cash === "number" ? d.current_total_cash : null))
      .catch(() => {});
  }, [open, isAdmin]);

  useEffect(() => {
    if (!open || !isAdmin) return;
    fetch("/api/pos-manager")
      .then((r) => r.json())
      .then((d: any) => setPosManagerUsername(d.exists ? d.username : null))
      .catch(() => {});
  }, [open, isAdmin]);

  useEffect(() => {
    if (!open || !isAdmin) return;
    fetch("/api/shop-info")
      .then((r) => r.json())
      .then((d: any) => {
        setShopName(d.shop_name || "");
        setShopAddress(d.address || "");
        setShopPhone(d.phone || "");
        setShopEmail(d.email || "");
        setShopNoticeLines(Array.isArray(d.notice_lines) ? d.notice_lines : []);
      })
      .catch(() => {});
  }, [open, isAdmin]);

  useEffect(() => {
    if (!open || !isAdmin) return;
    setBackupListLoading(true);
    fetch("/api/backup/list")
      .then((r) => r.json())
      .then((d: any) => {
        setAutoBackups(d.backups || []);
        setAutoBackupsConfigured(d.configured !== false);
      })
      .catch(() => {})
      .finally(() => setBackupListLoading(false));
  }, [open, isAdmin]);

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
    setPosFormUsername("");
    setPosFormPassword("");
    setPosError("");
    setPosSuccess("");
    setShopError("");
    setShopSuccess("");
    setBackupError("");
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

  async function saveposManager() {
    setPosError("");
    setPosSuccess("");
    if (!posFormUsername.trim() || !posFormPassword) {
      setPosError(t("settings.pos_manager_username_password_required"));
      return;
    }
    setPosSaving(true);
    const res = await fetch("/api/pos-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: posFormUsername.trim(), password: posFormPassword }),
    });
    setPosSaving(false);
    const d: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPosError(d.error || t("common.save_could_not"));
      return;
    }
    setPosManagerUsername(d.username);
    setPosFormUsername("");
    setPosFormPassword("");
    setPosSuccess(t("settings.pos_manager_saved"));
  }

  async function removePosManager() {
    if (!window.confirm(t("settings.pos_manager_remove_confirm"))) return;
    setPosSaving(true);
    setPosError("");
    setPosSuccess("");
    const res = await fetch("/api/pos-manager", { method: "DELETE" });
    setPosSaving(false);
    if (!res.ok) {
      setPosError(t("common.save_could_not"));
      return;
    }
    setPosManagerUsername(null);
    setPosSuccess(t("settings.pos_manager_removed"));
  }

  async function saveShopInfo() {
    setShopError("");
    setShopSuccess("");
    setShopSaving(true);
    const res = await fetch("/api/shop-info", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_name: shopName.trim(),
        address: shopAddress.trim() || null,
        phone: shopPhone.trim() || null,
        email: shopEmail.trim() || null,
        notice_lines: shopNoticeLines.map((l) => l.trim()).filter(Boolean),
      }),
    });
    setShopSaving(false);
    const d: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      setShopError(d.error || t("common.save_could_not"));
      return;
    }
    setShopName(d.shop_name || "");
    setShopAddress(d.address || "");
    setShopPhone(d.phone || "");
    setShopEmail(d.email || "");
    setShopNoticeLines(Array.isArray(d.notice_lines) ? d.notice_lines : []);
    setShopSuccess(t("settings.shop_info_saved"));
  }

  function addNoticeLine() {
    setShopNoticeLines((prev) => [...prev, ""]);
  }

  function updateNoticeLine(index: number, value: string) {
    setShopNoticeLines((prev) => prev.map((l, i) => (i === index ? value : l)));
  }

  function removeNoticeLine(index: number) {
    setShopNoticeLines((prev) => prev.filter((_, i) => i !== index));
  }

  // Grabs a fresh export of the shop's data right now and hands it to the
  // browser as a file download -- no storage involved, works immediately
  // regardless of whether the weekly automatic backup (R2) is set up.
  async function downloadFullBackupNow() {
    setBackupError("");
    setBackupDownloading(true);
    try {
      const res = await fetch("/api/backup/full");
      if (!res.ok) {
        const d: any = await res.json().catch(() => ({}));
        throw new Error(d.error || "failed");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : "iphone-store-backup.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setBackupError(t("settings.backup_failed"));
    }
    setBackupDownloading(false);
  }

  function downloadAutoBackup(key: string) {
    window.open(`/api/backup/download?key=${encodeURIComponent(key)}`, "_blank");
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
    <>
      <Sheet open={open} onClose={handleClose} title={t("settings.title")}>
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface-2 px-3.5 py-2.5">
          <p className="text-xs text-ink-faint">{t("settings.current_username_label")}</p>
          <p className="font-medium">{username}</p>
        </div>

        {isAdmin && (
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
        )}

        {isAdmin && (
          <div className="space-y-3 border-t border-border-soft pt-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <UserCog size={15} /> {t("settings.pos_manager_heading")}
            </p>
            <p className="text-xs text-ink-faint">{t("settings.pos_manager_description")}</p>
            <div className="rounded-xl border border-border bg-surface-2 px-3.5 py-2.5">
              <p className="text-xs text-ink-faint">
                {posManagerUsername
                  ? t("settings.pos_manager_exists_label")
                  : t("settings.pos_manager_none")}
              </p>
              {posManagerUsername && <p className="font-medium">{posManagerUsername}</p>}
            </div>
            <Field label={t("settings.pos_manager_username_label")}>
              <input
                value={posFormUsername}
                onChange={(e) => setPosFormUsername(e.target.value)}
                placeholder={posManagerUsername || ""}
                autoComplete="off"
                className={inputClass}
              />
            </Field>
            <Field label={t("settings.pos_manager_password_label")}>
              <input
                type="password"
                value={posFormPassword}
                onChange={(e) => setPosFormPassword(e.target.value)}
                autoComplete="new-password"
                className={inputClass}
              />
            </Field>
            {posError && <p className="text-sm text-down">{posError}</p>}
            {posSuccess && <p className="text-sm text-up">{posSuccess}</p>}
            <Button full variant="secondary" onClick={saveposManager} disabled={posSaving}>
              {t("settings.pos_manager_save_button")}
            </Button>
            {posManagerUsername && (
              <Button full variant="danger" onClick={removePosManager} disabled={posSaving}>
                {t("settings.pos_manager_remove_button")}
              </Button>
            )}
          </div>
        )}

        {isAdmin && (
          <div className="space-y-3 border-t border-border-soft pt-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Store size={15} /> {t("settings.shop_info_heading")}
            </p>
            <p className="text-xs text-ink-faint">{t("settings.shop_info_description")}</p>
            <Field label={t("settings.shop_name_label")}>
              <input
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t("settings.shop_address_label")}>
              <input
                value={shopAddress}
                onChange={(e) => setShopAddress(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t("settings.shop_phone_label")}>
              <input
                value={shopPhone}
                onChange={(e) => setShopPhone(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t("settings.shop_email_label")}>
              <input
                type="email"
                value={shopEmail}
                onChange={(e) => setShopEmail(e.target.value)}
                className={inputClass}
              />
            </Field>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-ink-muted">
                {t("settings.shop_notice_lines_label")}
              </span>
              <p className="mb-2 text-xs text-ink-faint">{t("settings.shop_notice_lines_description")}</p>
              <div className="space-y-2">
                {shopNoticeLines.map((line, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={line}
                      onChange={(e) => updateNoticeLine(i, e.target.value)}
                      placeholder={t("settings.shop_notice_line_placeholder")}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => removeNoticeLine(i)}
                      className="shrink-0 rounded-full p-1.5 text-ink-faint hover:text-down"
                      aria-label={t("settings.shop_notice_line_remove")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addNoticeLine}
                  className="flex items-center gap-1 text-xs font-semibold text-teal"
                >
                  <Plus size={13} /> {t("settings.shop_notice_line_add")}
                </button>
              </div>
            </div>
            {shopError && <p className="text-sm text-down">{shopError}</p>}
            {shopSuccess && <p className="text-sm text-up">{shopSuccess}</p>}
            <Button full variant="secondary" onClick={saveShopInfo} disabled={shopSaving}>
              {t("settings.shop_info_save_button")}
            </Button>
          </div>
        )}

        {isAdmin && (
          <div className="space-y-3 border-t border-border-soft pt-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <DatabaseBackup size={15} /> {t("settings.backup_heading")}
            </p>
            <p className="text-xs text-ink-faint">{t("settings.backup_description")}</p>
            {backupError && <p className="text-sm text-down">{backupError}</p>}
            <Button full variant="secondary" onClick={downloadFullBackupNow} disabled={backupDownloading}>
              <Download size={16} />
              {backupDownloading ? t("settings.backup_downloading") : t("settings.backup_download_now")}
            </Button>

            <div className="rounded-xl border border-border bg-surface-2 px-3.5 py-2.5">
              <p className="text-xs text-ink-faint">{t("settings.backup_auto_heading")}</p>
              {!autoBackupsConfigured ? (
                <p className="mt-1.5 text-xs text-ink-faint">{t("settings.backup_auto_not_configured")}</p>
              ) : backupListLoading ? (
                <p className="mt-1.5 text-xs text-ink-faint">{t("settings.loading")}</p>
              ) : autoBackups.length === 0 ? (
                <p className="mt-1.5 text-xs text-ink-faint">{t("settings.backup_auto_none")}</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {autoBackups.map((b) => (
                    <li key={b.key} className="flex items-center justify-between gap-2">
                      <span className="text-xs tabular text-ink-muted">
                        {formatDate(b.uploaded)} · {(b.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        onClick={() => downloadAutoBackup(b.key)}
                        className="shrink-0 text-xs font-semibold text-teal"
                      >
                        {t("settings.backup_download_button")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

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

      {/* Floating WhatsApp contact button -- bottom-right of the Settings
          page only. Opens a WhatsApp chat to the shop's support number. */}
      {open && (
        <a
          href="https://wa.me/8801708115797"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("settings.whatsapp_label")}
          title={t("settings.whatsapp_label")}
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:brightness-110 active:scale-95"
        >
          <svg viewBox="0 0 32 32" width="28" height="28" fill="currentColor" aria-hidden="true">
            <path d="M16.004 2.667c-7.363 0-13.333 5.97-13.333 13.333 0 2.352.617 4.56 1.696 6.475L2.667 29.333l7.03-1.844a13.27 13.27 0 0 0 6.307 1.607h.006c7.363 0 13.333-5.97 13.333-13.333S23.367 2.667 16.004 2.667Zm0 24.395a11.04 11.04 0 0 1-5.63-1.54l-.404-.24-4.172 1.094 1.114-4.067-.263-.418a11.02 11.02 0 0 1-1.696-5.891c0-6.106 4.97-11.076 11.077-11.076 2.958 0 5.739 1.153 7.832 3.247a11 11 0 0 1 3.244 7.833c0 6.106-4.97 11.058-11.102 11.058Zm6.07-8.284c-.332-.166-1.966-.97-2.271-1.081-.305-.111-.527-.166-.75.166-.221.333-.858 1.081-1.052 1.303-.194.222-.388.25-.72.083-.332-.167-1.402-.517-2.671-1.649-.987-.881-1.654-1.968-1.848-2.3-.194-.333-.02-.513.146-.679.15-.15.332-.389.498-.583.166-.194.221-.333.332-.556.111-.222.055-.417-.028-.583-.083-.166-.75-1.808-1.028-2.475-.271-.65-.546-.563-.75-.573l-.638-.011c-.222 0-.583.083-.888.417-.305.333-1.166 1.14-1.166 2.781s1.194 3.226 1.36 3.448c.166.222 2.35 3.588 5.693 5.032.795.343 1.416.548 1.9.702.798.254 1.524.218 2.098.132.64-.096 1.966-.803 2.244-1.579.277-.777.277-1.442.194-1.58-.083-.138-.305-.221-.638-.388Z" />
          </svg>
        </a>
      )}
    </>
  );
}
