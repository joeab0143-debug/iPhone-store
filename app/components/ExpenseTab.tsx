"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ChevronRight, Download } from "lucide-react";
import {
  Button,
  Field,
  inputClass,
  Sheet,
  money,
  formatDate,
  MonthPicker,
  currentMonthStr,
  monthRange,
} from "./ui";
import { emitDashboardRefresh, emitApprovalsRefresh } from "@/lib/events";
import { generateReportPDF } from "@/lib/report-pdf";
import { useLang } from "@/lib/i18n";
import type { Expense, ExpenseCategory } from "@/lib/types";

export default function ExpenseTab() {
  const { t } = useLang();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  // Expense totals start at zero at the beginning of each month — old
  // months' entries are never deleted, this picker lets any month's
  // history be viewed.
  const [month, setMonth] = useState(currentMonthStr());

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

  // Clicking a name shows that group's detail (date-wise list).
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { from, to } = monthRange(month);
    const [cRes, eRes] = await Promise.all([
      fetch("/api/expense-categories"),
      fetch(`/api/expenses?from=${from}&to=${to}`),
    ]);
    const cData: any = await cRes.json();
    const eData: any = await eRes.json();
    setCategories(cData.categories || []);
    setExpenses(eData.expenses || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function submitCategory() {
    setError("");
    if (!catForm.name) {
      setError(t("expense.name_required"));
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
      setError(t("expense.save_failed"));
      return;
    }
    setCatForm({ name: "", designation: "" });
    setCatOpen(false);
    load();
  }

  async function deleteCategory(id: number) {
    if (!confirm(t("expense.delete_category_confirm"))) return;
    const res = await fetch(`/api/expense-categories/${id}`, { method: "DELETE" });
    const d: any = await res.json().catch(() => ({}));
    if (d.pending) {
      emitApprovalsRefresh();
      window.alert(t("approvals.pending_submitted_message"));
      return;
    }
    load();
  }

  async function submitEntry() {
    setError("");
    if (!entryForm.category_id || !entryForm.amount) {
      setError(t("expense.category_and_amount_required"));
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
      setError(t("expense.save_failed"));
      return;
    }
    setEntryForm({ category_id: "", amount: "", expense_date: "", note: "" });
    setEntryOpen(false);
    emitDashboardRefresh();
    load();
  }

  async function deleteExpense(id: number) {
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    const d: any = await res.json().catch(() => ({}));
    if (d.pending) {
      emitApprovalsRefresh();
      window.alert(t("approvals.pending_submitted_message"));
      return;
    }
    emitDashboardRefresh();
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

  // Total expense for the selected month — the API already returns only
  // that month's entries.
  const totalMonth = expenses.reduce((s, e) => s + Number(e.amount), 0);

  // Entries are grouped together by name/category — this grouping is only
  // for display purposes, no category/entry merging or change happens in
  // the database. Even if a category with the same name was created more
  // than once (with different category_id), they'll be shown together here
  // based on name.
  const groupedExpenses = useMemo(() => {
    const map = new Map<string, { name: string; total: number; entries: Expense[] }>();
    for (const e of expenses) {
      const key = e.category_name || t("expense.unknown_category");
      if (!map.has(key)) map.set(key, { name: key, total: 0, entries: [] });
      const g = map.get(key)!;
      g.total += Number(e.amount);
      g.entries.push(e);
    }
    // Sort each group's entries newest to oldest by date.
    for (const g of map.values()) {
      g.entries.sort(
        (a, b) => new Date((b.expense_date || "").replace(" ", "T")).getTime() -
          new Date((a.expense_date || "").replace(" ", "T")).getTime()
      );
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses]);

  const selectedGroupData = selectedGroup
    ? groupedExpenses.find((g) => g.name === selectedGroup) ?? null
    : null;

  // "YYYY-MM" -> "September 2026" (English only — jsPDF's font can't draw
  // Bengali glyphs, same reasoning documented in lib/report-pdf.ts).
  function monthLabel(m: string) {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  function downloadReport() {
    // Open the tab now, inside this click's user gesture — building the
    // PDF below involves no awaits here, but this keeps the same safe
    // pattern used everywhere else PDFs are generated in this app.
    const previewWin = window.open("", "_blank");
    generateReportPDF(
      {
        shopName: "Apple Store Satkhira",
        title: "Expense Report",
        subtitle: monthLabel(month),
        summary: [
          { label: "Today's Expense", value: `Tk ${totalToday.toLocaleString()}`, tone: "down" },
          { label: "This Month's Expense", value: `Tk ${totalMonth.toLocaleString()}`, tone: "down" },
          { label: "Categories", value: String(groupedExpenses.length) },
          { label: "Total Entries", value: String(expenses.length) },
        ],
        table: {
          head: ["Category", "Entries", "Amount (Tk)"],
          rows: groupedExpenses.map((g) => [g.name, g.entries.length, g.total.toLocaleString()]),
          emptyLabel: "No expense entries this month",
        },
        footerNote: "Generated from Apple Store Satkhira — Expense Tab",
      },
      previewWin
    );
  }

  return (
    <div className="pb-24">
      <MonthPicker value={month} onChange={setMonth} />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="phone-card">
          <p className="text-xs text-ink-muted">{t("expense.today")}</p>
          <p className="tabular font-display text-2xl font-bold text-down mt-1">
            ৳{money(totalToday)}
          </p>
        </div>
        <div className="phone-card">
          <p className="text-xs text-ink-muted">{t("expense.this_month")}</p>
          <p className="tabular font-display text-2xl font-bold mt-1">৳{money(totalMonth)}</p>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display font-semibold">{t("expense.categories_heading")}</h3>
        <button
          onClick={() => setCatOpen(true)}
          className="text-xs font-semibold text-teal"
        >
          {t("expense.new_category")}
        </button>
      </div>

      {categories.length === 0 ? (
        <p className="mb-5 text-sm text-ink-muted">{t("expense.no_categories")}</p>
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
        <h3 className="font-display font-semibold">{t("expense.entries_heading")}</h3>
        <button
          onClick={downloadReport}
          className="flex items-center gap-1 text-xs font-semibold text-teal"
        >
          <Download size={13} /> {t("expense.download_pdf")}
        </button>
      </div>

      {loading ? (
        <p className="text-center text-sm text-ink-muted py-10">{t("expense.loading")}</p>
      ) : groupedExpenses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center text-ink-muted">
          {t("expense.no_entries")}
        </div>
      ) : (
        <ul className="space-y-2">
          {groupedExpenses.map((g) => (
            <li key={g.name}>
              <button
                type="button"
                onClick={() => setSelectedGroup(g.name)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-surface p-3.5 text-left transition active:scale-[0.99]"
              >
                <div>
                  <p className="text-sm font-medium">{g.name}</p>
                  <p className="text-xs text-ink-faint">
                    {t("expense.entries_count").replace("{count}", String(g.entries.length))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular font-semibold text-down">
                    -৳{money(g.total)}
                  </span>
                  <ChevronRight size={16} className="text-ink-faint" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => setEntryOpen(true)}
        disabled={categories.length === 0}
        className="no-print fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-white shadow-lg shadow-gold/20 active:scale-95 disabled:opacity-40"
        aria-label={t("expense.add_new_aria")}
      >
        <Plus size={26} />
      </button>

      <Sheet open={catOpen} onClose={() => setCatOpen(false)} title={t("expense.new_category_title")}>
        <div className="space-y-3">
          <Field label={t("expense.category_name_label")}>
            <input
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t("expense.designation_label")}>
            <input
              value={catForm.designation}
              onChange={(e) => setCatForm({ ...catForm, designation: e.target.value })}
              className={inputClass}
            />
          </Field>
          {error && <p className="text-sm text-down">{error}</p>}
          <Button full onClick={submitCategory} disabled={saving}>
            {saving ? t("expense.saving") : t("expense.create")}
          </Button>
        </div>
      </Sheet>

      <Sheet open={entryOpen} onClose={() => setEntryOpen(false)} title={t("expense.new_entry_title")}>
        <div className="space-y-3">
          <Field label={t("expense.select_category_label")}>
            <select
              value={entryForm.category_id}
              onChange={(e) => setEntryForm({ ...entryForm, category_id: e.target.value })}
              className={inputClass}
            >
              <option value="">{t("expense.select_placeholder")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("expense.amount_label")}>
            <input
              type="number"
              inputMode="decimal"
              value={entryForm.amount}
              onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t("expense.date_label")}>
            <input
              type="date"
              value={entryForm.expense_date}
              onChange={(e) => setEntryForm({ ...entryForm, expense_date: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t("expense.note_label")}>
            <input
              value={entryForm.note}
              onChange={(e) => setEntryForm({ ...entryForm, note: e.target.value })}
              className={inputClass}
            />
          </Field>
          {error && <p className="text-sm text-down">{error}</p>}
          <Button full onClick={submitEntry} disabled={saving}>
            {saving ? t("expense.saving") : t("expense.add_button")}
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={!!selectedGroup}
        onClose={() => setSelectedGroup(null)}
        title={selectedGroup ?? ""}
      >
        {selectedGroupData && selectedGroupData.entries.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-3.5 py-3">
              <p className="text-sm font-semibold">
                {t("expense.total_entries_count").replace(
                  "{count}",
                  String(selectedGroupData.entries.length)
                )}
              </p>
              <p className="tabular font-display text-lg font-bold text-down">
                -৳{money(selectedGroupData.total)}
              </p>
            </div>
            <ul className="space-y-2">
              {selectedGroupData.entries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface p-3.5"
                >
                  <div>
                    <p className="text-sm font-medium">{formatDate(e.expense_date)}</p>
                    {e.note && <p className="text-xs text-ink-faint mt-0.5">{e.note}</p>}
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
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">{t("expense.no_entries")}</p>
        )}
      </Sheet>
    </div>
  );
}
