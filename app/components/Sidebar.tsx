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
} from "lucide-react";

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

const NAV: { id: TabId; label: string; icon: any }[] = [
  { id: "stock", label: "স্টক", icon: Boxes },
  { id: "expense", label: "খরচ", icon: Wallet2 },
  { id: "profit", label: "প্রফিট", icon: TrendingUp },
  { id: "gadgets", label: "Gadgets", icon: Package },
  { id: "loans", label: "ধার", icon: HandCoins },
  { id: "sell", label: "বিক্রি", icon: ShoppingCart },
  { id: "outside-sell", label: "Outside Sell", icon: Repeat },
  { id: "buy", label: "কিনুন", icon: PackagePlus },
];

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
  return (
    <aside className="no-print sticky top-0 z-30 flex h-dvh w-[68px] sm:w-[212px] shrink-0 flex-col bg-sidebar-bg px-2 py-4">
      <div className="mb-4 flex items-center gap-2.5 px-1 sm:px-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
          <Smartphone size={18} />
        </div>
        <div className="hidden min-w-0 sm:block">
          <p className="truncate font-display text-sm font-bold leading-tight text-white">
            iPhone Store
          </p>
          <p className="truncate text-[10px] leading-tight text-sidebar-ink-muted">
            মোবাইল শোরুম ম্যানেজমেন্ট
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

      <div className="mt-2 border-t border-white/15 pt-2">
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
            সেটিংস
          </span>
        </button>
      </div>
    </aside>
  );
}
