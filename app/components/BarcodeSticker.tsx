"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export default function BarcodeSticker({
  imei,
  label,
  ramRom,
  batteryHealth,
  width = 2,
  height = 50,
}: {
  imei: string;
  label?: string;
  ramRom?: string | null;
  batteryHealth?: string | null;
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

  return (
    <div className="inline-flex flex-col items-center bg-white rounded-lg p-2">
      {label && (
        <div className="mb-0.5 text-center text-[11px] font-semibold text-black">{label}</div>
      )}
      {specLine && (
        <div className="mb-1 text-center text-[9px] text-black/80">{specLine}</div>
      )}
      <svg ref={ref} />
    </div>
  );
}
