import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Full A4 "Sales Invoice" memo -- built to match a printed template the
// shop owner supplied (a tabular invoice with customer/meta blocks, a
// product table, a Taka-in-words line, a totals box, and a PAID/DUE stamp),
// replacing the old narrow thermal-receipt-style memo in lib/invoice.ts.
//
// Like invoice.ts and report-pdf.ts, every fixed label here is English --
// jsPDF's built-in "helvetica" font has no Bengali glyphs. Dynamic content
// (names, models, notes) passes through as-is.

const INK_DARK: [number, number, number] = [26, 20, 0];
const INK: [number, number, number] = [30, 30, 30];
const INK_MUTED: [number, number, number] = [120, 120, 120];
const INK_FAINT: [number, number, number] = [160, 160, 160];
const GOLD: [number, number, number] = [242, 183, 5];
const BORDER: [number, number, number] = [210, 206, 195];
const STAMP_PAID: [number, number, number] = [30, 130, 76];
const STAMP_DUE: [number, number, number] = [193, 42, 42];
const STAMP_RETURN: [number, number, number] = [193, 42, 42];

export interface SalesInvoiceData {
  saleId: number;
  shopName: string;
  shopAddress?: string | null;
  shopPhone?: string | null;
  shopEmail?: string | null;
  nameModel: string;
  imei: string;
  ramRom?: string | null;
  batteryHealth?: string | null;
  sellingPrice: number;
  /** Raw date string -- formatted internally as English/Latin text. */
  sellingDate: string;
  isDue: boolean;
  paidAmount: number;
  dueAmount: number;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerEmail?: string | null;
  narration?: string | null;
  isReturn?: boolean;
  /** Logged-in username at print time -- shown as both Prepared By and
   * Sales Person, same as the sample template. */
  preparedBy?: string | null;
  /** Settings -> Shop / Invoice Info -- printed as a numbered list below
   * the PAID/DUE stamp (return/warranty policy notices, etc.). */
  noticeLines?: string[] | null;
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
  "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? " " + ONES[o] : "");
}

function threeDigitWords(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let s = "";
  if (h) s += ONES[h] + " Hundred";
  if (r) s += (s ? " " : "") + twoDigitWords(r);
  return s;
}

/** Converts a Taka amount to English words, Bangladeshi (crore/lakh) grouping. */
export function amountInWords(amount: number): string {
  let n = Math.round(Math.abs(amount));
  if (n === 0) return "Zero Taka Only";
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const rest = n;
  const parts: string[] = [];
  if (crore) parts.push(threeDigitWords(crore) + " Crore");
  if (lakh) parts.push(twoDigitWords(lakh) + " Lakh");
  if (thousand) parts.push(twoDigitWords(thousand) + " Thousand");
  if (rest) parts.push(threeDigitWords(rest));
  return parts.join(" ") + " Taka Only";
}

/**
 * Formats a whole-Taka amount with South Asian (Bangladeshi/Indian)
 * digit grouping -- the last 3 digits together, then groups of 2 to the
 * left (e.g. 200000 -> "2,00,000", 1234567 -> "12,34,567") -- instead of
 * the Western "200,000" that Number.toLocaleString() produces.
 */
function formatTaka(amount: number): string {
  const n = Math.round(amount);
  const sign = n < 0 ? "-" : "";
  const s = Math.abs(n).toString();
  if (s.length <= 3) return sign + s;
  const lastThree = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return sign + grouped + "," + lastThree;
}

