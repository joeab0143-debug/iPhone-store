"use client";

import { useEffect, useState } from "react";
import { Check, X as XIcon } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Button, formatDate } from "./ui";
import { emitDashboardRefresh, emitApprovalsRefresh, APPROVALS_REFRESH_EVENT } from "@/lib/events";

interface ApprovalRow {
  id: number;
  action_type: "edit" | "delete" | "buy";
  resource_type: string;
  resource_id: number | null;
  resource_label: string;
  requested_by: string;
  requested_at: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
}

// Shared by two roles, rendered differently for each (see role checks
// below): the admin sees every Edit/Delete/Buy a POS Manager submitted
// (see lib/approvals.ts) with Approve/Reject controls -- approving runs the
// actual change (through the same code the admin's own requests use, via
// lib/approvalActions.ts), rejecting just discards the request, nothing
// about the original record changes either way. A POS Manager sees this
// same list scoped to their own requests, read-only, so they always know
// what's still waiting on the admin. Polls every 5s and also listens for
// APPROVALS_REFRESH_EVENT so it updates without a page refresh.
export default function ApprovalsTab({
  role,
}: {
  role: "admin" | "pos_manager" | "";
}) {
  const { t } = useLang();
  const [view, setView] = useState<"pending" | "history">("pending");
  const [items, setItems] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  function load(opts?: { silent?: boolean }) {
    if (!opts?.silent) setLoading(true);
    const qs = view === "pending" ? "status=pending" : "status=all";
    fetch(`/api/pending-approvals?${qs}`)
      .then((r) => r.json())
      .then((d: any) => setItems(Array.isArray(d.approvals) ? d.approvals : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    function handleExternalRefresh() {
      load({ silent: true });
    }
    window.addEventListener(APPROVALS_REFRESH_EVENT, handleExternalRefresh);
    const interval = setInterval(() => load({ silent: true }), 5000);
    return () => {
      window.removeEventListener(APPROVALS_REFRESH_EVENT, handleExternalRefresh);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function actionLabel(action: string) {
    if (action === "edit") return t("approvals.action_edit");
    if (action === "delete") return t("approvals.action_delete");
    if (action === "buy") return t("approvals.action_buy");
    return action;
  }

  function resourceLabel(resource: string) {
    const key = `approvals.resource_${resource}`;
    const val = t(key);
    return val === key ? resource : val;
  }

  async function approve(id: number) {
    if (!window.confirm(t("approvals.approve_confirm"))) return;
    setBusyId(id);
    setError("");
    const res = await fetch(`/api/pending-approvals/${id}/approve`, { method: "POST" });
    setBusyId(null);
    if (!res.ok) {
      const d: any = await res.json().catch(() => ({}));
      setError(d.error || t("approvals.approve_failed"));
      return;
    }
    emitDashboardRefresh();
    emitApprovalsRefresh();
    load();
  }

  async function reject(id: number) {
    if (!window.confirm(t("approvals.reject_confirm"))) return;
    setBusyId(id);
    setError("");
    const res = await fetch(`/api/pending-approvals/${id}/reject`, { method: "POST" });
    setBusyId(null);
    if (!res.ok) {
      const d: any = await res.json().catch(() => ({}));
      setError(d.error || t("approvals.reject_failed"));
      return;
    }
    emitApprovalsRefresh();
    load();
  }

  return (
    <div className="pb-24">
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold">
          {role === "admin" ? t("approvals.title") : t("approvals.my_title")}
        </h2>
        <p className="text-xs text-ink-muted">
          {role === "admin" ? t("approvals.subtitle") : t("approvals.my_subtitle")}
        </p>
      </div>

      <div className="mb-4 flex w-fit items-center gap-1.5 rounded-xl bg-surface-2 p-1">
        <button
          onClick={() => setView("pending")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            view === "pending" ? "bg-surface text-ink shadow-sm" : "text-ink-muted"
          }`}
        >
          {t("approvals.pending_tab")}
        </button>
        <button
          onClick={() => setView("history")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            view === "history" ? "bg-surface text-ink shadow-sm" : "text-ink-muted"
          }`}
        >
          {t("approvals.history_tab")}
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-down">{error}</p>}

      {loading ? (
        <p className="text-sm text-ink-muted">{t("approvals.loading")}</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-ink-muted">
          {t("approvals.empty")}
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-muted">
                  {actionLabel(item.action_type)}
                </span>
                <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-muted">
                  {resourceLabel(item.resource_type)}
                </span>
                {item.status !== "pending" && (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                      item.status === "approved" ? "bg-up/15 text-up" : "bg-down/15 text-down"
                    }`}
                  >
                    {item.status === "approved"
                      ? t("approvals.status_approved")
                      : t("approvals.status_rejected")}
                  </span>
                )}
              </div>
              <p className="mb-1 font-semibold text-ink">{item.resource_label}</p>
              <p className="text-xs text-ink-faint">
                {t("approvals.requested_by_prefix")}
                {item.requested_by} — {formatDate(item.requested_at)}
              </p>
              {item.status !== "pending" && item.reviewed_by && (
                <p className="text-xs text-ink-faint">
                  {t("approvals.reviewed_by_prefix")}
                  {item.reviewed_by} — {formatDate(item.reviewed_at || undefined)}
                </p>
              )}
              {item.status === "pending" && role === "admin" && (
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="primary"
                    className="!px-3 !py-1.5 !text-xs"
                    disabled={busyId === item.id}
                    onClick={() => approve(item.id)}
                  >
                    <Check size={14} /> {t("approvals.approve_button")}
                  </Button>
                  <Button
                    variant="danger"
                    className="!px-3 !py-1.5 !text-xs"
                    disabled={busyId === item.id}
                    onClick={() => reject(item.id)}
                  >
                    <XIcon size={14} /> {t("approvals.reject_button")}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
