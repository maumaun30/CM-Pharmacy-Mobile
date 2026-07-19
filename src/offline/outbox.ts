// Offline sales outbox + read-model caches, persisted in AsyncStorage.
//
// Sales rung up while offline are queued here with a client-generated UUID
// (`clientRef`) and the device's real sale time (`soldAt`). sync.ts replays
// them FIFO to POST /sales once the connection returns; the API treats
// clientRef as an idempotency key, so a replay can never double-deduct stock.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CreateSalePayload } from "@/api/sales";
import type { Product } from "@/api/products";
import type { Discount } from "@/api/discounts";

const OUTBOX_KEY = "offline:outbox";
const PRODUCTS_KEY = (branchId: number) => `offline:products:${branchId}`;
const DISCOUNTS_KEY = (productId: number) => `offline:discounts:${productId}`;
const SALES_KEY = "offline:sales";

export interface OfflineSale {
  clientRef: string;
  soldAt: string; // ISO timestamp from the device at checkout time
  branchId: number;
  payload: CreateSalePayload;
  total: number;
  itemsCount: number;
  queuedAt: string;
  lastError?: string;
}

// RN Hermes has no crypto.randomUUID; randomness only needs to avoid collisions
// between a handful of queued sales per device, not be unguessable.
export function makeClientRef(): string {
  const hex = (n: number) =>
    Math.floor(Math.random() * Math.pow(16, n))
      .toString(16)
      .padStart(n, "0");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${((Math.random() * 4) | 8).toString(16)}${hex(3)}-${hex(12)}`;
}

// ─── Change notification (screens re-render on queue changes) ────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeOutbox(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

// ─── Outbox CRUD ─────────────────────────────────────────────────────────────

export async function getOutbox(): Promise<OfflineSale[]> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as OfflineSale[]) : [];
  } catch {
    return [];
  }
}

async function setOutbox(items: OfflineSale[]): Promise<void> {
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  notify();
}

export async function addToOutbox(sale: OfflineSale): Promise<void> {
  const items = await getOutbox();
  items.push(sale);
  await setOutbox(items);
}

export async function removeFromOutbox(clientRef: string): Promise<void> {
  const items = await getOutbox();
  await setOutbox(items.filter((s) => s.clientRef !== clientRef));
}

export async function setOutboxError(clientRef: string, error: string): Promise<void> {
  const items = await getOutbox();
  const item = items.find((s) => s.clientRef === clientRef);
  if (item) {
    item.lastError = error;
    await setOutbox(items);
  }
}

// ─── Product catalog cache (per branch) ──────────────────────────────────────

export async function cacheProducts(branchId: number, products: Product[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PRODUCTS_KEY(branchId), JSON.stringify(products));
  } catch {
    // Cache write failure must never break an online fetch.
  }
}

export async function getCachedProducts(branchId: number): Promise<Product[] | null> {
  try {
    const raw = await AsyncStorage.getItem(PRODUCTS_KEY(branchId));
    return raw ? (JSON.parse(raw) as Product[]) : null;
  } catch {
    return null;
  }
}

// Decrement cached stock for a queued offline sale so the POS shows the branch's
// remaining stock across consecutive offline sales. Negative is allowed (same
// soft-warn policy as online overselling).
export async function adjustCachedStock(
  branchId: number,
  items: { productId: number; quantity: number }[],
): Promise<void> {
  const products = await getCachedProducts(branchId);
  if (!products) return;
  const deltas = new Map(items.map((i) => [i.productId, i.quantity]));
  for (const p of products) {
    const qty = deltas.get(p.id);
    if (qty == null || p.track_inventory === false) continue;
    if (p.currentStock != null) p.currentStock -= qty;
    if (p.branch_stocks?.[0]) p.branch_stocks[0].current_stock -= qty;
  }
  await cacheProducts(branchId, products);
}

// ─── Discount cache (per product) ────────────────────────────────────────────

export async function cacheDiscounts(productId: number, discounts: Discount[]): Promise<void> {
  try {
    await AsyncStorage.setItem(DISCOUNTS_KEY(productId), JSON.stringify(discounts));
  } catch {}
}

export async function getCachedDiscounts(productId: number): Promise<Discount[] | null> {
  try {
    const raw = await AsyncStorage.getItem(DISCOUNTS_KEY(productId));
    return raw ? (JSON.parse(raw) as Discount[]) : null;
  } catch {
    return null;
  }
}

// ─── Synced sales list cache (sales tab, offline view) ───────────────────────

export async function cacheSales(data: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(SALES_KEY, JSON.stringify(data));
  } catch {}
}

export async function getCachedSales(): Promise<unknown | null> {
  try {
    const raw = await AsyncStorage.getItem(SALES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
