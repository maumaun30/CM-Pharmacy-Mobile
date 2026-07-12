import { useCallback, useMemo, useState } from "react";
import { stockLimit, type Product } from "@/api/products";
import type { DiscountCategory } from "@/api/discounts";

export interface CartItem {
  product: Product;
  quantity: number;
  discountId: number | null;
  discountedPrice: number | null;
  discountCategory: DiscountCategory | null;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  // Add `qty`, but never let a tracked product exceed its available stock.
  // Returns true if the requested amount was capped (so the UI can warn).
  const add = useCallback((product: Product, qty = 1): { capped: boolean } => {
    const limit = stockLimit(product);
    let capped = false;
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      const currentQty = idx >= 0 ? prev[idx].quantity : 0;
      let nextQty = currentQty + qty;
      if (limit != null && nextQty > limit) {
        nextQty = Math.max(currentQty, limit); // cap; never reduce below current
        capped = true;
      }
      if (nextQty === currentQty) return prev; // already at cap → no-op
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: nextQty };
        return next;
      }
      return [...prev, { product, quantity: nextQty, discountId: null, discountedPrice: null, discountCategory: null }];
    });
    return { capped };
  }, []);

  const setQty = useCallback((productId: number, qty: number) => {
    setItems((prev) =>
      prev
        .map((i) => {
          if (i.product.id !== productId) return i;
          const limit = stockLimit(i.product);
          const capped = limit != null ? Math.min(qty, limit) : qty;
          return { ...i, quantity: capped };
        })
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const remove = useCallback((productId: number) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const setDiscount = useCallback((productId: number, discountId: number | null, discountedPrice: number | null, discountCategory: DiscountCategory | null = null) => {
    setItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, discountId, discountedPrice, discountCategory } : i)),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const totals = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    for (const i of items) {
      const lineSubtotal = i.product.price * i.quantity;
      subtotal += lineSubtotal;
      if (i.discountedPrice != null) {
        const lineDiscounted = i.discountedPrice * i.quantity;
        discount += Math.max(0, lineSubtotal - lineDiscounted);
      }
    }
    const total = Math.max(0, subtotal - discount);
    return { subtotal, discount, total };
  }, [items]);

  return { items, add, setQty, remove, setDiscount, clear, ...totals };
}
