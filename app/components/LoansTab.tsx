"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, HandCoins, HandHeart, Download } from "lucide-react";
import { Button, Field, inputClass, money, formatDate, Sheet, Badge } from "./ui";
import { emitDashboardRefresh } from "@/lib/events";
import { generateReportPDF } from "@/lib/report-pdf";
import { useLang } from "@/lib/i18n";
import type { LoanAccount, LoanEntry } from "@/lib/types";

// Loans — a per-person running ledger (loans taken from people, and loans
// given to people). Adding a loan for a name that already has an account
// (same direction, matched case-insensitively) merges into that account as
// a new entry instead of creating a separate line — tapping a card opens
// its full history (every amount taken/given + every repayment).
//
// Loan cash flow now feeds Total Cash on the dashboard: taking a loan or
// getting repaid adds to it; giving a loan or repaying one subtracts.
export default function LoansTab() {
  const { t } = useLang();
  const [accounts, setAccounts] = useState<LoanAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [direction, setDirection] = useState<"taken" | "given">("taken");
  const [form, setForm] = useState({ person_name: "", amount: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showSettledTaken, setShowSettledTaken] = useState(false);
  const [showSettledGiven, setShowSettledGiven] = useState(false);

  const [detailAccount, setDetailAccount] = useState<LoanAccount | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/loans");
    const data: any = await res.json();
    setAccounts(data.accounts || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd(dir: "taken" | "given") {
    setDirection(dir);
    setForm({ person_name: "", amount: "" });
    setError("");
    setAddOpen(true);
  }

  async function submit() {
    setError("");
    if (!form.person_name || !form.amount || Number(form.amount) <= 0) {
      setError(t("loans.all_fields_required"));
      return;
    }
    setSaving(true);
    const res = await fetch("/api/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        direction,
        person_name: form.person_name,
        amount: Number(form.amount),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d: any = await res.json().catch(() => ({}));
      setError(d.error || t("loans.save_failed"));
      return;
    }
    setAddOpen(false);
    emitDashboardRefresh();
    load();
  }

  async function remove(id: number) {
    if (!confirm(t("loans.delete_confirm"))) return;
    await fetch(`/api/loans/${id}`, { method: "DELETE" });
    setDetailAccount(null);
    emitDashboardRefresh();
    load();
  }

  const taken = useMemo(() => accounts.filter((a) => a.direction === "taken"), [accounts]);
  const given = useMemo(() => accounts.filter((a) => a.direction === "given"), [accounts]);
  const takenPending = taken.filter((a) => Number(a.remaining || 0) > 0);
  const givenPending = given.filter((a) => Number(a.remaining || 0) > 0);
  const takenSettled = taken.filter((a) => Number(a.remaining || 0) <= 0);
  const givenSettled = given.filter((a) => Number(a.remaining || 0) <= 0);

  const totalOwedByMe = takenPending.reduce((s, a) => s + Number(a.remaining || 0), 0);
  const totalOwedToMe = givenPending.reduce((s, a) => s + Number(a.remaining || 0), 0);
  const net = totalOwedToMe - totalOwedByMe;

  const [detailKind, setDetailKind] = useState<"net" | "taken" | "given" | null>(null);

  function todayLabel() {
    return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  function downloadLoanReport(kind: "net" | "taken" | "given") {
    const previewWin = window.open("", "_blank");
    if (kind === "taken") {
      generateReportPDF(
        {
          shopName: "iPhone Store",
          title: "Loans Taken Report",
          subtitle: todayLabel(),
          summary: [{ label: "Total Owed By Me", value: `Tk ${totalOwedByMe.toLocaleString()}`, tone: "down" }],
          table: {
            head: ["Person", "Total Taken (Tk)", "Remaining (Tk)"],
            rows: takenPending.map((a) => [a.person_name, Number(a.disbursed || 0).toLocaleString(), Number(a.remaining || 0).toLocaleString()]),
            emptyLabel: "No pending loans taken",
          },
          footerNote: "Generated from iPhone Store — Loans Tab",
        },
        previewWin
      );
    } else if (kind === "given") {
      generateReportPDF(
        {
          shopName: "iPhone Store",
          title: "Loans Given Report",
          subtitle: todayLabel(),
          summary: [{ label: "Total Owed To Me", value: `Tk ${totalOwedToMe.toLocaleString()}`, tone: "up" }],
          table: {
            head: ["Person", "Total Given (Tk)", "Remaining (Tk)"],
            rows: givenPending.map((a) => [a.person_name, Number(a.disbursed || 0).toLocaleString(), Number(a.remaining || 0).toLocaleString()]),
            emptyLabel: "No pending loans given",
          },
          footerNote: "Generated from iPhone Store — Loans Tab",
        },
        previewWin
      );
    } else {
      generateReportPDF(
        {
          shopName: "iPhone Store",
          title: "Net Loan Position Report",
          subtitle: todayLabel(),
          summary: [
            { label: "Net Position", value: `Tk ${Math.abs(net).toLocaleString()}`, tone: net >= 0 ? "up" : "down" },
            { label: "You Owe (Taken)", value: `Tk ${totalOwedByMe.toLocaleString()}`, tone: "down" },
            { label: "Owed To You (Given)", value: `Tk ${totalOwedToMe.toLocaleString()}`, tone: "up" },
          ],
          table: {
            head: ["Person", "Direction", "Remaining (Tk)"],
            rows: [
              ...takenPending.map((a) => [a.person_name, "Taken", Number(a.remaining || 0).toLocaleString()]),
              ...givenPending.map((a) => [a.person_name, "Given", Number(a.remaining || 0).toLocaleString()]),
            ],
            emptyLabel: "No pending loans",
          },
          footerNote: "Generated from iPhone Store — Loans Tab",
        },
        previewWin
      );
    }
  }

  return (
    <div className="pb-24">
      <button
        type="button"
        onClick={() => setDetailKind("net")}
        className="mb-4 phone-card w-full text-left"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-muted">
            {t("loans.net_position_prefix")} ({net >= 0 ? t("loans.people_owe_you") : t("loans.you_owe_people")})
          </p>
          <ChevronRight size={14} className="text-ink-faint" />
        </div>
        <p
          className={`tabular font-display text-3xl font-extrabold mt-1 ${
            net >= 0 ? "text-up" : "text-down"
          }`}
        >
          ৳{money(Math.abs(net))}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2.5 text-sm">
          <div
            onClick={(e) => {
              e.stopPropagation();
              setDetailKind("taken");
            }}
            className="rounded-xl bg-surface-2 p-2.5 text-left"
          >
            <p className="text-[11px] text-ink-muted">{t("loans.you_owe_pending")}</p>
            <p className="tabular font-semibold text-down">৳{money(totalOwedByMe)}</p>
          </div>
          <div
            onClick={(e) => {
              e.stopPropagation();
              setDetailKind("given");
            }}
            className="rounded-xl bg-surface-2 p-2.5 text-left"
          >
            <p className="text-[11px] text-ink-muted">{t("loans.you_lent_pending")}</p>
            <p className="tabular font-semibold text-up">৳{money(totalOwedToMe)}</p>
          </div>
        </div>
      </button>

      {loading ? (
        <p className="text-center text-sm text-ink-muted py-10">{t("loans.loading")}</p>
      ) : (
        <div className="space-y-5">
          <LoanSection
            title={t("loans.section_taken_title")}
            icon={<HandCoins size={16} />}
            pending={takenPending}
            settled={takenSettled}
            showSettled={showSettledTaken}
            onToggleSettled={() => setShowSettledTaken((v) => !v)}
            onOpen={setDetailAccount}
            onAdd={() => openAdd("taken")}
            emptyText={t("loans.no_loans")}
          />
          <LoanSection
            title={t("loans.section_given_title")}
            icon={<HandHeart size={16} />}
            pending={givenPending}
            settled={givenSettled}
            showSettled={showSettledGiven}
            onToggleSettled={() => setShowSettledGiven((v) => !v)}
            onOpen={setDetailAccount}
            onAdd={() => openAdd("given")}
            emptyText={t("loans.havent_lent")}
          />
        </div>
      )}

      <button
        onClick={() => openAdd(direction)}
        className="no-print fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-white shadow-lg shadow-gold/20 active:scale-95"
        aria-label={t("loans.add_new_aria")}
      >
        <Plus size={26} />
      </button>

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={direction === "taken" ? t("loans.new_entry_title_taken") : t("loans.new_entry_title_given")}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-1.5">
            <button
              onClick={() => setDirection("taken")}
              className={`rounded-lg py-2 text-xs font-semibold transition ${
                direction === "taken" ? "bg-gold text-white" : "text-ink-muted"
              }`}
            >
              {t("loans.taken_label")}
            </button>
            <button
              onClick={() => setDirection("given")}
              className={`rounded-lg py-2 text-xs font-semibold transition ${
                direction === "given" ? "bg-gold text-white" : "text-ink-muted"
              }`}
            >
              {t("loans.given_label")}
            </button>
          </div>
          <Field label={direction === "taken" ? t("loans.from_whom_label") : t("loans.to_whom_label")}>
            <input
              value={form.person_name}
              onChange={(e) => setForm({ ...form, person_name: e.target.value })}
              placeholder={t("loans.name_placeholder")}
              className={inputClass}
            />
          </Field>
          <Field label={t("loans.amount_label")}>
            <input
              type="number"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
              className={inputClass}
            />
          </Field>
          {error && <p className="text-sm text-down">{error}</p>}
          <Button full onClick={submit} disabled={saving}>
            {saving ? t("loans.saving") : t("loans.add_button")}
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={detailKind === "net"}
        onClose={() => setDetailKind(null)}
        title={t("loans.net_detail_title")}
      >
        <div className="space-y-3">
          <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
            {takenPending.length === 0 && givenPending.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-muted">{t("loans.no_pending")}</p>
            ) : (
              <>
                {takenPending.map((a) => (
                  <div key={`taken-${a.id}`} className="flex items-center justify-between gap-3">
                    <p className="text-sm text-ink-muted truncate">
                      {a.person_name} <span className="text-[11px] text-ink-faint">{t("loans.tag_taken")}</span>
                    </p>
                    <p className="tabular text-sm font-semibold shrink-0 text-down">৳{money(a.remaining)}</p>
                  </div>
                ))}
                {givenPending.map((a) => (
                  <div key={`given-${a.id}`} className="flex items-center justify-between gap-3">
                    <p className="text-sm text-ink-muted truncate">
                      {a.person_name} <span className="text-[11px] text-ink-faint">{t("loans.tag_given")}</span>
                    </p>
                    <p className="tabular text-sm font-semibold shrink-0 text-up">৳{money(a.remaining)}</p>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
            <p className="text-sm font-semibold">{t("loans.net_position_prefix")}</p>
            <p className={`tabular font-display text-xl font-extrabold ${net >= 0 ? "text-up" : "text-down"}`}>
              ৳{money(Math.abs(net))}
            </p>
          </div>
          <DetailDownloadButton label={t("loans.download_pdf")} onClick={() => downloadLoanReport("net")} />
        </div>
      </Sheet>

      <Sheet
        open={detailKind === "taken"}
        onClose={() => setDetailKind(null)}
        title={t("loans.taken_detail_title")}
      >
        {takenPending.length > 0 ? (
          <div className="space-y-3">
            <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
              {takenPending.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3">
                  <p className="text-sm text-ink-muted truncate">{a.person_name}</p>
                  <p className="tabular text-sm font-semibold shrink-0 text-down">৳{money(a.remaining)}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">{t("loans.you_owe_pending")}</p>
              <p className="tabular font-display text-xl font-extrabold text-down">৳{money(totalOwedByMe)}</p>
            </div>
            <DetailDownloadButton label={t("loans.download_pdf")} onClick={() => downloadLoanReport("taken")} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">{t("loans.no_pending_taken")}</p>
        )}
      </Sheet>

      <Sheet
        open={detailKind === "given"}
        onClose={() => setDetailKind(null)}
        title={t("loans.given_detail_title")}
      >
        {givenPending.length > 0 ? (
          <div className="space-y-3">
            <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3">
              {givenPending.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3">
                  <p className="text-sm text-ink-muted truncate">{a.person_name}</p>
                  <p className="tabular text-sm font-semibold shrink-0 text-up">৳{money(a.remaining)}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 px-3.5 py-3">
              <p className="text-sm font-semibold">{t("loans.you_lent_pending")}</p>
              <p className="tabular font-display text-xl font-extrabold text-up">৳{money(totalOwedToMe)}</p>
            </div>
            <DetailDownloadButton label={t("loans.download_pdf")} onClick={() => downloadLoanReport("given")} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">{t("loans.havent_lent")}</p>
        )}
      </Sheet>

      <LoanAccountSheet
        account={detailAccount}
        onClose={() => setDetailAccount(null)}
        onChanged={() => {
          load();
          emitDashboardRefresh();
        }}
        onDelete={remove}
      />
    </div>
  );
}

function DetailDownloadButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold text-teal"
    >
      <Download size={13} /> {label}
    </button>
  );
}

function LoanSection({
  title,
  icon,
  pending,
  settled,
  showSettled,
  onToggleSettled,
  onOpen,
  onAdd,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  pending: LoanAccount[];
  settled: LoanAccount[];
  showSettled: boolean;
  onToggleSettled: () => void;
  onOpen: (a: LoanAccount) => void;
  onAdd: () => void;
  emptyText: string;
}) {
  const { t } = useLang();
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-muted">
          {icon} {title}
        </h3>
        <button onClick={onAdd} className="text-xs font-semibold text-teal">
          {t("loans.add_button_short")}
        </button>
      </div>

      {pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-6 text-center text-xs text-ink-muted">
          {emptyText}
        </div>
      ) : (
        <ul className="space-y-2">
          {pending.map((a) => {
            const disbursed = Number(a.disbursed || 0);
            const remaining = Number(a.remaining || 0);
            const partiallyPaid = Number(a.repaid || 0) > 0;
            return (
              <li
                key={a.id}
                onClick={() => onOpen(a)}
                className="cursor-pointer rounded-xl border border-border bg-surface p-3 active:bg-surface-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.person_name}</p>
                    <p className="text-xs text-ink-faint tabular">{formatDate(a.last_entry_date)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="tabular text-sm font-semibold">৳{money(remaining)}</span>
                    {partiallyPaid && (
                      <p className="text-[10px] text-ink-faint tabular">
                        {t("loans.of_total").replace("{amount}", money(disbursed))}
                      </p>
                    )}
                  </div>
                </div>
                {partiallyPaid && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-teal"
                      style={{ width: `${Math.min(100, (Number(a.repaid) / disbursed) * 100)}%` }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {settled.length > 0 && (
        <div className="mt-2">
          <button
            onClick={onToggleSettled}
            className="flex items-center gap-1 text-xs text-ink-faint"
          >
            <ChevronDown size={13} className={`transition ${showSettled ? "rotate-180" : ""}`} />
            {t("loans.settled_count").replace("{count}", String(settled.length))}
          </button>
          {showSettled && (
            <ul className="mt-2 space-y-1.5">
              {settled.map((a) => (
                <li
                  key={a.id}
                  onClick={() => onOpen(a)}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-border-soft bg-surface/50 p-2.5 opacity-70"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{a.person_name}</p>
                    <p className="text-[11px] text-ink-faint tabular">{formatDate(a.last_entry_date)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="tabular text-xs">৳{money(a.disbursed)}</span>
                    <Badge>{t("loans.settled_badge")}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function LoanAccountSheet({
  account,
  onClose,
  onChanged,
  onDelete,
}: {
  account: LoanAccount | null;
  onClose: () => void;
  onChanged: () => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useLang();
  const [detail, setDetail] = useState<{ account: LoanAccount; entries: LoanEntry[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mode, setMode] = useState<"none" | "more" | "pay">("none");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reload(id: number) {
    setDetailLoading(true);
    fetch(`/api/loans/${id}`)
      .then((r) => r.json())
      .then((d: any) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }

  useEffect(() => {
    setMode("none");
    setAmount("");
    setError("");
    if (account) {
      reload(account.id);
    } else {
      setDetail(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  if (!account) return null;

  const isTaken = account.direction === "taken";
  const disbursed = Number(detail?.account.disbursed ?? account.disbursed ?? 0);
  const repaid = Number(detail?.account.repaid ?? account.repaid ?? 0);
  const remaining = disbursed - repaid;

  async function submitMore(val: number) {
    setError("");
    if (!val || val <= 0) {
      setError(t("loans.invalid_amount"));
      return;
    }
    setSaving(true);
    const res = await fetch("/api/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        direction: account!.direction,
        person_name: account!.person_name,
        amount: val,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d: any = await res.json().catch(() => ({}));
      setError(d.error || t("loans.save_failed"));
      return;
    }
    setAmount("");
    setMode("none");
    reload(account!.id);
    onChanged();
  }

  async function submitPay(val: number) {
    setError("");
    if (!val || val <= 0) {
      setError(t("loans.invalid_amount"));
      return;
    }
    if (val > remaining) {
      setError(t("loans.exceeds_remaining"));
      return;
    }
    setSaving(true);
    const res = await fetch("/api/loan-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: account!.id, amount: val }),
    });
    setSaving(false);
    const d: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error || t("loans.save_failed"));
      return;
    }
    setAmount("");
    setMode("none");
    reload(account!.id);
    onChanged();
  }

  return (
    <Sheet open={!!account} onClose={onClose} title={account.person_name}>
      <div className="space-y-4">
        <Badge tone={isTaken ? "down" : "up"}>{isTaken ? t("loans.taken_label") : t("loans.given_label")}</Badge>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-2 p-3 text-center">
            <p className="text-xs text-ink-muted">{isTaken ? t("loans.total_taken_label") : t("loans.total_given_label")}</p>
            <p className="tabular text-lg font-semibold">৳{money(disbursed)}</p>
          </div>
          <div className="rounded-xl bg-due/10 p-3 text-center">
            <p className="text-xs text-due">{t("loans.remaining_label")}</p>
            <p className="tabular text-lg font-semibold text-due">৳{money(remaining)}</p>
          </div>
        </div>
        {repaid > 0 && (
          <p className="text-center text-xs text-ink-muted">
            {(isTaken ? t("loans.repaid_so_far_taken") : t("loans.repaid_so_far_given")).replace(
              "{amount}",
              money(repaid)
            )}
          </p>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold text-ink-muted">{t("loans.history_label")}</p>
          {detailLoading ? (
            <p className="py-4 text-center text-xs text-ink-muted">{t("loans.loading")}</p>
          ) : !detail || detail.entries.length === 0 ? (
            <p className="py-4 text-center text-xs text-ink-muted">{t("loans.no_entries")}</p>
          ) : (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto">
              {[...detail.entries].reverse().map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-medium">
                      {e.kind === "disburse"
                        ? isTaken
                          ? t("loans.entry_taken_disburse")
                          : t("loans.entry_given_disburse")
                        : isTaken
                        ? t("loans.entry_taken_repay")
                        : t("loans.entry_given_repay")}
                    </p>
                    <p className="text-[11px] text-ink-faint tabular">{formatDate(e.entry_date)}</p>
                  </div>
                  <span
                    className={`tabular text-sm font-semibold ${
                      e.kind === "repay" ? "text-up" : "text-ink"
                    }`}
                  >
                    {e.kind === "repay" ? "−" : "+"}৳{money(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {mode === "none" && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setMode("more");
                setAmount("");
                setError("");
              }}
            >
              {isTaken ? t("loans.add_more_taken") : t("loans.add_more_given")}
            </Button>
            {remaining > 0 && (
              <Button
                className="flex-1"
                onClick={() => {
                  setMode("pay");
                  setAmount("");
                  setError("");
                }}
              >
                {isTaken ? t("loans.repay_button_taken") : t("loans.repay_button_given")}
              </Button>
            )}
          </div>
        )}

        {mode === "more" && (
          <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
            <Field label={isTaken ? t("loans.more_amount_label_taken") : t("loans.more_amount_label_given")}>
              <input
                type="number"
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </Field>
            {error && <p className="text-sm text-down">{error}</p>}
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setMode("none")}>
                {t("loans.cancel_button")}
              </Button>
              <Button className="flex-1" onClick={() => submitMore(Number(amount))} disabled={saving}>
                {saving ? t("loans.saving") : t("loans.add_button")}
              </Button>
            </div>
          </div>
        )}

        {mode === "pay" && (
          <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
            <Field label={isTaken ? t("loans.pay_amount_label_taken") : t("loans.pay_amount_label_given")}>
              <input
                type="number"
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </Field>
            {error && <p className="text-sm text-down">{error}</p>}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setAmount(String(remaining))}>
                {t("loans.full_amount_button").replace("{amount}", money(remaining))}
              </Button>
              <Button className="flex-1" onClick={() => submitPay(Number(amount))} disabled={saving}>
                {saving ? t("loans.saving") : t("loans.add_button")}
              </Button>
            </div>
          </div>
        )}

        <button
          onClick={() => onDelete(account.id)}
          className="flex w-full items-center justify-center gap-1.5 py-1 text-xs text-ink-faint hover:text-down"
        >
          <Trash2 size={13} /> {t("loans.delete_entry_button")}
        </button>
      </div>
    </Sheet>
  );
}
