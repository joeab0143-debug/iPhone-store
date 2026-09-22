"use client";

import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import type { TabId } from "./components/Sidebar";
import StockTab from "./components/StockTab";
import ExpenseTab from "./components/ExpenseTab";
import ProfitTab from "./components/ProfitTab";
import GadgetsTab from "./components/GadgetsTab";
import LoansTab from "./components/LoansTab";
import DashboardStats from "./components/DashboardStats";
import SellSheet from "./components/SellSheet";
import OutsideSellSheet from "./components/OutsideSellSheet";
import BuySheet from "./components/BuySheet";
import SettingsSheet from "./components/SettingsSheet";

export default function Home() {
  const [tab, setTab] = useState<TabId>("stock");
  const [username, setUsername] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: any) => setUsername(d.username || ""))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-dvh w-full">
      <Sidebar tab={tab} onChange={setTab} />

      <main className="min-w-0 ml-[68px] sm:ml-[212px] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1600px]">
          {/* Dashboard stats — always visible at the top, real-time */}
          <DashboardStats />

          {/* Selected sidebar item's panel — rendered inline, never a popup */}
          <div className="mt-5">
            {tab === "stock" && <StockTab />}
            {tab === "expense" && <ExpenseTab />}
            {tab === "profit" && <ProfitTab />}
            {tab === "gadgets" && <GadgetsTab />}
            {tab === "loans" && <LoansTab />}
            {tab === "sell" && <SellSheet open onClose={() => {}} />}
            {tab === "outside-sell" && (
              <OutsideSellSheet open onClose={() => {}} />
            )}
            {tab === "buy" && <BuySheet open onClose={() => {}} />}
            {tab === "settings" && (
              <SettingsSheet open onClose={() => {}} username={username} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
