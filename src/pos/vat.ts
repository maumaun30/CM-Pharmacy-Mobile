// Philippine VAT is 12% and product prices in this system are VAT-inclusive.
// Senior Citizen (RA 9994) and PWD (RA 10754) purchases are VAT-EXEMPT and get
// a 20% discount computed on the VAT-exempt (net) amount — the BIR method:
//   net       = grossInclusive / 1.12          (strip the VAT)
//   scPwdDisc = net * 0.20                      (discount on the net)
//   amountDue = net - scPwdDisc
// Regular sales keep the 12% VAT, shown backed out of the inclusive total.

export const VAT_RATE = 0.12;

export interface VatBreakdown {
  vatableSales: number; // net of VAT, taxed portion
  vatAmount: number; // 12% VAT on the vatable portion
  vatExemptSales: number; // net, VAT-exempt (senior/PWD) portion
  scPwdDiscount: number; // SC/PWD discount (on the net exempt amount)
}

export interface VatLine {
  gross: number; // price * qty, VAT-inclusive shelf amount
  lineTotal: number; // what the customer actually pays for this line
  vatExempt: boolean; // true for senior/PWD lines
}

export function computeVat(lines: VatLine[]): VatBreakdown {
  let vatableSales = 0;
  let vatAmount = 0;
  let vatExemptSales = 0;
  let scPwdDiscount = 0;

  for (const l of lines) {
    if (l.vatExempt) {
      // gross is VAT-inclusive; net strips the (exempt) VAT. The SC/PWD discount
      // is whatever brings net down to what the customer paid.
      const net = l.gross / (1 + VAT_RATE);
      vatExemptSales += net;
      scPwdDiscount += Math.max(0, net - l.lineTotal);
    } else {
      const net = l.lineTotal / (1 + VAT_RATE);
      vatableSales += net;
      vatAmount += l.lineTotal - net;
    }
  }

  return { vatableSales, vatAmount, vatExemptSales, scPwdDiscount };
}

export function hasVatExempt(b: VatBreakdown): boolean {
  return b.vatExemptSales > 0 || b.scPwdDiscount > 0;
}
