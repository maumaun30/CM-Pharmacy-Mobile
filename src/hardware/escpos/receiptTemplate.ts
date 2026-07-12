import type { VatBreakdown } from "@/pos/vat";

// Store identity for the printed header. Configurable via env so it can change
// without a code edit; falls back to the known brand. Address/TIN are optional
// (a proper PH VAT receipt shows them) — left blank until provided.
const STORE_NAME = process.env.EXPO_PUBLIC_SITE_NAME || "Maun Pharmacy";
const STORE_ADDRESS = process.env.EXPO_PUBLIC_STORE_ADDRESS || "";
const STORE_TIN = process.env.EXPO_PUBLIC_STORE_TIN || "";

export interface ReceiptLine {
  name: string;
  qty: number;
  price: number;
  discountLabel?: string;
  discountAmount?: number;
}

export interface ReceiptCustomer {
  name: string;
  idNumber: string;
  discountType: string; // "SENIOR_CITIZEN" | "PWD"
}

export interface ReceiptData {
  branchName: string;
  saleId: number;
  cashier: string;
  date: string;
  lines: ReceiptLine[];
  subtotal: number; // gross, VAT-inclusive
  discount: number; // regular (non SC/PWD) discount only
  total: number;
  cash: number;
  change: number;
  vat?: VatBreakdown;
  customer?: ReceiptCustomer | null;
}

const COL = 32;

function center(text: string, width = COL): string {
  if (text.length >= width) return text;
  const pad = Math.floor((width - text.length) / 2);
  return " ".repeat(pad) + text;
}

function row(left: string, right: string, width = COL): string {
  const space = Math.max(1, width - left.length - right.length);
  return left + " ".repeat(space) + right;
}

function money(n: number): string {
  return n.toFixed(2);
}

function discountTypeLabel(t: string): string {
  if (t === "SENIOR_CITIZEN") return "Senior Citizen";
  if (t === "PWD") return "PWD";
  return t;
}

export function buildReceiptText(d: ReceiptData): string {
  const lines: string[] = [];

  // ── Header ──
  lines.push(center(STORE_NAME));
  if (STORE_ADDRESS) lines.push(center(STORE_ADDRESS));
  if (STORE_TIN) lines.push(center(`TIN: ${STORE_TIN}`));
  lines.push(center(d.branchName));
  lines.push(center(`Sale #${d.saleId}  ${d.date}`));
  lines.push(center(`Cashier: ${d.cashier}`));
  lines.push("-".repeat(COL));

  // ── Items ──
  for (const item of d.lines) {
    const qtyPrice = `${item.qty} x ${money(item.price)}`;
    lines.push(row(item.name, qtyPrice));
    lines.push(row("", money(item.qty * item.price)));
    if (item.discountLabel && item.discountAmount) {
      lines.push(row(`  ${item.discountLabel}`, `-${money(item.discountAmount)}`));
    }
  }
  lines.push("-".repeat(COL));

  // ── Totals ──
  lines.push(row("Subtotal", money(d.subtotal)));
  if (d.discount > 0) {
    lines.push(row("Discount", `-${money(d.discount)}`));
  }

  // ── VAT breakdown (prices are VAT-inclusive) ──
  if (d.vat) {
    lines.push("-".repeat(COL));
    lines.push(row("VATable Sales", money(d.vat.vatableSales)));
    if (d.vat.vatExemptSales > 0) {
      lines.push(row("VAT-Exempt Sales", money(d.vat.vatExemptSales)));
    }
    lines.push(row("VAT (12%)", money(d.vat.vatAmount)));
    if (d.vat.scPwdDiscount > 0) {
      lines.push(row("SC/PWD Discount", `-${money(d.vat.scPwdDiscount)}`));
    }
  }

  lines.push("-".repeat(COL));
  lines.push(row("TOTAL", money(d.total)));
  lines.push(row("Cash", money(d.cash)));
  lines.push(row("Change", money(d.change)));

  // ── Senior/PWD customer record ──
  if (d.customer) {
    lines.push("-".repeat(COL));
    lines.push(`${discountTypeLabel(d.customer.discountType)} Customer:`);
    lines.push(`  Name: ${d.customer.name}`);
    lines.push(`  ID No: ${d.customer.idNumber}`);
    lines.push("  Signature: ____________________");
  }

  lines.push("");
  lines.push(center("Thank you!"));
  lines.push("\n\n\n");
  return lines.join("\n");
}
