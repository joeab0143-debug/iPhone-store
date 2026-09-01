"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ChevronDown, HandCoins, HandHeart } from "lucide-react";
import { Button, Field, inputClass, money, formatDate, Sheet, Badge } from "./ui";
import type { Loan } from "@/lib/types";

// Loans — a private personal ledger (loans taken from people, and loans
// given to people). Deliberately isolated from the shop's own cash flow:
// never touches /api/dashboard, Total Cash, or the Profit tab. The same
// person can have several loans open at once; each entry stays independent.
export default function LoansTab() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [direction, setDirection] = useState<"taken" | "given">("taken");
  const [form, setForm] = useState({ person_name: "", amount: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showSettledTaken, setShowSettledTaken] = useState(false);
  const [showSettledGiven, setShowSettledGiven] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/loans");
    const data: any = await res.json();
    setLoans(data.loans || []);
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
    load();
  }

  async function settle(id: number) {
    await fetch(`/api/loans/${id}`, { method: "PATCH" });
    load();
  }

  async function remove(id: number) {
    if (!confirm("এই এন্ট্রিটি মুছে ফেলবেন?")) return;
    await fetch(`/api/loans/${id}`, { method: "DELETE" });
    load();
  }

  const taken = useMemo(() => loans.filter((l) => l.direction === "taken"), [loans]);
  const given = useMemo(() => loans.filter((l) => l.direction === "given"), [loans]);
  const takenPending = taken.filter((l) => l.status === "pending");
  const givenPending = given.filter((l) => l.status === "pending");
  const takenSettled = taken.filter((l) => l.status === "settled");
  const givenSettled = given.filter((l) => l.status === "settled");

  const totalOwedByMe = takenPending.reduce((s, l) => s + Number(l.amount), 0);
  const totalOwedToMe = givenPending.reduce((s, l) => s + Number(l.amount), 0);
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
            <p className="text-[11px] text-ink-muted">আপনি ধার নিয়েছেন</p>
            <p className="tabular font-semibold text-down">৳{money(totalOwedByMe)}</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-2.5">
            <p className="text-[11px] text-ink-muted">আপনি ধার দিয়েছেন</p>
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
            actionLabel="পরিশোধ (Repay)"
            onAction={settle}
            onDelete={remove}
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
            actionLabel="ফেরত পেয়েছি"
            onAction={settle}
            onDelete={remove}
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
              placeholder="নাম"
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
  actionLabel,
  onAction,
  onDelete,
  onAdd,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  pending: Loan[];
  settled: Loan[];
  showSettled: boolean;
  onToggleSettled: () => void;
  actionLabel: string;
  onAction: (id: number) => void;
  onDelete: (id: number) => void;
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
          {pending.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{l.person_name}</p>
                <p className="text-xs text-ink-faint tabular">{formatDate(l.loan_date)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="tabular text-sm font-semibold">৳{money(l.amount)}</span>
                <Button variant="secondary" className="!px-2.5 !py-1.5 !text-xs" onClick={() => onAction(l.id)}>
                  {actionLabel}
                </Button>
                <button onClick={() => onDelete(l.id)} className="text-ink-faint hover:text-down">
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
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
              {settled.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border-soft bg-surface/50 p-2.5 opacity-70"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{l.person_name}</p>
                    <p className="text-[11px] text-ink-faint tabular">{formatDate(l.settled_date)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="tabular text-xs">৳{money(l.amount)}</span>
                    <Badge>সেটেল</Badge>
                    <button onClick={() => onDelete(l.id)} className="text-ink-faint hover:text-down">
                      <Trash2 size={13} />
                    </button>
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
