import type { Metadata, Viewport } from "next";
import "./globals.css";
import OrientationFix from "./components/OrientationFix";

export const metadata: Metadata = {
  title: "iPhone Store",
  description: "মোবাইল শোরুম ম্যানেজমেন্ট — স্টক, খরচ ও প্রফিট এক জায়গায়",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // NOTE: previously also had `maximumScale: 1` here to stop pinch-zoom.
  // Removed — pinning the max scale is a known trigger for an Android
  // Chrome/WebView bug where the page doesn't repaint at the new size
  // after rotating the phone, leaving a blank strip on the new side until
  // touched. text-size-adjust in globals.css now handles the original
  // "text grows/shrinks on rotate" problem without needing this.
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bn">
      <body>
        <OrientationFix />
        {children}
      </body>
    </html>
  );
}
