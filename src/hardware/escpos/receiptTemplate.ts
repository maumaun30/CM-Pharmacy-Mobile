export interface ReceiptLine {
  name: string;
  qty: number;
  price: number;
  discountLabel?: string;
  discountAmount?: number;
}

export interface ReceiptData {
  branchName: string;
  saleId: number;
  cashier: string;
  date: string;
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  total: number;
  cash: number;
  change: number;
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

export function buildReceiptText(d: ReceiptData): string {
  const lines: string[] = [];
  lines.push(center(`CM Pharmacy — ${d.branchName}`));
  lines.push(center(`Sale #${d.saleId}  ${d.date}`));
  lines.push(center(`Cashier: ${d.cashier}`));
  lines.push("-".repeat(COL));
  for (const item of d.lines) {
    const qtyPrice = `${item.qty} × ${item.price.toFixed(2)}`;
    lines.push(row(item.name, qtyPrice));
    lines.push(row("", (item.qty * item.price).toFixed(2)));
    if (item.discountLabel && item.discountAmount) {
      lines.push(row(`  ${item.discountLabel}`, `-${item.discountAmount.toFixed(2)}`));
    }
  }
  lines.push("-".repeat(COL));
  lines.push(row("Subtotal", d.subtotal.toFixed(2)));
  lines.push(row("Discount", `-${d.discount.toFixed(2)}`));
  lines.push(row("TOTAL", d.total.toFixed(2)));
  lines.push(row("Cash", d.cash.toFixed(2)));
  lines.push(row("Change", d.change.toFixed(2)));
  lines.push("");
  lines.push(center("Thank you!"));
  lines.push("\n\n\n");
  return lines.join("\n");
}
