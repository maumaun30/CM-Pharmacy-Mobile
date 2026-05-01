import { useCallback, useMemo, useState } from "react";
import type { Product } from "@/api/products";

export interface CartItem {
  product: Product;
  quantity: number;
  discountId: number | null;
  discountedPrice: number | null;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const add = useCallback((product: Product, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      return [...prev, { product, quantity: qty, discountId: null, discountedPrice: null }];
    });
  }, []);

  const setQty = useCallback((productId: number, qty: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i))
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const remove = useCallback((productId: number) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const setDiscount = useCallback((productId: number, discountId: number | null, discountedPrice: number | null) => {
    setItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, discountId, discountedPrice } : i)),
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
