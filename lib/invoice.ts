import jsPDF from "jspdf";

export interface InvoiceData {
  saleId: number;
  shopName: string;
  nameModel: string;
  imei: string;
  sellingPrice: number;
  /** Raw date string (e.g. "2026-08-31 16:14:53" or an ISO string) — formatted
   * internally as English/Latin text, since jsPDF's built-in fonts can't
   * render Bengali glyphs (a pre-formatted Bengali string renders as garbage). */
  sellingDate: string;
  isDue: boolean;
  customerName?: string | null;
  customerPhone?: string | null;
  paidAmount: number;
  dueAmount: number;
  /** True when this memo documents a phone being returned to stock — same
   * layout as the original sales receipt, with a RETURNED stamp at the
   * bottom instead of the thank-you line. */
  isReturn?: boolean;
  /** Optional extra details captured at sale time. Each only appears on the
   * receipt when it was actually filled in. */
  ramRom?: string | null;
  batteryHealth?: string | null;
}

const GOLD: [number, number, number] = [242, 183, 5];
const INK_DARK: [number, number, number] = [26, 20, 0];
const INK: [number, number, number] = [30, 30, 30];
const INK_MUTED: [number, number, number] = [120, 120, 120];
const INK_DOWN: [number, number, number] = [193, 42, 42];
const BORDER: [number, number, number] = [225, 222, 214];
const HIGHLIGHT: [number, number, number] = [252, 244, 214];

function formatReceiptDate(input: string): string {
  if (!input) return "-";
  const d = new Date(input.replace(" ", "T"));
  if (isNaN(d.getTime())) return input;
  // English month/Latin digits only — jsPDF's core fonts have no Bengali glyphs.
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Builds the sales/return receipt and opens it in a new tab as a print
 * preview (instead of silently auto-downloading) — the user reviews it there
 * and prints with the browser/PDF viewer's own print command.
 *
 * IMPORTANT: pass `previewWindow` — a window opened with
 * `window.open("", "_blank")` synchronously, as the very first thing inside
 * the button's onClick, BEFORE any `await`. Browsers only allow window.open
 * to bypass the popup blocker when it's called directly inside a user
 * gesture; once an `await` runs, that gesture is gone and a fresh
 * window.open() call would be blocked. Opening the blank tab first (still
 * inside the gesture) and later pointing it at the finished PDF sidesteps
 * that. If no window (or a blocked one) is passed in, this falls back to a
 * normal file download so the user still gets the receipt.
 */
export function generateInvoicePDF(data: InvoiceData, previewWindow?: Window | null) {
  const pageW = 300;
  const marginX = 24;
  const contentW = pageW - marginX * 2;

  // Extra detail lines under the item name — only the ones actually filled in.
  const detailLines: string[] = [`IMEI: ${data.imei}`];
  if (data.ramRom) detailLines.push(`RAM/ROM: ${data.ramRom}`);
  if (data.batteryHealth) detailLines.push(`Battery Health: ${data.batteryHealth}`);

  const hasCustomer = !!(data.customerName || data.customerPhone);
  const customerLineCount = (data.customerName ? 1 : 0) + (data.customerPhone ? 1 : 0);

  // ---- Compute the exact page height this receipt needs, top to bottom,
  // so optional lines (RAM/ROM, Battery Health, Customer) never get cut off
  // or leave a big empty gap. ----
  const headerH = 74;
  const boxRowCount = data.isDue ? 3 : 2;
  const boxH = 14 + boxRowCount * 18 + 12;
  let height = headerH + 26; // header band + gap before meta
  height += 16 * 2; // Receipt # + Date rows
  height += 4 + 22; // divider + gap
  height += 15; // item name line
  height += detailLines.length * 13; // IMEI / RAM-ROM / Battery Health
  height += 5 + boxH + 20; // gap + price box + gap
  if (hasCustomer) {
    height += 20 + customerLineCount * 16 + 4;
  }
  height += 6 + 24 + 20 + 20; // footer divider + stamp line + bottom margin

  const doc = new jsPDF({ unit: "pt", format: [pageW, height] });
  let y: number;

  // ---- Header band ----
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, pageW, headerH, "F");
  doc.setTextColor(...INK_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text(data.shopName, pageW / 2, 34, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("S A L E S   R E C E I P T", pageW / 2, 52, { align: "center" });

  y = headerH + 26;

  // ---- Receipt meta ----
  doc.setFontSize(10);
  const row = (label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK_MUTED);
    doc.text(label, marginX, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(value, pageW - marginX, y, { align: "right" });
    y += 16;
  };

  row("Receipt #", `${data.isReturn ? "RTN" : "INV"}-${data.saleId}`);
  row("Date", formatReceiptDate(data.sellingDate));

  y += 4;
  doc.setDrawColor(...BORDER);
  doc.line(marginX, y, pageW - marginX, y);
  y += 22;

  // ---- Item ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(data.nameModel, marginX, y);
  y += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK_MUTED);
  for (const line of detailLines) {
    doc.text(line, marginX, y);
    y += 13;
  }
  y += 5;

  // ---- Price highlight box ----
  doc.setFillColor(...HIGHLIGHT);
  doc.rect(marginX, y, contentW, boxH, "F");

  let ty = y + 14 + 11;
  doc.setFontSize(10);
  const boxRow = (label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK_MUTED);
    doc.text(label, marginX + 12, ty);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(value, pageW - marginX - 12, ty, { align: "right" });
    ty += 18;
  };

  boxRow("Selling Price", `${data.sellingPrice.toLocaleString()} Tk`);
  if (data.isDue) {
    boxRow("Paid", `${data.paidAmount.toLocaleString()} Tk`);
    boxRow("Due", `${data.dueAmount.toLocaleString()} Tk`);
  } else {
    boxRow("Payment", "Cash");
  }
  y += boxH + 20;

  // ---- Customer ----
  if (hasCustomer) {
    doc.setDrawColor(...BORDER);
    doc.line(marginX, y, pageW - marginX, y);
    y += 20;
    if (data.customerName) row("Customer", data.customerName);
    if (data.customerPhone) row("Phone", data.customerPhone);
    y += 4;
  }

  // ---- Footer ----
  y += 6;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.5);
  doc.line(marginX, y, pageW - marginX, y);
  doc.setLineWidth(1);
  y += 24;
  if (data.isReturn) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK_DOWN);
    doc.text("R E T U R N E D", pageW / 2, y, { align: "center" });
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK_MUTED);
    doc.text("Thank you for your purchase!", pageW / 2, y, { align: "center" });
  }

  const filename = `${data.isReturn ? "return" : "invoice"}-${data.saleId}.pdf`;

  if (previewWindow && !previewWindow.closed) {
    const blobUrl = doc.output("bloburl") as unknown as string;
    previewWindow.location.href = blobUrl;
  } else {
    // No pre-opened tab (popup was blocked, or caller didn't pass one) —
    // fall back to a plain download so the receipt is never lost.
    doc.save(filename);
  }
}
