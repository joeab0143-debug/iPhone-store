"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button, Field, Sheet, inputClass } from "./ui";

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

  function reset() {
    setCurrentPassword("");
    setNewUsername("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
  }

  function handleClose() {
    reset();
    onClose();
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

        <div className="space-y-3">
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
