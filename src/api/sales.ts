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
  // Offline sync: idempotency key + device sale time (set when replaying a
  // queued offline sale; omitted for normal online sales).
  clientRef?: string;
  soldAt?: string;
}

export async function createSale(payload: CreateSalePayload) {
  const res = await api.post("/sales", payload);
  return res.data;
}

export async function listSales(params?: Record<string, unknown>) {
  const { cacheSales, getCachedSales } = await import("@/offline/outbox");
  try {
    const res = await api.get("/sales", { params });
    if (!params) await cacheSales(res.data);
    return res.data;
  } catch (e: any) {
    // Offline: show the last synced sales list (pending offline sales are
    // rendered separately from the outbox).
    if (!e?.response && !params) {
      const cached = await getCachedSales();
      if (cached) return cached;
    }
    throw e;
  }
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

// Async alternative to the PIN flow: submit a refund request that a manager
// or admin approves remotely (web /refunds or the admin app).
export async function createRefundRequest(
  saleId: number,
  payload: { items: { saleItemId: number; quantity: number }[]; reason?: string },
) {
  const res = await api.post(`/sales/${saleId}/refund-requests`, payload);
  return res.data as { message: string; refund_request: { id: number; status: string; total_refund: number } };
}
