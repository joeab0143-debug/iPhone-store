// Client-side photo compression for the Buy flow's NID/person captures.
// Runs entirely in the browser (canvas), so the raw camera shot never
// leaves the device — only the small compressed JPEG data URL gets sent
// to the API and stored in D1. Downscaling to maxDim + a moderate JPEG
// quality keeps each photo roughly in the tens-of-KB range: small enough
// not to bloat the database, but still clearly legible.
export function compressImageFile(
  file: File,
  maxDim = 720,
  quality = 0.55
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Same downscale-and-compress treatment as compressImageFile(), but for a
// live <video> frame from CameraCapture.tsx instead of a File -- this is
// what actually takes the photo once the shop owner taps "Capture".
export function captureVideoFrame(
  video: HTMLVideoElement,
  maxDim = 720,
  quality = 0.55
): string {
  let width = video.videoWidth;
  let height = video.videoHeight;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}
