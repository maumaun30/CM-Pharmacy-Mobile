import api from "./client";
import { VAT_RATE } from "@/pos/vat";

export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";
export type DiscountCategory =
  | "PWD"
  | "SENIOR_CITIZEN"
  | "PROMOTIONAL"
  | "SEASONAL"
  | "OTHER";

/** Senior Citizen / PWD purchases are VAT-exempt (and their discount is
 * computed on the VAT-exempt base). Used to trigger name/ID capture too. */
export function isVatExemptCategory(c: DiscountCategory): boolean {
  return c === "SENIOR_CITIZEN" || c === "PWD";
}

export interface Discount {
  id: number;
  name: string;
  description?: string | null;
  discount_type: DiscountType;
  discount_value: number;
  discount_category: DiscountCategory;
  requires_verification: boolean;
  is_enabled: boolean;
  maximum_discount_amount: number | null;
  applicable_to: "ALL_PRODUCTS" | "SPECIFIC_PRODUCTS" | "CATEGORIES";
  start_date?: string | null;
  end_date?: string | null;
}

export async function applicableForProduct(productId: number): Promise<Discount[]> {
  const res = await api.get(`/discounts/product/${productId}/applicable`);
  return res.data;
}

export function calcDiscountedPrice(price: number, d: Discount): { amount: number; finalPrice: number } {
  // Senior/PWD: strip the 12% VAT first (their purchase is VAT-exempt), then
  // apply the discount on the net base. `finalPrice` is what the customer pays;
  // `amount` is the total reduction from the shelf price (VAT + discount).
  const vatExempt = isVatExemptCategory(d.discount_category);
  const base = vatExempt ? price / (1 + VAT_RATE) : price;

  let discount =
    d.discount_type === "PERCENTAGE"
      ? (base * Number(d.discount_value)) / 100
      : Math.min(Number(d.discount_value), base);
  if (d.maximum_discount_amount) {
    discount = Math.min(discount, Number(d.maximum_discount_amount));
  }
  discount = Math.max(0, Math.min(discount, base));

  const finalPrice = Math.max(0, base - discount);
  return { amount: Math.max(0, price - finalPrice), finalPrice };
}

export function discountLabel(d: Discount): string {
  if (d.discount_type === "PERCENTAGE") return `${Number(d.discount_value)}%`;
  return `−₱${Number(d.discount_value).toFixed(2)}`;
}
