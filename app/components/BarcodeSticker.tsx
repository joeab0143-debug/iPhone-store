"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export default function BarcodeSticker({
  imei,
  label,
  ramRom,
  batteryHealth,
  price,
  shopName = "Apple Store Satkhira",
  width = 2,
  height = 50,
}: {
  imei: string;
  label?: string;
  ramRom?: string | null;
  batteryHealth?: string | null;
  price?: number | null;
  shopName?: string;
  width?: number;
  height?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !imei) return;
    try {
      JsBarcode(ref.current, imei, {
        format: "CODE128",
        width,
        height,
        displayValue: true,
        fontSize: 13,
        margin: 6,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch (e) {
      // invalid characters etc — ignore render
    }
  }, [imei, width, height]);

  const specLine = [ramRom && `RAM/ROM: ${ramRom}`, batteryHealth && `Battery: ${batteryHealth}`]
    .filter(Boolean)
    .join("  ·  ");

  // Inline styles only (no Tailwind classNames) -- this component's
  // innerHTML gets copied verbatim into a blank print popup window that has
  // no access to the app's Tailwind stylesheet, so className-based sizing
  // here would silently fall back to browser-default (much larger) font
  // sizes there, overflowing the exact-fit print page onto a 2nd sheet.
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        background: "#ffffff",
        borderRadius: 8,
        padding: 8,
        fontFamily: "Arial, Helvetica, sans-serif",
        lineHeight: 1.3,
      }}
    >
      {shopName && (
        <div
          style={{
            textAlign: "center",
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "rgba(0,0,0,0.7)",
          }}
        >
          {shopName}
        </div>
      )}
      {label && (
        <div
          style={{
            marginBottom: 2,
            textAlign: "center",
            fontSize: 11,
            fontWeight: 600,
            color: "#000000",
          }}
        >
          {label}
        </div>
      )}
      {specLine && (
        <div style={{ textAlign: "center", fontSize: 9, color: "rgba(0,0,0,0.8)" }}>
          {specLine}
        </div>
      )}
      {price != null && price > 0 && (
        <div
          style={{
            marginBottom: 4,
            textAlign: "center",
            fontSize: 11,
            fontWeight: 700,
            color: "#000000",
          }}
        >
          ৳{price.toLocaleString()}
        </div>
      )}
      <svg ref={ref} />
    </div>
  );
}
