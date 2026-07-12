import api from "./client";

export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  price: number;
  status: "ACTIVE" | "INACTIVE";
  category_id: number | null;
  track_inventory?: boolean;
  currentStock?: number;
  totalStock?: number;
  branch_stocks?: { branch_id: number; current_stock: number }[];
}

// Available units at the active branch, or null when the product doesn't track
// inventory (services / non-stock items) — null means "no cap, always sellable".
export function stockLimit(p: Product): number | null {
  if (p.track_inventory === false) return null;
  return p.currentStock ?? p.branch_stocks?.[0]?.current_stock ?? 0;
}

export async function listProductsByBranch(branchId: number): Promise<Product[]> {
  const res = await api.get("/products", { params: { branchId, status: "ACTIVE" } });
  return res.data;
}
