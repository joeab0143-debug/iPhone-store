"use client";

import { useEffect, useState } from "react";
import AnnouncementBar from "./components/AnnouncementBar";
import Sidebar from "./components/Sidebar";
import type { TabId } from "./components/Sidebar";
import StockTab from "./components/StockTab";
import ExpenseTab from "./components/ExpenseTab";
import ProfitTab from "./components/ProfitTab";
import GadgetsTab from "./components/GadgetsTab";
import DashboardStats from "./components/DashboardStats";
import SellSheet from "./components/SellSheet";
import BuySheet from "./components/BuySheet";
import SettingsSheet from "./components/SettingsSheet";
import ApprovalsTab from "./components/ApprovalsTab";

export default function Home() {
  const [tab, setTab] = useState<TabId>("stock");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"admin" | "pos_manager" | "">("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: any) => {
        setUsername(d.username || "");
        setRole(d.role || "");
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-dvh w-full">
      <AnnouncementBar />
      <Sidebar tab={tab} onChange={setTab} role={role} />

      <main className="min-w-0 ml-[68px] sm:ml-[212px] mt-[calc(2.25rem_+_env(safe-area-inset-top))] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1600px]">
          {/* Dashboard stats (Total Cash, Today's Sale, Total Buy, This
              Month's Profit, etc.) live on the Profit tab now -- Stock is
              just the phone inventory list, nothing money-related. */}
          {tab === "profit" && <DashboardStats />}

          {/* Selected sidebar item's panel — rendered inline, never a popup */}
          <div className={tab === "profit" ? "mt-5" : ""}>
            {tab === "stock" && <StockTab />}
            {tab === "expense" && <ExpenseTab />}
            {tab === "profit" && <ProfitTab />}
            {tab === "gadgets" && <GadgetsTab />}
            {tab === "sell" && <SellSheet open onClose={() => {}} />}
            {tab === "buy" && <BuySheet open onClose={() => {}} />}
            {tab === "approvals" && role === "admin" && <ApprovalsTab />}
            {tab === "settings" && (
              <SettingsSheet open onClose={() => {}} username={username} role={role} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
