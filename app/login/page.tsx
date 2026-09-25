"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Smartphone } from "lucide-react";
import { Button, Field, inputClass } from "../components/ui";
import { useLang } from "@/lib/i18n";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useLang();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username || !password) {
      setError(t("login.validation"));
      return;
    }
    setSaving(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setSaving(false);
    if (!res.ok) {
      const d: any = await res.json().catch(() => ({}));
      setError(d.error || t("login.failed"));
      return;
    }
    const next = params.get("next") || "/";
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-bg-elevated p-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/15 text-gold">
            <Smartphone size={22} />
          </div>
          <h1 className="font-display text-xl font-bold">Apple Store Satkhira</h1>
          <p className="mt-1 text-xs text-ink-faint">{t("login.heading")}</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label={t("login.username_label")}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className={inputClass}
            />
          </Field>
          <Field label={t("login.password_label")}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={inputClass}
            />
          </Field>
          {error && <p className="text-sm text-down">{error}</p>}
          <Button type="submit" full disabled={saving} className="mt-1">
            <Lock size={16} />
            {saving ? t("login.checking") : t("login.button")}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
