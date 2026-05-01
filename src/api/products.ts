import api from "./client";

export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  price: number;
  status: "ACTIVE" | "INACTIVE";
  category_id: number | null;
  currentStock?: number;
  totalStock?: number;
  branch_stocks?: { branch_id: number; current_stock: number }[];
}

export async function listProductsByBranch(branchId: number): Promise<Product[]> {
  const res = await api.get("/products", { params: { branchId, status: "ACTIVE" } });
  return res.data;
}
