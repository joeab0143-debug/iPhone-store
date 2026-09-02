"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Wallet } from "lucide-react";
import { Button, Field, Sheet, inputClass, money } from "./ui";
import { emitDashboardRefresh } from "@/lib/events";

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
      setCashError("সঠিক টাকার পরিমাণ দিন");
      return;
    }
    const target = Number(newCash);
    if (
      !window.confirm(
        `টোটাল ক্যাশ ৳${money(currentCash ?? 0)} থেকে ৳${money(target)} করবেন? স্টক/সেলের কোনো তথ্য বদলাবে না।`
      )
    ) {
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
      setCashError(d.error || "সেভ করা যায়নি");
      return;
    }
    setCurrentCash(d.total_cash);
    setNewCash("");
    setCashSuccess("টোটাল ক্যাশ আপডেট হয়েছে ✓");
    emitDashboardRefresh();
  }

  async function submit() {
    setError("");
    setSuccess("");
    if (!currentPassword) {
      setError("বর্তমান পাসওয়ার্ড দিন");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError("নতুন পাসওয়ার্ড দুই ঘরে মিলছে না");
      return;
    }
    if (!newUsername && !newPassword) {
      setError("নতুন ইউজার আইডি বা পাসওয়ার্ড অন্তত একটি দিন");
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
      setError(d.error || "সেভ করা যায়নি");
      return;
    }
    setSuccess("সেভ হয়েছে ✓");
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
    <Sheet open={open} onClose={handleClose} title="সেটিংস">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface-2 px-3.5 py-2.5">
          <p className="text-xs text-ink-faint">বর্তমান ইউজার আইডি</p>
          <p className="font-medium">{username}</p>
        </div>

        <div className="space-y-3 border-t border-border-soft pt-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Wallet size={15} /> টোটাল ক্যাশ ঠিক করুন
          </p>
          <div className="rounded-xl border border-border bg-surface-2 px-3.5 py-2.5">
            <p className="text-xs text-ink-faint">বর্তমান টোটাল ক্যাশ</p>
            <p className="tabular font-medium">
              ৳{currentCash !== null ? money(currentCash) : "..."}
            </p>
          </div>
          <Field label="নতুন টোটাল ক্যাশ (৳)">
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
            {cashSaving ? "সেভ হচ্ছে..." : "ক্যাশ ঠিক করুন"}
          </Button>
          <p className="text-xs text-ink-faint">
            এটা শুধু টোটাল ক্যাশের হিসাব ঠিক করে — স্টক, সেল, খরচ বা অন্য কোনো তথ্য বদলায় না।
          </p>
        </div>

        <div className="space-y-3 border-t border-border-soft pt-4">
          <p className="text-sm font-semibold">ইউজার আইডি / পাসওয়ার্ড পরিবর্তন</p>
          <Field label="বর্তমান পাসওয়ার্ড">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className={inputClass}
            />
          </Field>
          <Field label="নতুন ইউজার আইডি (ঐচ্ছিক)">
            <input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder={username}
              autoComplete="username"
              className={inputClass}
            />
          </Field>
          <Field label="নতুন পাসওয়ার্ড (ঐচ্ছিক, কমপক্ষে ৬ অক্ষর)">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>
          {newPassword && (
            <Field label="নতুন পাসওয়ার্ড আবার লিখুন">
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
            {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
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
            {loggingOut ? "লগআউট হচ্ছে..." : "লগআউট"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
