"use client";

import { useState } from "react";
import { ShoppingCart, Repeat, PackagePlus } from "lucide-react";
import SellSheet from "./SellSheet";
import OutsideSellSheet from "./OutsideSellSheet";
import BuySheet from "./BuySheet";

type Action = "sell" | "outside-sell" | "buy" | null;

const ITEMS: { id: Exclude<Action, null>; label: string; icon: any }[] = [
  { id: "sell", label: "Sell", icon: ShoppingCart },
  { id: "outside-sell", label: "Outside Sell", icon: Repeat },
  { id: "buy", label: "Buy", icon: PackagePlus },
];

export default function BottomActionBar() {
  const [active, setActive] = useState<Action>(null);

  return (
    <>
      <nav className="no-print fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md landscape:max-w-3xl border-t border-border-soft bg-bg-elevated/95 backdrop-blur-md px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <div className="grid grid-cols-3 gap-2">
          {ITEMS.map((it) => {
            const Icon = it.icon;
            return (
              <button
                key={it.id}
                onClick={() => setActive(it.id)}
                className="flex flex-col items-center gap-1 rounded-xl py-2 text-ink-muted transition hover:text-gold active:scale-95"
              >
                <Icon size={19} />
                <span className="text-[11px] font-semibold">{it.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <SellSheet open={active === "sell"} onClose={() => setActive(null)} />
      <OutsideSellSheet open={active === "outside-sell"} onClose={() => setActive(null)} />
      <BuySheet open={active === "buy"} onClose={() => setActive(null)} />
    </>
  );
}
