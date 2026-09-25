"use client";

import { useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, RotateCcw, Upload, X } from "lucide-react";
import { Button } from "./ui";
import { useLang } from "@/lib/i18n";
import { captureVideoFrame, compressImageFile } from "@/lib/image";

// A real live-camera capture flow (getUserMedia -> <video> preview ->
// snapshot to canvas), used everywhere the app needs a fresh photo the
// owner takes right now (NID card sides, person's photo) -- not a picture
// picked from the gallery. The plain `<input type="file" capture>`
// attribute only forces the camera on some mobile browsers; on desktop
// Chrome (and plenty of Android/iOS versions too) it just opens the
// regular file/gallery picker, which is exactly the bug this replaces.
//
// If the camera genuinely can't be reached (no device, permission denied),
// a "choose from device" fallback still lets the flow complete instead of
// being a dead end -- see the `error` branch below.
export default function CameraCapture({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
}) {
  const { t } = useLang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }

  async function startStream() {
    setError("");
    try {
      // `ideal` (not a hard constraint) so it still works on a desktop
      // webcam, which has no "environment" facing side to satisfy.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setError(t("camera.unavailable"));
    }
  }

  useEffect(() => {
    setPreview(null);
    if (open) {
      startStream();
    } else {
      stopStream();
    }
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const dataUrl = captureVideoFrame(video);
    if (!dataUrl) return;
    setPreview(dataUrl);
    stopStream();
  }

  function retake() {
    setPreview(null);
    startStream();
  }

  function confirm() {
    if (!preview) return;
    onCapture(preview);
    handleClose();
  }

  async function handleFallbackFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await compressImageFile(file);
    onCapture(dataUrl);
    handleClose();
  }

  function handleClose() {
    stopStream();
    setPreview(null);
    setError("");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h3 className="font-display text-lg font-semibold">{t("camera.heading")}</h3>
        <button
          onClick={handleClose}
          className="rounded-full p-1.5 text-ink-muted hover:bg-surface-2"
        >
          <X size={22} />
        </button>
      </div>

      <div className="flex-1 px-4 pt-4">
        {error ? (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="mb-4 text-sm text-down">{error}</p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm font-semibold text-teal">
              <Upload size={16} />
              {t("camera.upload_instead")}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFallbackFile}
              />
            </label>
          </div>
        ) : preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="max-h-[60vh] w-full rounded-2xl border border-border bg-black object-contain"
          />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="min-h-[280px] max-h-[60vh] w-full rounded-2xl border border-border bg-black object-contain"
          />
        )}
      </div>

      <div className="p-4">
        {error ? null : preview ? (
          <div className="flex gap-2">
            <Button full variant="secondary" onClick={retake}>
              <RotateCcw size={16} /> {t("camera.retake")}
            </Button>
            <Button full onClick={confirm}>
              {t("camera.use_photo")}
            </Button>
          </div>
        ) : (
          <Button full onClick={capture}>
            <CameraIcon size={16} /> {t("camera.capture")}
          </Button>
        )}
      </div>

      {!error && (
        <p className="px-4 pb-4 text-center text-xs text-ink-faint">
          {t("camera.permission_note")}
        </p>
      )}
    </div>
  );
}
