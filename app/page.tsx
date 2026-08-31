"use client";

import { useState } from "react";
import { Boxes, Wallet2, TrendingUp, Smartphone } from "lucide-react";
import StockTab from "./components/StockTab";
import ExpenseTab from "./components/ExpenseTab";
import ProfitTab from "./components/ProfitTab";
import DashboardStats from "./components/DashboardStats";
import BottomActionBar from "./components/BottomActionBar";

type Tab = "stock" | "expense" | "profit";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "stock", label: "স্টক", icon: Boxes },
  { id: "expense", label: "খরচ", icon: Wallet2 },
  { id: "profit", label: "প্রফিট", icon: TrendingUp },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("stock");

  return (
    <div className="mx-auto min-h-screen max-w-md">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border-soft bg-bg/90 backdrop-blur-md px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold">
            <Smartphone size={18} />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold leading-tight">
              Phone Fantasy
            </h1>
            <p className="text-[11px] text-ink-faint leading-tight">
              মোবাইল শোরুম ম্যানেজমেন্ট
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-5 pt-4">
        {/* Dashboard stats — always visible at the top, real-time */}
        <DashboardStats />

        {/* Tab row — existing Stock/Expense/Profit, unchanged */}
        <div className="mb-4 grid grid-cols-3 gap-1.5 rounded-2xl bg-surface p-1.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-gold text-[#1a1400] shadow-sm"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                <Icon size={15} />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "stock" && <StockTab />}
        {tab === "expense" && <ExpenseTab />}
        {tab === "profit" && <ProfitTab />}
      </main>

      {/* Bottom action bar — Sell / Outside Sell / Buy, always accessible */}
      <BottomActionBar />
    </div>
  );
}
