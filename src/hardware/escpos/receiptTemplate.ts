import type { VatBreakdown } from "@/pos/vat";

// The company name is global (one business) — configurable via env, defaults to
// the brand. Everything branch-specific (address, phone, TIN) comes from the
// branch record on the receipt data, so each branch prints its own header.
const COMPANY_NAME = process.env.EXPO_PUBLIC_SITE_NAME || "Maun Pharmacy";

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

// A branch record (from /auth/me or a sale) → the branch header fields on a
// receipt. Keeps address composition in one place for both new sales + reprints.
export interface ReceiptBranchInput {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  tin?: string | null;
}

export function branchReceiptFields(b?: ReceiptBranchInput | null): {
  branchName: string;
  branchAddress?: string;
  branchPhone?: string;
  branchTin?: string;
} {
  const address = [b?.address, b?.city, b?.province, b?.postal_code]
    .filter(Boolean)
    .join(", ");
  return {
    branchName: b?.name ?? "",
    branchAddress: address || undefined,
    branchPhone: b?.phone || undefined,
    branchTin: b?.tin || undefined,
  };
}

export interface ReceiptData {
  branchName: string;
  branchAddress?: string; // composed from the branch record (address, city, province)
  branchPhone?: string;
  branchTin?: string;
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

// Word-wrap a long line (e.g. a branch address) to the paper width.
function wrap(text: string, width = COL): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    if (line && line.length + 1 + w.length > width) {
      out.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) out.push(line);
  return out;
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
  lines.push(center(COMPANY_NAME));
  lines.push(center(d.branchName));
  if (d.branchAddress) {
    for (const l of wrap(d.branchAddress, COL)) lines.push(center(l));
  }
  if (d.branchPhone) lines.push(center(`Tel: ${d.branchPhone}`));
  if (d.branchTin) lines.push(center(`TIN: ${d.branchTin}`));
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
