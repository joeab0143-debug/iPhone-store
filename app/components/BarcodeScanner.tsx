"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Keyboard, X } from "lucide-react";
import { Button, inputClass } from "./ui";
import { useLang } from "@/lib/i18n";

export default function BarcodeScanner({
  open,
  onClose,
  onResult,
}: {
  open: boolean;
  onClose: () => void;
  onResult: (code: string) => void;
}) {
  const { t } = useLang();
  const [mode, setMode] = useState<"camera" | "hardware">("hardware");
  const [manualValue, setManualValue] = useState("");
  const scannerElRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hardware scanner: focus a text input; scanners type fast + send Enter.
  useEffect(() => {
    if (open && mode === "hardware") {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open, mode]);

  // Camera scanner lifecycle
  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!open || mode !== "camera" || !scannerElRef.current) return;
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      const id = "barcode-scan-region";
      const el = document.getElementById(id);
      if (!el) return;
      const scanner = new Html5Qrcode(id, { verbose: false });
      html5QrRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: { width: 260, height: 140 } },
          (decodedText: string) => {
            onResult(decodedText);
            stop();
          },
          () => {
            /* ignore per-frame scan errors */
          }
        );
      } catch (e) {
        // camera unavailable / permission denied
      }
    }
    async function stop() {
      if (html5QrRef.current) {
        try {
          await html5QrRef.current.stop();
          html5QrRef.current.clear();
        } catch {}
        html5QrRef.current = null;
      }
    }
    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, mode]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h3 className="font-display text-lg font-semibold">{t("scanner.heading")}</h3>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-ink-muted hover:bg-surface-2"
        >
          <X size={22} />
        </button>
      </div>

      <div className="flex gap-2 p-4">
        <button
          onClick={() => setMode("hardware")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold border ${
            mode === "hardware"
              ? "bg-teal/15 border-teal text-teal"
              : "border-border text-ink-muted"
          }`}
        >
          <Keyboard size={16} /> {t("scanner.hardware_mode")}
        </button>
        <button
          onClick={() => setMode("camera")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold border ${
            mode === "camera"
              ? "bg-teal/15 border-teal text-teal"
              : "border-border text-ink-muted"
          }`}
        >
          <Camera size={16} /> {t("scanner.camera_mode")}
        </button>
      </div>

      <div className="flex-1 px-4">
        {mode === "camera" ? (
          <div
            id="barcode-scan-region"
            ref={scannerElRef}
            className="w-full overflow-hidden rounded-2xl border border-border bg-black min-h-[280px]"
          />
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-5 text-center">
            <p className="mb-4 text-sm text-ink-muted">{t("scanner.hardware_hint")}</p>
            <input
              ref={inputRef}
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manualValue.trim()) {
                  onResult(manualValue.trim());
                  setManualValue("");
                }
              }}
              placeholder={t("scanner.hardware_placeholder")}
              className={inputClass + " text-center text-lg"}
              autoFocus
            />
            <div className="mt-4">
              <Button
                full
                onClick={() => {
                  if (manualValue.trim()) {
                    onResult(manualValue.trim());
                    setManualValue("");
                  }
                }}
              >
                {t("scanner.search_button")}
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="p-4 text-center text-xs text-ink-faint">
        {t("scanner.camera_permission_note")}
      </p>
    </div>
  );
}
