"use client";

import { Apple } from "lucide-react";

// Premium animated top bar: a continuously-scrolling "Welcome to Apple
// Store Satkhira" marquee with a moving Apple mark, sitting above the
// Sidebar (z-30) but below full-screen modal overlays (z-50) so any open
// sheet/camera/scanner still fully covers it. The bar's height is
// safe-area aware; Sidebar's top offset and <main>'s top margin use the
// exact same calc() so nothing overlaps -- keep all three in sync if this
// ever changes: calc(2.25rem + env(safe-area-inset-top)).

// One repeating unit of the marquee. Duplicated many times back-to-back so
// a single strip is always wider than any viewport, then the whole strip
// is duplicated once more (the two <MarqueeGroup /> below) and animated
// from translateX(0) to translateX(-50%) -- a seamless, gap-free loop.
function MarqueeGroup() {
  const items = Array.from({ length: 8 });
  return (
    <div className="flex shrink-0 items-center" aria-hidden="true">
      {items.map((_, i) => (
        <span key={i} className="flex items-center gap-2 px-6 sm:px-8">
          <Apple
            size={15}
            strokeWidth={1.75}
            className="shrink-0 animate-announce-glow text-white"
          />
          <span className="whitespace-nowrap text-[11px] font-medium tracking-[0.12em] sm:text-[12.5px]">
            <span className="text-white/55">Welcome to</span>{" "}
            <span className="font-display font-bold text-white">
              Apple Store Satkhira
            </span>
          </span>
          <span className="h-1 w-1 shrink-0 rounded-full bg-white/30" />
        </span>
      ))}
    </div>
  );
}

export default function AnnouncementBar() {
  return (
    <div className="no-print fixed inset-x-0 top-0 z-40 h-[calc(2.25rem_+_env(safe-area-inset-top))] overflow-hidden bg-[#0a0a0c] pt-[env(safe-area-inset-top)] shadow-[0_1px_24px_rgba(10,132,255,0.35)]">
      {/* Diagonal light sweep -- purely decorative, sits above the text. */}
      <div className="pointer-events-none absolute inset-0 animate-announce-shimmer bg-[length:200%_100%] bg-[linear-gradient(100deg,transparent_40%,rgba(255,255,255,0.16)_50%,transparent_60%)]" />

      <div className="flex h-9 items-center text-white">
        <div className="flex w-max animate-announce-marquee items-center">
          <MarqueeGroup />
          <MarqueeGroup />
        </div>
      </div>
    </div>
  );
}
