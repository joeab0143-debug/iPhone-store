import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Shared PDF report builder for the "PDF ডাউনলোড" buttons on the Expense,
// Profit and Stock tabs. Mirrors the visual language of lib/invoice.ts
// (gold header band, same color palette) but uses a normal A4 page + a
// jspdf-autotable table instead of the narrow receipt layout, since these
// are full reports rather than a single-sale memo.
//
// IMPORTANT: exactly like invoice.ts, every fixed label here is English —
// jsPDF's built-in "helvetica" font has no Bengali glyphs, so any Bengali
// text handed to doc.text()/autoTable() renders as garbled boxes. Dynamic
// content (category names, phone models, notes the shop owner typed) is
// passed through as-is; if it's Bengali it will have the same rendering
// limitation the existing sales receipts already have for Bengali customer
// names — a known trade-off, not something introduced here.

const GOLD: [number, number, number] = [242, 183, 5];
const INK_DARK: [number, number, number] = [26, 20, 0];
const INK: [number, number, number] = [30, 30, 30];
const INK_MUTED: [number, number, number] = [120, 120, 120];
const INK_UP: [number, number, number] = [30, 130, 76];
const INK_DOWN: [number, number, number] = [193, 42, 42];
const BORDER: [number, number, number] = [225, 222, 214];
const CARD_BG: [number, number, number] = [250, 249, 246];

export interface ReportSummaryItem {
  label: string;
  value: string;
  tone?: "up" | "down" | "default";
}

export interface ReportTableSpec {
  head: string[];
  rows: (string | number)[][];
  /** Shown instead of the table when rows is empty. */
  emptyLabel?: string;
}

export interface ReportData {
  shopName: string;
  /** e.g. "Expense Report" — kept in English, see file header note. */
  title: string;
  /** e.g. "September 2026" or "All time". */
  subtitle?: string;
  summary?: ReportSummaryItem[];
  table?: ReportTableSpec;
  footerNote?: string;
}

function formatReportDate(d = new Date()): string {
  // English month/Latin digits only — same reasoning as invoice.ts.
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Builds a report PDF and opens it in a new tab as a print preview (same
 * pattern as generateInvoicePDF). Pass `previewWindow` — a window opened
 * with window.open("", "_blank") synchronously inside the triggering
 * button's onClick, BEFORE any await — so the popup blocker doesn't catch
 * it. Falls back to a plain download if no window (or a blocked one) is
 * passed in.
 */
export function generateReportPDF(data: ReportData, previewWindow?: Window | null) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 40;
  const contentW = pageW - marginX * 2;
  let y = 0;

  // ---- Header band ----
  const headerH = 68;
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, pageW, headerH, "F");
  doc.setTextColor(...INK_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(data.shopName, marginX, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(data.title.toUpperCase(), marginX, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Generated: ${formatReportDate()}`, pageW - marginX, 28, { align: "right" });
  if (data.subtitle) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(data.subtitle, pageW - marginX, 46, { align: "right" });
  }

  y = headerH + 26;

  // ---- Summary cards (2 per row) ----
  if (data.summary && data.summary.length > 0) {
    const cols = 2;
    const gap = 12;
    const boxW = (contentW - gap * (cols - 1)) / cols;
    const boxH = 42;
    data.summary.forEach((item, i) => {
      const col = i % cols;
      const rowIdx = Math.floor(i / cols);
      const bx = marginX + col * (boxW + gap);
      const by = y + rowIdx * (boxH + gap);
      doc.setDrawColor(...BORDER);
      doc.setFillColor(...CARD_BG);
      doc.roundedRect(bx, by, boxW, boxH, 6, 6, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK_MUTED);
      doc.text(item.label, bx + 12, by + 16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      const tc = item.tone === "down" ? INK_DOWN : item.tone === "up" ? INK_UP : INK;
      doc.setTextColor(...tc);
      doc.text(item.value, bx + 12, by + 33);
    });
    const rowsCount = Math.ceil(data.summary.length / cols);
    y += rowsCount * (boxH + gap) + 12;
  }

  // ---- Table ----
  if (data.table) {
    if (data.table.rows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [data.table.head],
        body: data.table.rows,
        margin: { left: marginX, right: marginX },
        styles: {
          font: "helvetica",
          fontSize: 9,
          textColor: INK,
          lineColor: BORDER,
          lineWidth: 0.5,
          cellPadding: 6,
        },
        headStyles: {
          fillColor: GOLD,
          textColor: INK_DARK,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: CARD_BG },
      });
      // @ts-expect-error - lastAutoTable is attached by the plugin at runtime
      y = (doc.lastAutoTable?.finalY ?? y) + 20;
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(...INK_MUTED);
      doc.text(data.table.emptyLabel || "No entries", marginX, y + 16);
      y += 40;
    }
  }

  if (data.footerNote) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...INK_MUTED);
    doc.text(data.footerNote, marginX, y);
  }

  const safeTitle = data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const safeSub = data.subtitle ? "-" + data.subtitle.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "";
  const filename = `${safeTitle}${safeSub}.pdf`;

  if (previewWindow && !previewWindow.closed) {
    const blobUrl = doc.output("bloburl") as unknown as string;
    previewWindow.location.href = blobUrl;
  } else {
    doc.save(filename);
  }
}