function formatInvoiceDate(input: string): string {
  if (!input) return "-";
  const d = new Date(input.replace(" ", "T"));
  if (isNaN(d.getTime())) return input;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatInvoiceDateTime(input: string): string {
  if (!input) return "-";
  const d = new Date(input.replace(" ", "T"));
  if (isNaN(d.getTime())) return input;
  return (
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

function drawStamp(
  doc: jsPDF,
  cx: number,
  cy: number,
  label: string,
  color: [number, number, number],
  dateStr: string
) {
  const w = 118;
  const h = 50;
  doc.setDrawColor(...color);
  doc.setLineWidth(1.4);
  doc.roundedRect(cx - w / 2, cy - h / 2, w, h, 5, 5, "S");
  doc.setTextColor(...color);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(label, cx, cy - 4, { align: "center", angle: -8 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(dateStr, cx, cy + 14, { align: "center", angle: -8 });
}

// The shop's own logo, printed very faintly across the middle of the page
// as a background watermark (see /public/apple-store-watermark.png --
// pre-cropped to just the mark + wordmark, alpha already reduced to ~10%
// so it sits behind the invoice content without hurting readability).
// Cached after the first load since the same asset is reused for every
// print in a session (Sell, Reprint, Return all call this).
let cachedWatermarkImg: HTMLImageElement | null | undefined;
function loadWatermarkLogo(): Promise<HTMLImageElement | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (cachedWatermarkImg !== undefined) return Promise.resolve(cachedWatermarkImg);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      cachedWatermarkImg = img;
      resolve(img);
    };
    img.onerror = () => {
      cachedWatermarkImg = null;
      resolve(null);
    };
    img.src = "/apple-store-watermark.png";
  });
}

/**
 * Builds the A4 Sales Invoice memo and opens it in a new tab as a print
 * preview. Pass `previewWindow` -- a window opened with
 * window.open("", "_blank") synchronously inside the triggering button's
 * onClick, BEFORE any await -- so the popup blocker doesn't catch it.
 * Falls back to a plain download if no window (or a blocked one) is passed.
 */
export async function generateSalesInvoicePDF(data: SalesInvoiceData, previewWindow?: Window | null) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 42;
  const contentW = pageW - marginX * 2;
  let y = 36;

  // ---- Background watermark (shop logo, very faint) -- drawn first so
  // everything else prints on top of it. ----
  const watermarkImg = await loadWatermarkLogo();
  if (watermarkImg) {
    const wmW = 320;
    const wmH = wmW * (watermarkImg.naturalHeight / watermarkImg.naturalWidth);
    doc.addImage(watermarkImg, "PNG", (pageW - wmW) / 2, (pageH - wmH) / 2, wmW, wmH);
  }

  // ---- Shop header (no logo -- text only) ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...INK_DARK);
  doc.text(data.shopName, pageW / 2, y, { align: "center" });
  y += 20;

  // Address / Phone / Email as three separate left-aligned lines (each
  // only printed when set in Settings -> Shop / Invoice Info).
  const contactRows: [string, string][] = (
    [
      ["Address", data.shopAddress],
      ["Phone", data.shopPhone],
      ["Email", data.shopEmail],
    ] as [string, string | null | undefined][]
  ).filter(([, v]) => !!v) as [string, string][];
  if (contactRows.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK_MUTED);
    for (const [label, value] of contactRows) {
      doc.text(`${label}: ${value}`, marginX, y);
      y += 12;
    }
    y += 2;
  }

  y += 6;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(2);
  doc.line(marginX, y, pageW - marginX, y);
  doc.setLineWidth(1);
  y += 22;

  // ---- Title ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(data.isReturn ? "Return Memo" : "Sales Invoice", marginX, y);
  y += 16;

  // ---- Customer block (left) + meta block (right), as two-column grids ----
  const gap = 20;
  const colW = (contentW - gap) / 2;
  const leftX = marginX;
  const rightX = marginX + colW + gap;

  const invoiceNo = `${data.isReturn ? "RTN" : "INV"}-${data.saleId}`;
  const billStatus = data.isReturn ? "Returned" : data.isDue ? "Due" : "Paid";
  const paymentDate = !data.isReturn && !data.isDue ? formatInvoiceDate(data.sellingDate) : "-";

  const leftRows: [string, string][] = [
    ["Customer", data.customerName || "-"],
    ["Address", data.customerAddress || "-"],
    ["Mobile", data.customerPhone || "-"],
    ["Email", data.customerEmail || "-"],
    ["Narration", data.narration || "-"],
  ];
  const rightRows: [string, string][] = [
    ["Invoice No", invoiceNo],
    ["Date", formatInvoiceDate(data.sellingDate)],
    ["Prepared By", data.preparedBy || "-"],
    ["Entry Time", formatInvoiceDateTime(data.sellingDate)],
    ["Bill Status", billStatus],
    ["Payment Date", paymentDate],
    ["Sales Person", data.preparedBy || "-"],
  ];

  const gridRowH = 15;
  const gridStartY = y;

  function drawGrid(rows: [string, string][], x: number, w: number) {
    let gy = gridStartY;
    for (const [label, value] of rows) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...INK_MUTED);
      doc.text(label, x, gy);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...INK);
      doc.text(value, x + w, gy, { align: "right" });
      gy += gridRowH;
    }
    return gy;
  }

  const leftEndY = drawGrid(leftRows, leftX, colW);
  const rightEndY = drawGrid(rightRows, rightX, colW);
  y = Math.max(leftEndY, rightEndY) + 10;

  doc.setDrawColor(...BORDER);
  doc.line(marginX, y, pageW - marginX, y);
  y += 18;

  // ---- Product table ----
  const detailBits = [`IMEI: ${data.imei}`];
  if (data.ramRom) detailBits.push(`RAM/ROM: ${data.ramRom}`);
  if (data.batteryHealth) detailBits.push(`Battery Health: ${data.batteryHealth}`);
  const description = `${data.nameModel}\n${detailBits.join("  |  ")}`;

  autoTable(doc, {
    startY: y,
    head: [["SL", "Product Description", "Warranty", "Qty", "Unit", "Unit Price", "Discount", "Amount"]],
    body: [["1", description, "-", "1.00", "Pcs", formatTaka(data.sellingPrice), "0.00", formatTaka(data.sellingPrice)]],
    margin: { left: marginX, right: marginX },
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: INK,
      lineColor: BORDER,
      lineWidth: 0.5,
      cellPadding: 6,
      valign: "top",
    },
    headStyles: { fillColor: GOLD, textColor: INK_DARK, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 26 },
      2: { cellWidth: 48, halign: "center" },
      3: { cellWidth: 34, halign: "right" },
      4: { cellWidth: 32, halign: "center" },
      5: { cellWidth: 70, halign: "right" },
      6: { cellWidth: 55, halign: "right" },
      7: { cellWidth: 70, halign: "right" },
    },
  });
  // @ts-expect-error -- lastAutoTable is attached by the plugin at runtime
  y = (doc.lastAutoTable?.finalY ?? y) + 18;

  // ---- Total Qty + Taka in words (left) / Totals box (right) ----
  const boxW = 210;
  const boxX = pageW - marginX - boxW;
  const totalsRows: [string, string][] = data.isDue
    ? [
        ["Total Amount", formatTaka(data.sellingPrice)],
        ["Paid Amount", formatTaka(data.paidAmount)],
        ["Due Amount", formatTaka(data.dueAmount)],
        ["Net Payable Amount", formatTaka(data.sellingPrice)],
      ]
    : [
        ["Total Amount", formatTaka(data.sellingPrice)],
        ["Less Discount", "0.00"],
        ["Add Extra Charges", "0.00"],
        ["Net Payable Amount", formatTaka(data.sellingPrice)],
      ];
  const totalsRowH = 16;
  const boxH = 14 + totalsRows.length * totalsRowH;
  const boxY = y;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK_MUTED);
  doc.text("Total Qty", leftX, y + 12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text("1.00", leftX + 70, y + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK_MUTED);
  doc.text("Taka In Word", leftX, y + 32);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  const wordsLines = doc.splitTextToSize(amountInWords(data.sellingPrice), colW);
  doc.text(wordsLines, leftX, y + 46);

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.75);
  doc.rect(boxX, boxY, boxW, boxH, "S");
  let ty = boxY + 14;
  totalsRows.forEach(([label, value], i) => {
    const isLast = i === totalsRows.length - 1;
    doc.setFont("helvetica", isLast ? "bold" : "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(isLast ? INK_DARK[0] : INK_MUTED[0], isLast ? INK_DARK[1] : INK_MUTED[1], isLast ? INK_DARK[2] : INK_MUTED[2]);
    doc.text(label, boxX + 10, ty);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(value, boxX + boxW - 10, ty, { align: "right" });
    ty += totalsRowH;
  });

  y = Math.max(y + 46 + wordsLines.length * 11, boxY + boxH) + 34;

  // ---- Stamp ----
  const stampLabel = data.isReturn ? "RETURNED" : data.isDue ? "DUE" : "PAID";
  const stampColor = data.isReturn ? STAMP_RETURN : data.isDue ? STAMP_DUE : STAMP_PAID;
  drawStamp(doc, leftX + 70, y, stampLabel, stampColor, formatInvoiceDate(data.sellingDate));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK_MUTED);
  doc.text(data.shopName, leftX + 70, y + 34, { align: "center" });

  // ---- Footer note ----
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...INK_FAINT);
  doc.text("This is a computer-generated invoice.", pageW - marginX, y + 34, { align: "right" });

  // ---- Notice / warning messages (Settings -> Shop / Invoice Info) ----
  // Free-form, admin-editable lines printed below the stamp -- e.g. a
  // return or warranty policy notice. Numbered so several lines read as
  // a list rather than a wall of text.
  let noticeY = y + 58;
  const noticeLines = (data.noticeLines || []).filter((l) => !!l && !!l.trim());
  if (noticeLines.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK_MUTED);
    doc.text("Notice:", marginX, noticeY);
    noticeY += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK_FAINT);
    noticeLines.forEach((line, i) => {
      const wrapped = doc.splitTextToSize(`${i + 1}. ${line.trim()}`, contentW);
      doc.text(wrapped, marginX, noticeY);
      noticeY += wrapped.length * 10;
    });
  }

  // ---- Signature block -- Customer (left) / Shop (right), each with a
  // sign-here line above the label. Anchored near the bottom of the page
  // so it lands in the same place regardless of notice-line count, but
  // pushed lower if the notices ran long enough to reach it. ----
  const sigLineY = Math.max(pageH - 60, noticeY + 24);
  const sigLineW = 160;
  doc.setDrawColor(...INK_MUTED);
  doc.setLineWidth(0.75);
  doc.line(leftX, sigLineY, leftX + sigLineW, sigLineY);
  doc.line(pageW - marginX - sigLineW, sigLineY, pageW - marginX, sigLineY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK_MUTED);
  doc.text("Customer Signature", leftX + sigLineW / 2, sigLineY + 14, { align: "center" });
  doc.text("Shop Signature", pageW - marginX - sigLineW / 2, sigLineY + 14, { align: "center" });

  const filename = `${data.isReturn ? "return" : "invoice"}-${data.saleId}.pdf`;

  if (previewWindow && !previewWindow.closed) {
    const blobUrl = doc.output("bloburl") as unknown as string;
    previewWindow.location.href = blobUrl;
  } else {
    doc.save(filename);
  }
}

