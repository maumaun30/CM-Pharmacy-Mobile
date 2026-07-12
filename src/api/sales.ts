import api from "./client";

export interface CartLine {
  productId: number;
  quantity: number;
  price: number;
  discountId?: number | null;
  discountedPrice?: number;
}

export interface CreateSalePayload {
  cart: CartLine[];
  subtotal: number;
  totalDiscount: number;
  total: number;
  cashAmount: number;
  // Senior/PWD beneficiary (only when a VAT-exempt discount was applied).
  customerName?: string;
  customerIdNumber?: string;
  customerDiscountType?: string;
}

export async function createSale(payload: CreateSalePayload) {
  const res = await api.post("/sales", payload);
  return res.data;
}

export async function listSales(params?: Record<string, unknown>) {
  const res = await api.get("/sales", { params });
  return res.data;
}

export async function getSale(saleId: number) {
  const res = await api.get(`/sales/${saleId}`);
  return res.data;
}

export interface RefundPayload {
  items: { saleItemId: number; quantity: number }[];
  reason?: string;
  // A cashier (without refund permission) must supply a manager's PIN to
  // authorize the refund; admins/managers omit it.
  managerPin?: string;
}

export async function createRefund(saleId: number, payload: RefundPayload) {
  const res = await api.post(`/sales/${saleId}/refunds`, payload);
  return res.data;
}

export async function listRefunds(saleId: number) {
  const res = await api.get(`/sales/${saleId}/refunds`);
  return res.data;
}
