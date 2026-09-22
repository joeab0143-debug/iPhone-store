"use client";

import {
  Smartphone,
  Boxes,
  Wallet2,
  TrendingUp,
  Package,
  HandCoins,
  ShoppingCart,
  Repeat,
  PackagePlus,
  Settings,
  Languages,
} from "lucide-react";
import { useLang } from "@/lib/i18n";

export type TabId =
  | "stock"
  | "expense"
  | "profit"
  | "gadgets"
  | "loans"
  | "sell"
  | "outside-sell"
  | "buy"
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
}: {
  tab: TabId;
  onChange: (t: TabId) => void;
}) {
  const { lang, setLang, t } = useLang();

  const NAV: { id: TabId; label: string; icon: any }[] = [
    { id: "stock", label: t("sidebar.stock"), icon: Boxes },
    { id: "expense", label: t("sidebar.expense"), icon: Wallet2 },
    { id: "profit", label: t("sidebar.profit"), icon: TrendingUp },
    { id: "gadgets", label: t("sidebar.gadgets"), icon: Package },
    { id: "loans", label: t("sidebar.loans"), icon: HandCoins },
    { id: "sell", label: t("sidebar.sell"), icon: ShoppingCart },
    { id: "outside-sell", label: t("sidebar.used_phone"), icon: Repeat },
    { id: "buy", label: t("sidebar.buy"), icon: PackagePlus },
  ];

  return (
    <aside className="no-print fixed inset-y-0 left-0 z-30 flex h-dvh w-[68px] sm:w-[212px] flex-col bg-sidebar-bg px-2 py-4">
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