export interface SalesInvoiceSaleInput {
  saleId: number;
  nameModel: string;
  imei: string;
  ramRom?: string | null;
  batteryHealth?: string | null;
  sellingPrice: number;
  sellingDate: string;
  isDue: boolean;
  paidAmount: number;
  dueAmount: number;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerEmail?: string | null;
  narration?: string | null;
  isReturn?: boolean;
}

interface ShopInfoResponse {
  shop_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  notice_lines?: string[] | null;
}

/**
 * Fetches the shop's own identity (Settings -> Shop / Invoice Info) and the
 * logged-in user's name, then builds and shows the full Sales Invoice memo.
 * Centralized here so every print call site (Sell, Stock's Sell/Reprint/
 * Return) shares the same two small fetches instead of repeating them.
 */
export async function printSalesInvoice(sale: SalesInvoiceSaleInput, previewWindow?: Window | null) {
  let shop: ShopInfoResponse = {
    shop_name: "Apple Store Satkhira",
    address: null,
    phone: null,
    email: null,
    notice_lines: [],
  };
  let preparedBy = "";
  try {
    const [shopRes, meRes] = await Promise.all([fetch("/api/shop-info"), fetch("/api/auth/me")]);
    if (shopRes.ok) shop = await shopRes.json();
    if (meRes.ok) {
      const me: any = await meRes.json();
      preparedBy = me.username || "";
    }
  } catch {
    // Fall back to defaults below -- the memo still prints either way.
  }

  await generateSalesInvoicePDF(
    {
      ...sale,
      shopName: shop.shop_name || "Apple Store Satkhira",
      shopAddress: shop.address,
      shopPhone: shop.phone,
      shopEmail: shop.email,
      noticeLines: shop.notice_lines,
      preparedBy,
    },
    previewWindow
  );
}
