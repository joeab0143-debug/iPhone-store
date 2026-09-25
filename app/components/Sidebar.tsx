"use client";

import { useEffect, useState } from "react";
import {
  Smartphone,
  Boxes,
  Wallet2,
  TrendingUp,
  Package,
  ShoppingCart,
  PackagePlus,
  Settings,
  Languages,
  ClipboardCheck,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { APPROVALS_REFRESH_EVENT } from "@/lib/events";

export type TabId =
  | "stock"
  | "expense"
  | "profit"
  | "gadgets"
  | "sell"
  | "buy"
  | "approvals"
  | "settings";

// Full-height blue nav rail. Every main section of the app lives here now —
// clicking an item just swaps which panel is mounted in the main area next
// to it, nothing ever opens as a popup. The active item flips to a solid
// white pill; hovering any item grows it slightly and it snaps back the
// instant the pointer leaves (see .nav-item in globals.css — plain CSS
// :hover, so there's no click-to-render delay).
export default function Sidebar({
  tab,
  onChange,
  role,
}: {
  tab: TabId;
  onChange: (t: TabId) => void;
  role?: "admin" | "pos_manager" | "";
}) {
  const { lang, setLang, t } = useLang();
  const [pendingCount, setPendingCount] = useState(0);

  // The Approvals badge matters to both roles now -- an admin sees how many
  // POS Manager requests are waiting on them, a POS Manager sees how many of
  // their own requests are still waiting on the admin. Polls every 5s (down
  // from 30s) so it feels live without a manual refresh, and also refreshes
  // instantly the moment something changes in THIS tab (a request just got
  // queued, or an admin just approved/rejected one) via APPROVALS_REFRESH_EVENT
  // -- see lib/events.ts. Cross-tab/cross-device changes still ride the poll.
  useEffect(() => {
    if (role !== "admin" && role !== "pos_manager") return;
    let cancelled = false;
    function loadCount() {
      fetch("/api/pending-approvals?status=pending")
        .then((r) => r.json())
        .then((d: any) => {
          if (!cancelled) setPendingCount(Array.isArray(d.approvals) ? d.approvals.length : 0);
        })
        .catch(() => {});
    }
    loadCount();
    const interval = setInterval(loadCount, 5000);
    window.addEventListener(APPROVALS_REFRESH_EVENT, loadCount);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener(APPROVALS_REFRESH_EVENT, loadCount);
    };
  }, [role, tab]);

  const NAV: { id: TabId; label: string; icon: any }[] = [
    { id: "stock", label: t("sidebar.stock"), icon: Boxes },
    { id: "expense", label: t("sidebar.expense"), icon: Wallet2 },
    { id: "profit", label: t("sidebar.profit"), icon: TrendingUp },
    { id: "gadgets", label: t("sidebar.gadgets"), icon: Package },
    { id: "sell", label: t("sidebar.sell"), icon: ShoppingCart },
    { id: "buy", label: t("sidebar.buy"), icon: PackagePlus },
  ];

  return (
    <aside className="no-print fixed left-0 top-[calc(2.25rem_+_env(safe-area-inset-top))] bottom-0 z-30 flex w-[68px] sm:w-[212px] flex-col bg-sidebar-bg px-2 py-4">
      <div className="mb-4 flex items-center gap-2.5 px-1 sm:px-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
          <Smartphone size={18} />
        </div>
        <div className="hidden min-w-0 sm:block">
          <p className="truncate font-display text-sm font-bold leading-tight text-white">
            {t("app.title")}
          </p>
          <p className="truncate text-[10px] leading-tight text-sidebar-ink-muted">
            {t("app.tagline")}
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto scrollbar-none">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`nav-item flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left sm:px-3 ${
                active
                  ? "bg-sidebar-active-bg text-sidebar-active-ink shadow-sm"
                  : "text-sidebar-ink-muted hover:text-white"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              <span className="hidden truncate text-[13px] font-semibold sm:block">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Admin sees every POS Manager request waiting on them here
            ("Approvals"); a POS Manager sees this same tab but scoped to
            their own submitted requests, read-only ("My Requests") -- see
            ApprovalsTab.tsx for the role-aware rendering. */}
        {(role === "admin" || role === "pos_manager") && (
          <button
            onClick={() => onChange("approvals")}
            className={`nav-item flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left sm:px-3 ${
              tab === "approvals"
                ? "bg-sidebar-active-bg text-sidebar-active-ink shadow-sm"
                : "text-sidebar-ink-muted hover:text-white"
            }`}
          >
            <ClipboardCheck size={18} className="shrink-0" />
            <span className="hidden min-w-0 flex-1 truncate text-[13px] font-semibold sm:block">
              {role === "admin" ? t("sidebar.approvals") : t("sidebar.my_requests")}
            </span>
            {pendingCount > 0 && (
              <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-due px-1 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>
        )}
      </nav>

      {/* Language toggle — EN / বাং, persists via localStorage */}
      <div className="mb-1 flex items-center gap-1.5 rounded-xl bg-white/10 p-1">
        <Languages size={14} className="ml-1.5 hidden shrink-0 text-white/70 sm:block" />
        <button
          onClick={() => setLang("en")}
          className={`nav-item flex-1 rounded-lg py-1.5 text-[11px] font-bold ${
            lang === "en" ? "bg-white text-sidebar-active-ink" : "text-white/80"
          }`}
        >
          EN
        </button>
        <button
          onClick={() => setLang("bn")}
          className={`nav-item flex-1 rounded-lg py-1.5 text-[11px] font-bold ${
            lang === "bn" ? "bg-white text-sidebar-active-ink" : "text-white/80"
          }`}
        >
          বাং
        </button>
      </div>

      <div className="border-t border-white/15 pt-2">
        <button
          onClick={() => onChange("settings")}
          className={`nav-item flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left sm:px-3 ${
            tab === "settings"
              ? "bg-sidebar-active-bg text-sidebar-active-ink shadow-sm"
              : "text-sidebar-ink-muted hover:text-white"
          }`}
        >
          <Settings size={18} className="shrink-0" />
          <span className="hidden truncate text-[13px] font-semibold sm:block">
            {t("sidebar.settings")}
          </span>
        </button>
      </div>
    </aside>
  );
}
