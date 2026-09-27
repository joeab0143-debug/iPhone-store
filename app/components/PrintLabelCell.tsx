"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

// A single physical print label, fixed at 1.5in x 2in -- the exact size the
// shop's label stock is cut to. Unlike BarcodeSticker.tsx (which
// shrink-wraps to its content, for the free-size single-sticker preview),
// this always renders at the same physical footprint so many of them can be
// tiled into a grid on one A4 sheet without any scaling. Inline styles only
// (same reasoning as BarcodeSticker.tsx): the rendered outerHTML is copied
// verbatim into stylesheet-less print popup windows, both for a single
// label and for the print-queue grid.
export default function PrintLabelCell({
  imei,
  label,
  ramRom,
  batteryHealth,
  shopName = "Apple Store Satkhira",
}: {
  imei: string;
  label?: string;
  ramRom?: string | null;
  batteryHealth?: string | null;
  shopName?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !imei) return;
    try {
      JsBarcode(ref.current, imei, {
        format: "CODE128",
        width: 0.9,
        height: 95,
        displayValue: true,
        fontSize: 9,
        margin: 3,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch (e) {
      // Invalid/empty IMEI -- leave the <svg> empty rather than crash.
    }
  }, [imei]);

  const specLine = [
    ramRom && `RAM/ROM: ${ramRom}`,
    batteryHealth && `Battery: ${batteryHealth}`,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div
      style={{
        width: "1.5in",
        height: "2in",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: 6,
        background: "#ffffff",
        fontFamily: "Arial, Helvetica, sans-serif",
        overflow: "hidden",
      }}
    >
      {shopName && (
        <div
          style={{
            textAlign: "center",
            fontSize: 8,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "rgba(0,0,0,0.7)",
            whiteSpace: "nowrap",
          }}
        >
          {shopName}
        </div>
      )}
      {label && (
        <div
          style={{
            textAlign: "center",
            fontSize: 11,
            fontWeight: 700,
            color: "#000000",
          }}
        >
          {label}
        </div>
      )}
      {specLine && (
        <div
          style={{
            textAlign: "center",
            fontSize: 8,
            color: "rgba(0,0,0,0.85)",
          }}
        >
          {specLine}
        </div>
      )}
      <svg ref={ref} />
    </div>
  );
}
