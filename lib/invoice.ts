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
}

const GOLD: [number, number, number] = [242, 183, 5];
const INK_DARK: [number, number, number] = [26, 20, 0];
const INK: [number, number, number] = [30, 30, 30];
const INK_MUTED: [number, number, number] = [120, 120, 120];
const BORDER: [number, number, number] = [225, 222, 214];
const HIGHLIGHT: [number, number, number] = [252, 244, 214];

function formatReceiptDate(input: string): string {
  if (!input) return "-";
  const d = new Date(input.replace(" ", "T"));
  if (isNaN(d.getTime())) return input;
  // English month/Latin digits only — jsPDF's core fonts have no Bengali glyphs.
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function generateInvoicePDF(data: InvoiceData) {
  const pageW = 300;
  const doc = new jsPDF({ unit: "pt", format: [pageW, 460] }); // receipt-style narrow page
  const marginX = 24;
  const contentW = pageW - marginX * 2;
  let y: number;

  // ---- Header band ----
  const headerH = 74;
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

  row("Receipt #", `INV-${data.saleId}`);
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
  doc.text(`IMEI: ${data.imei}`, marginX, y);
  y += 18;

  // ---- Price highlight box ----
  const boxRowCount = data.isDue ? 3 : 2;
  const boxPadTop = 14;
  const boxPadBottom = 12;
  const boxRowH = 18;
  const boxH = boxPadTop + boxRowCount * boxRowH + boxPadBottom;
  doc.setFillColor(...HIGHLIGHT);
  doc.rect(marginX, y, contentW, boxH, "F");

  let ty = y + boxPadTop + 11;
  doc.setFontSize(10);
  const boxRow = (label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK_MUTED);
    doc.text(label, marginX + 12, ty);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(value, pageW - marginX - 12, ty, { align: "right" });
    ty += boxRowH;
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
  if (data.customerName || data.customerPhone) {
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
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK_MUTED);
  doc.text("Thank you for your purchase!", pageW / 2, y, { align: "center" });

  doc.save(`invoice-${data.saleId}.pdf`);
}
