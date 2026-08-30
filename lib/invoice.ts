import jsPDF from "jspdf";

export interface InvoiceData {
  saleId: number;
  shopName: string;
  nameModel: string;
  imei: string;
  sellingPrice: number;
  sellingDate: string;
  isDue: boolean;
  customerName?: string | null;
  customerPhone?: string | null;
  paidAmount: number;
  dueAmount: number;
}

export function generateInvoicePDF(data: InvoiceData) {
  const doc = new jsPDF({ unit: "pt", format: [300, 460] }); // receipt-style narrow page
  const marginX = 24;
  let y = 32;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(data.shopName, 150, y, { align: "center" });
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Sales Receipt", 150, y, { align: "center" });
  y += 16;
  doc.setDrawColor(180);
  doc.line(marginX, y, 300 - marginX, y);
  y += 18;

  doc.setFontSize(10);
  const row = (label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.text(label, marginX, y);
    doc.setFont("helvetica", "bold");
    doc.text(value, 300 - marginX, y, { align: "right" });
    y += 16;
  };

  row("Receipt #", `INV-${data.saleId}`);
  row("Date", data.sellingDate);
  y += 6;
  doc.line(marginX, y, 300 - marginX, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.nameModel, marginX, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`IMEI: ${data.imei}`, marginX, y);
  y += 18;

  row("Selling Price", `${data.sellingPrice.toLocaleString()} Tk`);

  if (data.isDue) {
    row("Paid", `${data.paidAmount.toLocaleString()} Tk`);
    row("Due", `${data.dueAmount.toLocaleString()} Tk`);
  } else {
    row("Payment", "Cash");
  }

  if (data.customerName) {
    y += 4;
    doc.line(marginX, y, 300 - marginX, y);
    y += 16;
    row("Customer", data.customerName);
  }
  if (data.customerPhone) {
    row("Phone", data.customerPhone);
  }

  y += 10;
  doc.line(marginX, y, 300 - marginX, y);
  y += 20;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text("Thank you for your purchase!", 150, y, { align: "center" });

  doc.save(`invoice-${data.saleId}.pdf`);
}
