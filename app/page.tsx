"use client";

import { useState } from "react";
import { Boxes, Wallet2, TrendingUp, Smartphone, Package, HandCoins } from "lucide-react";
import StockTab from "./components/StockTab";
import ExpenseTab from "./components/ExpenseTab";
import ProfitTab from "./components/ProfitTab";
import GadgetsTab from "./components/GadgetsTab";
import LoansTab from "./components/LoansTab";
import DashboardStats from "./components/DashboardStats";
import BottomActionBar from "./components/BottomActionBar";

type Tab = "stock" | "expense" | "profit" | "gadgets" | "loans";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "stock", label: "স্টক", icon: Boxes },
  { id: "expense", label: "খরচ", icon: Wallet2 },
  { id: "profit", label: "প্রফিট", icon: TrendingUp },
  { id: "gadgets", label: "Gadgets", icon: Package },
  { id: "loans", label: "ধার", icon: HandCoins },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("stock");

  return (
    <div className="mx-auto min-h-dvh max-w-md">
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

        {/* Vertical tab sidebar (left) + active tab's content (right) */}
        <div className="mt-4 flex items-start gap-3">
          <nav className="flex w-[68px] shrink-0 flex-col gap-1.5 self-start rounded-2xl bg-surface p-1.5">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-center text-[10px] font-semibold leading-tight transition ${
                    active
                      ? "bg-gold text-[#1a1400] shadow-sm"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <Icon size={16} />
                  {t.label}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1">
            {tab === "stock" && <StockTab />}
            {tab === "expense" && <ExpenseTab />}
            {tab === "profit" && <ProfitTab />}
            {tab === "gadgets" && <GadgetsTab />}
            {tab === "loans" && <LoansTab />}
          </div>
        </div>
      </main>

      {/* Bottom action bar — Sell / Outside Sell / Buy, always accessible */}
      <BottomActionBar />
    </div>
  );
}
