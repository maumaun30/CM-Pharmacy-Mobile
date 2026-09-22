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
  branch_stocks?: {
    branch_id: number;
    current_stock: number;
    minimum_stock?: number;
    reorder_point?: number;
  }[];
}

// Available units at the active branch, or null when the product doesn't track
// inventory (services / non-stock items) — null means "no cap, always sellable".
export function stockLimit(p: Product): number | null {
  if (p.track_inventory === false) return null;
  return p.currentStock ?? p.branch_stocks?.[0]?.current_stock ?? 0;
}

export type StockStatus = "untracked" | "out" | "critical" | "low" | "in";

// Classify a product's stock at the active branch against its thresholds:
// out (<=0), critical (<= minimum), low (<= reorder), else in-stock.
export function stockStatus(p: Product): { status: StockStatus; qty: number } {
  if (p.track_inventory === false) return { status: "untracked", qty: 0 };
  const bs = p.branch_stocks?.[0];
  const qty = p.currentStock ?? bs?.current_stock ?? 0;
  const min = bs?.minimum_stock ?? 0;
  const reorder = bs?.reorder_point ?? 0;
  if (qty <= 0) return { status: "out", qty };
  if (min > 0 && qty <= min) return { status: "critical", qty };
  if (reorder > 0 && qty <= reorder) return { status: "low", qty };
  return { status: "in", qty };
}

export async function listProductsByBranch(branchId: number): Promise<Product[]> {
  const { cacheProducts, getCachedProducts } = await import("@/offline/outbox");
  try {
    // fields=pos: slim catalog (no descriptions, timestamps or joins) with
    // exactly the fields the POS reads. It's also what gets cached for offline.
    const res = await api.get("/products", { params: { branchId, status: "ACTIVE", fields: "pos" } });
    // API returns newest-first; POS wants an A-Z catalog.
    const sorted = (res.data as Product[]).sort((a, b) => a.name.localeCompare(b.name));
    await cacheProducts(branchId, sorted);
    return sorted;
  } catch (e: any) {
    // Network down (no HTTP response): fall back to the last synced catalog so
    // the POS keeps selling offline. Real HTTP errors still propagate.
    if (!e?.response) {
      const cached = await getCachedProducts(branchId);
      if (cached) return cached;
    }
    throw e;
  }
}
