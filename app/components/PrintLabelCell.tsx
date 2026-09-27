"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

// A single physical print label, fixed at 1.5in x 1.46in -- a compact
// landscape size meant to sit on top of a phone box. 1.46in (= 11.69in A4
// height / 8) was picked so exactly 40 labels (5 columns x 8 rows) fill one
// A4 sheet with room to spare for every detail on the label to stay
// legible, rather than packing the max the sheet can physically hold.
// Unlike BarcodeSticker.tsx (which shrink-wraps to its content, for the
// free-size single-sticker preview), this always renders at the same
// physical footprint so many of them can be tiled into a grid on one A4
// sheet without any scaling. Inline styles only (same reasoning as
// BarcodeSticker.tsx): the rendered outerHTML is copied verbatim into
// stylesheet-less print popup windows, both for a single label and for the
// print-queue grid.
//
// The barcode itself is drawn in two passes so it always comes out at
// roughly the same physical width no matter how many digits the IMEI has
// (an IMEI is usually 15 digits, but this keeps it robust either way):
// pass 1 renders at a baseline module width just to measure how wide that
// many digits happen to render; pass 2 re-renders at whatever module width
// brings the result to TARGET_BARCODE_WIDTH_PX -- so a longer number gets
// thinner bars instead of a wider barcode, keeping every label neat and
// consistent.
const TARGET_BARCODE_WIDTH_PX = 125; // ~1.3in at 96dpi
const BAR_HEIGHT = 46;
const BARCODE_FONT_SIZE = 8;

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
      const svg = ref.current;
      // Pass 1: baseline module width, just to measure this IMEI's natural
      // rendered width.
      JsBarcode(svg, imei, {
        format: "CODE128",
        width: 1,
        height: BAR_HEIGHT,
        displayValue: true,
        fontSize: BARCODE_FONT_SIZE,
        margin: 2,
        background: "#ffffff",
        lineColor: "#000000",
      });
      const measured = svg.getBBox().width;
      if (measured > 0) {
        const scale = TARGET_BARCODE_WIDTH_PX / measured;
        // Clamped so it never gets so thin it stops scanning, or so thick
        // it overflows the label for an unusually short code.
        const moduleWidth = Math.min(1.4, Math.max(0.3, scale));
        // Pass 2: redraw at the module width that lands this specific
        // IMEI's barcode at the target width.
        JsBarcode(svg, imei, {
          format: "CODE128",
          width: moduleWidth,
          height: BAR_HEIGHT,
          displayValue: true,
          fontSize: BARCODE_FONT_SIZE,
          margin: 2,
          background: "#ffffff",
          lineColor: "#000000",
        });
      }
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
        height: "1.46in",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        padding: 5,
        background: "#ffffff",
        fontFamily: "Arial, Helvetica, sans-serif",
        overflow: "hidden",
      }}
    >
      {shopName && (
        <div
          style={{
            textAlign: "center",
            fontSize: 7,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            color: "rgba(0,0,0,0.65)",
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
            lineHeight: 1.15,
            maxWidth: "100%",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {label}
        </div>
      )}
      {specLine && (
        <div
          style={{
            textAlign: "center",
            fontSize: 7,
            color: "rgba(0,0,0,0.8)",
            whiteSpace: "nowrap",
          }}
        >
          {specLine}
        </div>
      )}
      <svg ref={ref} />
    </div>
  );
}
