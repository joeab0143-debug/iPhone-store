"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ChevronDown, HandCoins, HandHeart } from "lucide-react";
import { Button, Field, inputClass, money, formatDate, Sheet, Badge } from "./ui";
import { emitDashboardRefresh } from "@/lib/events";
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
      setError("সব ঘর পূরণ করুন");
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
      setError(d.error || "সেভ করা যায়নি");
      return;
    }
    setAddOpen(false);
    emitDashboardRefresh();
    load();
  }

  async function remove(id: number) {
    if (!confirm("এই এন্ট্রি ও এর সব হিস্ট্রি একেবারে মুছে যাবে। নিশ্চিত?")) return;
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

  return (
    <div className="pb-24">
      <div className="mb-4 phone-card">
        <p className="text-xs text-ink-muted">
          নেট অবস্থান ({net >= 0 ? "মানুষ আপনাকে দিবে" : "আপনি মানুষকে দিবেন"})
        </p>
        <p
          className={`tabular font-display text-3xl font-extrabold mt-1 ${
            net >= 0 ? "text-up" : "text-down"
          }`}
        >
          ৳{money(Math.abs(net))}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2.5 text-sm">
          <div className="rounded-xl bg-surface-2 p-2.5">
            <p className="text-[11px] text-ink-muted">আপনি ধার নিয়েছেন (বাকি)</p>
            <p className="tabular font-semibold text-down">৳{money(totalOwedByMe)}</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-2.5">
            <p className="text-[11px] text-ink-muted">আপনি ধার দিয়েছেন (বাকি)</p>
            <p className="tabular font-semibold text-up">৳{money(totalOwedToMe)}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-ink-muted py-10">লোড হচ্ছে...</p>
      ) : (
        <div className="space-y-5">
          <LoanSection
            title="ধার নিয়েছি (Loans Taken)"
            icon={<HandCoins size={16} />}
            pending={takenPending}
            settled={takenSettled}
            showSettled={showSettledTaken}
            onToggleSettled={() => setShowSettledTaken((v) => !v)}
            onOpen={setDetailAccount}
            onAdd={() => openAdd("taken")}
            emptyText="কোনো ধার নেই"
          />
          <LoanSection
            title="ধার দিয়েছি (Loans Given)"
            icon={<HandHeart size={16} />}
            pending={givenPending}
            settled={givenSettled}
            showSettled={showSettledGiven}
            onToggleSettled={() => setShowSettledGiven((v) => !v)}
            onOpen={setDetailAccount}
            onAdd={() => openAdd("given")}
            emptyText="কাউকে ধার দেননি"
          />
        </div>
      )}

      <button
        onClick={() => openAdd(direction)}
        className="no-print fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-[#1a1400] shadow-lg shadow-gold/20 active:scale-95"
        aria-label="নতুন ধার যোগ করুন"
      >
        <Plus size={26} />
      </button>

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={direction === "taken" ? "ধার নিয়েছি — নতুন এন্ট্রি" : "ধার দিয়েছি — নতুন এন্ট্রি"}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-1.5">
            <button
              onClick={() => setDirection("taken")}
              className={`rounded-lg py-2 text-xs font-semibold transition ${
                direction === "taken" ? "bg-gold text-[#1a1400]" : "text-ink-muted"
              }`}
            >
              ধার নিয়েছি
            </button>
            <button
              onClick={() => setDirection("given")}
              className={`rounded-lg py-2 text-xs font-semibold transition ${
                direction === "given" ? "bg-gold text-[#1a1400]" : "text-ink-muted"
              }`}
            >
              ধার দিয়েছি
            </button>
          </div>
          <Field label={direction === "taken" ? "কার কাছ থেকে নিলেন" : "কাকে দিলেন"}>
            <input
              value={form.person_name}
              onChange={(e) => setForm({ ...form, person_name: e.target.value })}
              placeholder="নাম — আগে থেকে থাকলে সেটার সাথেই যোগ হবে"
              className={inputClass}
            />
          </Field>
          <Field label="পরিমাণ (৳)">
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
            {saving ? "সেভ হচ্ছে..." : "যোগ করুন"}
          </Button>
        </div>
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
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-muted">
          {icon} {title}
        </h3>
        <button onClick={onAdd} className="text-xs font-semibold text-teal">
          + যোগ করুন
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
                      <p className="text-[10px] text-ink-faint tabular">মোট ৳{money(disbursed)}-এর</p>
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
            সেটেল হওয়া ({settled.length})
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
                    <Badge>সেটেল</Badge>
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
      setError("বৈধ পরিমাণ দিন");
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
      setError(d.error || "সেভ করা যায়নি");
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
      setError("বৈধ পরিমাণ দিন");
      return;
    }
    if (val > remaining) {
      setError("বাকি থাকা পরিমাণের চেয়ে বেশি দেওয়া যাবে না");
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
      setError(d.error || "সেভ করা যায়নি");
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
        <Badge tone={isTaken ? "down" : "up"}>{isTaken ? "ধার নিয়েছি" : "ধার দিয়েছি"}</Badge>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-2 p-3 text-center">
            <p className="text-xs text-ink-muted">{isTaken ? "মোট নিয়েছেন" : "মোট দিয়েছেন"}</p>
            <p className="tabular text-lg font-semibold">৳{money(disbursed)}</p>
          </div>
          <div className="rounded-xl bg-due/10 p-3 text-center">
            <p className="text-xs text-due">বাকি আছে</p>
            <p className="tabular text-lg font-semibold text-due">৳{money(remaining)}</p>
          </div>
        </div>
        {repaid > 0 && (
          <p className="text-center text-xs text-ink-muted">
            এ পর্যন্ত {isTaken ? "পরিশোধ" : "আদায়"} হয়েছে ৳{money(repaid)}
          </p>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold text-ink-muted">হিস্ট্রি</p>
          {detailLoading ? (
            <p className="py-4 text-center text-xs text-ink-muted">লোড হচ্ছে...</p>
          ) : !detail || detail.entries.length === 0 ? (
            <p className="py-4 text-center text-xs text-ink-muted">কোনো এন্ট্রি নেই</p>
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
                          ? "নিয়েছেন"
                          : "দিয়েছেন"
                        : isTaken
                        ? "পরিশোধ করেছেন"
                        : "আদায় করেছেন"}
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
              আরও {isTaken ? "নিলেন" : "দিলেন"}
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
                {isTaken ? "পরিশোধ" : "আদায়"}
              </Button>
            )}
          </div>
        )}

        {mode === "more" && (
          <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
            <Field label={isTaken ? "আরও কত টাকা নিলেন" : "আরও কত টাকা দিলেন"}>
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
                বাতিল
              </Button>
              <Button className="flex-1" onClick={() => submitMore(Number(amount))} disabled={saving}>
                {saving ? "সেভ হচ্ছে..." : "যোগ করুন"}
              </Button>
            </div>
          </div>
        )}

        {mode === "pay" && (
          <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
            <Field label={isTaken ? "কত টাকা পরিশোধ করলেন" : "কত টাকা ফেরত পেলেন"}>
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
                পুরোটা (৳{money(remaining)})
              </Button>
              <Button className="flex-1" onClick={() => submitPay(Number(amount))} disabled={saving}>
                {saving ? "সেভ হচ্ছে..." : "যোগ করুন"}
              </Button>
            </div>
          </div>
        )}

        <button
          onClick={() => onDelete(account.id)}
          className="flex w-full items-center justify-center gap-1.5 py-1 text-xs text-ink-faint hover:text-down"
        >
          <Trash2 size={13} /> পুরো এন্ট্রি মুছে ফেলুন
        </button>
      </div>
    </Sheet>
  );
}
