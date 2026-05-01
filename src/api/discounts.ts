import api from "./client";

export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";
export type DiscountCategory =
  | "PWD"
  | "SENIOR_CITIZEN"
  | "PROMOTIONAL"
  | "SEASONAL"
  | "OTHER";

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
  let amount =
    d.discount_type === "PERCENTAGE"
      ? (price * Number(d.discount_value)) / 100
      : Math.min(Number(d.discount_value), price);
  if (d.maximum_discount_amount) {
    amount = Math.min(amount, Number(d.maximum_discount_amount));
  }
  amount = Math.max(0, Math.min(amount, price));
  return { amount, finalPrice: Math.max(0, price - amount) };
}

export function discountLabel(d: Discount): string {
  if (d.discount_type === "PERCENTAGE") return `${Number(d.discount_value)}%`;
  return `−₱${Number(d.discount_value).toFixed(2)}`;
}
