"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Field, inputClass, Sheet, money, formatDate } from "./ui";
import type { Expense, ExpenseCategory } from "@/lib/types";

export default function ExpenseTab() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [catOpen, setCatOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [catForm, setCatForm] = useState({ name: "", designation: "" });
  const [entryForm, setEntryForm] = useState({
    category_id: "",
    amount: "",
    expense_date: "",
    note: "",
  });

  async function load() {
    setLoading(true);
    const [cRes, eRes] = await Promise.all([
      fetch("/api/expense-categories"),
      fetch("/api/expenses"),
    ]);
    const cData: any = await cRes.json();
    const eData: any = await eRes.json();
    setCategories(cData.categories || []);
    setExpenses(eData.expenses || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function submitCategory() {
    setError("");
    if (!catForm.name) {
      setError("ঘরের নাম দিন");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/expense-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(catForm),
    });
    setSaving(false);
    if (!res.ok) {
      setError("সেভ করা যায়নি");
      return;
    }
    setCatForm({ name: "", designation: "" });
    setCatOpen(false);
    load();
  }

  async function deleteCategory(id: number) {
    if (!confirm("এই ঘরটি ও এর সব খরচ এন্ট্রি মুছে যাবে। নিশ্চিত?")) return;
    await fetch(`/api/expense-categories/${id}`, { method: "DELETE" });
    load();
  }

  async function submitEntry() {
    setError("");
    if (!entryForm.category_id || !entryForm.amount) {
      setError("ঘর ও পরিমাণ দিন");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: Number(entryForm.category_id),
        amount: Number(entryForm.amount),
        expense_date: entryForm.expense_date ? `${entryForm.expense_date} 00:00:00` : null,
        note: entryForm.note || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("সেভ করা যায়নি");
      return;
    }
    setEntryForm({ category_id: "", amount: "", expense_date: "", note: "" });
    setEntryOpen(false);
    load();
  }

  async function deleteExpense(id: number) {
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    load();
  }

  const totalToday = expenses
    .filter((e) => {
      const d = new Date((e.expense_date || "").replace(" ", "T"));
      const now = new Date();
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    })
    .reduce((s, e) => s + Number(e.amount), 0);

  const totalAll = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="pb-24">
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="phone-card">
          <p className="text-xs text-ink-muted">আজকের খরচ</p>
          <p className="tabular font-display text-2xl font-bold text-down mt-1">
            ৳{money(totalToday)}
          </p>
        </div>
        <div className="phone-card">
          <p className="text-xs text-ink-muted">সর্বমোট খরচ</p>
          <p className="tabular font-display text-2xl font-bold mt-1">৳{money(totalAll)}</p>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display font-semibold">খরচের ঘরসমূহ</h3>
        <button
          onClick={() => setCatOpen(true)}
          className="text-xs font-semibold text-teal"
        >
          + নতুন ঘর
        </button>
      </div>

      {categories.length === 0 ? (
        <p className="mb-5 text-sm text-ink-muted">
          এখনো কোনো খরচের ঘর তৈরি হয়নি — যেমন: কারেন্ট বিল, দোকান ভাড়া, স্টাফ বেতন ইত্যাদি
        </p>
      ) : (
        <div className="mb-5 flex flex-wrap gap-2">
          {categories.map((c) => (
            <div
              key={c.id}
              className="group flex items-center gap-1.5 rounded-full border border-border bg-surface-2 py-1.5 pl-3 pr-2 text-xs"
            >
              <span className="font-medium">{c.name}</span>
              {c.designation && (
                <span className="text-ink-faint">· {c.designation}</span>
              )}
              <button
                onClick={() => deleteCategory(c.id)}
                className="ml-0.5 rounded-full p-0.5 text-ink-faint hover:text-down"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display font-semibold">খরচের এন্ট্রি</h3>
      </div>

      {loading ? (
        <p className="text-center text-sm text-ink-muted py-10">লোড হচ্ছে...</p>
      ) : expenses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center text-ink-muted">
          কোনো খরচ এন্ট্রি নেই
        </div>
      ) : (
        <ul className="space-y-2">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-3.5"
            >
              <div>
                <p className="text-sm font-medium">{e.category_name}</p>
                <p className="text-xs text-ink-faint">
                  {formatDate(e.expense_date)}
                  {e.note ? ` · ${e.note}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular font-semibold text-down">
                  -৳{money(e.amount)}
                </span>
                <button
                  onClick={() => deleteExpense(e.id)}
                  className="text-ink-faint hover:text-down"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => setEntryOpen(true)}
        disabled={categories.length === 0}
        className="no-print fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-[#1a1400] shadow-lg shadow-gold/20 active:scale-95 disabled:opacity-40"
        aria-label="নতুন খরচ যোগ করুন"
      >
        <Plus size={26} />
      </button>

      <Sheet open={catOpen} onClose={() => setCatOpen(false)} title="নতুন খরচের ঘর">
        <div className="space-y-3">
          <Field label="ঘরের নাম (যেমন: কারেন্ট বিল, দোকান ভাড়া)">
            <input
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="ডেজিগনেশন (ঐচ্ছিক, যেমন: স্টাফের পদবি)">
            <input
              value={catForm.designation}
              onChange={(e) => setCatForm({ ...catForm, designation: e.target.value })}
              className={inputClass}
            />
          </Field>
          {error && <p className="text-sm text-down">{error}</p>}
          <Button full onClick={submitCategory} disabled={saving}>
            {saving ? "সেভ হচ্ছে..." : "তৈরি করুন"}
          </Button>
        </div>
      </Sheet>

      <Sheet open={entryOpen} onClose={() => setEntryOpen(false)} title="নতুন খরচ এন্ট্রি">
        <div className="space-y-3">
          <Field label="ঘর বাছাই করুন">
            <select
              value={entryForm.category_id}
              onChange={(e) => setEntryForm({ ...entryForm, category_id: e.target.value })}
              className={inputClass}
            >
              <option value="">— বাছাই করুন —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="পরিমাণ (৳)">
            <input
              type="number"
              inputMode="decimal"
              value={entryForm.amount}
              onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="তারিখ (ফাঁকা রাখলে আজকের তারিখ বসবে)">
            <input
              type="date"
              value={entryForm.expense_date}
              onChange={(e) => setEntryForm({ ...entryForm, expense_date: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="নোট (ঐচ্ছিক)">
            <input
              value={entryForm.note}
              onChange={(e) => setEntryForm({ ...entryForm, note: e.target.value })}
              className={inputClass}
            />
          </Field>
          {error && <p className="text-sm text-down">{error}</p>}
          <Button full onClick={submitEntry} disabled={saving}>
            {saving ? "সেভ হচ্ছে..." : "যোগ করুন"}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
