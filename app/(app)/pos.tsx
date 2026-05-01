import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, FadeInRight, LinearTransition, ZoomIn } from "react-native-reanimated";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  CreditCard,
  LayoutGrid,
  List,
  Minus,
  Plus,
  Printer,
  Scan,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react-native";
import { listProductsByBranch, type Product } from "@/api/products";
import { createSale } from "@/api/sales";
import {
  applicableForProduct,
  calcDiscountedPrice,
  discountLabel,
  type Discount,
} from "@/api/discounts";
import { useAuth } from "@/auth/AuthContext";
import { useCart, type CartItem } from "@/pos/useCart";
import { useHidScanner } from "@/hardware/useHidScanner";
import { useBranchSocket } from "@/socket/useBranchSocket";

const EMERALD = "#059669";
const EMERALD_DARK = "#047857";
const SLATE = "#64748b";
const fastOut = Easing.out(Easing.quad);

interface Receipt {
  saleId: number | null;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  cash: number;
  change: number;
  date: Date;
  branchName: string;
  cashier: string;
}

function stockColor(stock: number) {
  if (stock <= 0) return { bg: "bg-red-100", text: "text-red-700" };
  if (stock < 10) return { bg: "bg-amber-100", text: "text-amber-700" };
  return { bg: "bg-emerald-100", text: "text-emerald-700" };
}

export default function POSScreen() {
  const { user } = useAuth();
  const branchId = user?.current_branch_id ?? user?.branch_id ?? null;
  const cart = useCart();
  const [search, setSearch] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cashInput, setCashInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [discountFor, setDiscountFor] = useState<CartItem | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: products = [], refetch, isFetching } = useQuery({
    queryKey: ["products", branchId],
    queryFn: () => (branchId ? listProductsByBranch(branchId) : Promise.resolve([] as Product[])),
    enabled: !!branchId,
  });

  const { connected: socketLive } = useBranchSocket(branchId, {
    onStockUpdated: () => refetch(),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q),
    );
  }, [products, search]);

  const scanner = useHidScanner({
    onScan: (code) => {
      const found = products.find(
        (p) =>
          p.status === "ACTIVE" &&
          ((p.barcode ?? "").toLowerCase() === code.toLowerCase() ||
            p.sku.toLowerCase() === code.toLowerCase()),
      );
      if (found) cart.add(found, 1);
    },
  });

  const cash = parseFloat(cashInput) || 0;
  const change = cash - cart.total;
  const branchName = user?.currentBranch?.name ?? user?.branch?.name ?? "—";
  const branchCode = user?.currentBranch?.code ?? user?.branch?.code ?? "";

  function openCheckout() {
    if (cart.items.length === 0) return;
    setCashInput("");
    setCheckoutOpen(true);
  }

  async function confirmCheckout() {
    if (cash < cart.total) {
      Alert.alert("Insufficient cash", "Cash received must be at least the total.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        cart: cart.items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          price: i.product.price,
          discountId: i.discountId,
          discountedPrice: i.discountedPrice ?? undefined,
        })),
        subtotal: cart.subtotal,
        totalDiscount: cart.discount,
        total: cart.total,
        cashAmount: cash,
      };
      const result = await createSale(payload);
      const saleId = result?.saleId ?? null;
      setReceipt({
        saleId,
        items: [...cart.items],
        subtotal: cart.subtotal,
        discount: cart.discount,
        total: cart.total,
        cash,
        change,
        date: new Date(),
        branchName,
        cashier: user?.username ?? "",
      });
      setCheckoutOpen(false);
      cart.clear();
      refetch();
    } catch (e: any) {
      Alert.alert("Checkout failed", e?.response?.data?.message ?? e?.message ?? "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="flex-1 flex-row bg-emerald-50/40">
      {/* ── LEFT: products ───────────────────────────────────────────── */}
      <View className="flex-1 p-4">
        <Animated.View entering={FadeInDown.duration(220).easing(fastOut)} className="mb-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="rounded-md bg-emerald-100 px-2 py-1">
                <Text className="text-xs font-semibold text-emerald-700">{branchCode || "BRANCH"}</Text>
              </View>
              <Text className="text-base font-bold text-slate-800">{branchName}</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="flex-row items-center gap-1">
                {socketLive ? <Wifi size={14} color={EMERALD} /> : <WifiOff size={14} color="#94a3b8" />}
                <Text className={`text-xs ${socketLive ? "text-emerald-600" : "text-slate-400"}`}>
                  {socketLive ? "Live" : "Offline"}
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Scan size={14} color={SLATE} />
                <Text className="text-xs text-slate-500">{user?.username}</Text>
              </View>
              <View className="flex-row items-center gap-0.5 rounded-md border border-emerald-100 bg-white p-0.5">
                <TouchableOpacity
                  onPress={() => setViewMode("grid")}
                  className={`h-7 w-7 items-center justify-center rounded ${
                    viewMode === "grid" ? "bg-emerald-100" : "bg-transparent"
                  }`}
                >
                  <LayoutGrid size={14} color={viewMode === "grid" ? EMERALD_DARK : SLATE} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setViewMode("list")}
                  className={`h-7 w-7 items-center justify-center rounded ${
                    viewMode === "list" ? "bg-emerald-100" : "bg-transparent"
                  }`}
                >
                  <List size={14} color={viewMode === "list" ? EMERALD_DARK : SLATE} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(240).delay(40).easing(fastOut)}
          className="mb-3 flex-row items-center rounded-xl border border-emerald-100 bg-white px-3"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        >
          <Search size={18} color={SLATE} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, SKU, or barcode"
            placeholderTextColor="#94a3b8"
            className="flex-1 px-3 py-3 text-base text-slate-900"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} className="px-2 py-2">
              <Text className="text-xs text-slate-500">Clear</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        <Animated.View
          entering={FadeIn.duration(280).delay(80).easing(fastOut)}
          className="flex-1 overflow-hidden rounded-xl bg-white"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        >
          {!branchId ? (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-base font-semibold text-slate-700">No branch assigned</Text>
              <Text className="mt-1 text-center text-sm text-slate-500">
                Ask an admin to assign your account to a branch before ringing up sales.
              </Text>
            </View>
          ) : filtered.length === 0 ? (
            <View className="flex-1 items-center justify-center px-6">
              <View className="mb-3 h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <Search size={28} color="#a7f3d0" />
              </View>
              <Text className="text-base font-semibold text-slate-700">
                {isFetching ? "Loading products..." : "No products match"}
              </Text>
              <Text className="mt-1 text-sm text-slate-500">
                {isFetching ? "" : "Try a different search term."}
              </Text>
            </View>
          ) : (
            <FlashList
              key={viewMode}
              data={filtered}
              keyExtractor={(item) => String(item.id)}
              numColumns={viewMode === "grid" ? 4 : 1}
              estimatedItemSize={viewMode === "grid" ? 140 : 72}
              contentContainerStyle={{ padding: 8 }}
              renderItem={({ item, index }) =>
                viewMode === "grid" ? (
                  <ProductCard product={item} onPress={() => cart.add(item, 1)} index={index} />
                ) : (
                  <ProductRow product={item} onPress={() => cart.add(item, 1)} index={index} />
                )
              }
            />
          )}
        </Animated.View>

        <TextInput
          ref={scanner.inputRef}
          autoFocus
          caretHidden
          showSoftInputOnFocus={false}
          value={scanner.buffer}
          onChangeText={scanner.handleChange}
          onSubmitEditing={scanner.handleSubmit}
          blurOnSubmit={false}
          style={{ position: "absolute", opacity: 0, height: 1, width: 1 }}
        />
      </View>

      {/* ── RIGHT: cart ─────────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInRight.duration(280).easing(fastOut)}
        className="w-96 border-l border-emerald-100 bg-white"
      >
        <View className="flex-row items-center gap-2 border-b border-emerald-100 bg-emerald-50/60 px-4 py-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-emerald-600">
            <ShoppingCart size={18} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-slate-800">Cart</Text>
            <Text className="text-xs text-slate-500">
              {cart.items.length} {cart.items.length === 1 ? "item" : "items"}
            </Text>
          </View>
          {cart.items.length > 0 && (
            <TouchableOpacity onPress={cart.clear} className="rounded-md px-2 py-1">
              <Text className="text-xs font-medium text-slate-500">Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="flex-1 px-3 py-2">
          {cart.items.length === 0 ? (
            <Animated.View
              entering={FadeIn.duration(220).easing(fastOut)}
              className="flex-1 items-center justify-center px-4"
            >
              <View className="mb-3 h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
                <ShoppingCart size={36} color="#a7f3d0" />
              </View>
              <Text className="text-base font-semibold text-slate-700">Cart is empty</Text>
              <Text className="mt-1 text-center text-xs text-slate-500">
                Tap a product or scan a barcode to add it.
              </Text>
            </Animated.View>
          ) : (
            <View className="flex-1">
              {cart.items.map((i, idx) => (
                <Animated.View
                  key={i.product.id}
                  entering={FadeInRight.duration(180).easing(fastOut)}
                  layout={LinearTransition.duration(180)}
                  className="mb-2 rounded-lg border border-slate-200 bg-white p-3"
                  style={{
                    shadowColor: "#000",
                    shadowOpacity: idx === 0 ? 0.03 : 0,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 1,
                  }}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-2">
                      <Text numberOfLines={1} className="text-sm font-semibold text-slate-800">
                        {i.product.name}
                      </Text>
                      <Text className="mt-0.5 text-[11px] text-slate-500">{i.product.sku}</Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <TouchableOpacity
                        onPress={() => setDiscountFor(i)}
                        className={`h-7 w-7 items-center justify-center rounded-md ${
                          i.discountId != null
                            ? "bg-emerald-100"
                            : "bg-transparent"
                        } active:bg-emerald-50`}
                      >
                        <Tag size={14} color={i.discountId != null ? EMERALD_DARK : "#94a3b8"} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => cart.remove(i.product.id)} className="p-1">
                        <Trash2 size={16} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View className="mt-2 flex-row items-center justify-between">
                    <View>
                      <Text className="text-sm text-slate-600">
                        ₱{i.product.price.toFixed(2)} ×{" "}
                        <Text className="font-semibold text-slate-800">{i.quantity}</Text>
                      </Text>
                      {i.discountedPrice != null && (
                        <View className="mt-1 flex-row items-center gap-1">
                          <Tag size={10} color={EMERALD} />
                          <Text className="text-[11px] font-medium text-emerald-700">
                            −₱{((i.product.price - i.discountedPrice) * i.quantity).toFixed(2)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <TouchableOpacity
                        onPress={() => cart.setQty(i.product.id, i.quantity - 1)}
                        className="h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-white active:bg-emerald-50"
                      >
                        <Minus size={14} color={EMERALD_DARK} />
                      </TouchableOpacity>
                      <Text className="min-w-[24px] text-center text-sm font-semibold text-slate-800">
                        {i.quantity}
                      </Text>
                      <TouchableOpacity
                        onPress={() => cart.setQty(i.product.id, i.quantity + 1)}
                        className="h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-white active:bg-emerald-50"
                      >
                        <Plus size={14} color={EMERALD_DARK} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Animated.View>
              ))}
            </View>
          )}
        </View>

        <View className="border-t-2 border-emerald-100 bg-white p-4">
          <View className="mb-1 flex-row justify-between">
            <Text className="text-sm text-slate-600">Subtotal</Text>
            <Text className="text-sm text-slate-800">₱{cart.subtotal.toFixed(2)}</Text>
          </View>
          {cart.discount > 0 && (
            <View className="mb-1 flex-row justify-between">
              <Text className="text-sm text-slate-600">Discount</Text>
              <Text className="text-sm font-semibold text-emerald-700">−₱{cart.discount.toFixed(2)}</Text>
            </View>
          )}
          <View className="mt-1 flex-row items-baseline justify-between border-t border-emerald-100 pt-2">
            <Text className="text-base font-bold text-slate-800">TOTAL</Text>
            <Text className="text-2xl font-extrabold text-emerald-600">₱{cart.total.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            onPress={openCheckout}
            disabled={cart.items.length === 0}
            activeOpacity={0.85}
            className="mt-3 flex-row items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3.5 active:bg-emerald-700"
            style={{
              shadowColor: EMERALD_DARK,
              shadowOpacity: cart.items.length === 0 ? 0 : 0.3,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: cart.items.length === 0 ? 0 : 4,
              opacity: cart.items.length === 0 ? 0.5 : 1,
            }}
          >
            <CreditCard size={18} color="#fff" />
            <Text className="text-base font-semibold text-white">
              Checkout {cart.items.length > 0 ? `(${cart.items.length})` : ""}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Checkout Modal ──────────────────────────────────────────── */}
      <Modal visible={checkoutOpen} transparent animationType="fade" onRequestClose={() => setCheckoutOpen(false)}>
        <View className="flex-1 items-center justify-center bg-black/40 p-6">
          <Animated.View
            entering={FadeInDown.duration(220).easing(fastOut)}
            className="w-full max-w-md rounded-2xl bg-white p-5"
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 8 },
              elevation: 10,
            }}
          >
            <View className="mb-4 flex-row items-center gap-2">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-emerald-600">
                <CreditCard size={18} color="#fff" />
              </View>
              <Text className="flex-1 text-lg font-bold text-slate-800">Checkout</Text>
              <TouchableOpacity onPress={() => setCheckoutOpen(false)}>
                <Text className="text-sm font-medium text-slate-500">Cancel</Text>
              </TouchableOpacity>
            </View>

            <View className="mb-4 rounded-lg bg-emerald-50 p-3">
              <View className="flex-row justify-between">
                <Text className="text-sm text-slate-600">Subtotal</Text>
                <Text className="text-sm text-slate-800">₱{cart.subtotal.toFixed(2)}</Text>
              </View>
              {cart.discount > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-sm text-slate-600">Discount</Text>
                  <Text className="text-sm font-semibold text-emerald-700">−₱{cart.discount.toFixed(2)}</Text>
                </View>
              )}
              <View className="mt-1 flex-row items-baseline justify-between border-t border-emerald-200 pt-2">
                <Text className="text-base font-bold text-slate-800">TOTAL</Text>
                <Text className="text-2xl font-extrabold text-emerald-600">₱{cart.total.toFixed(2)}</Text>
              </View>
            </View>

            <Text className="mb-1.5 text-sm font-medium text-slate-700">Cash received</Text>
            <TextInput
              value={cashInput}
              onChangeText={setCashInput}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-4 py-3 text-2xl font-bold text-slate-900"
            />
            <View className="mt-2 flex-row flex-wrap gap-2">
              <QuickCash label="Exact" onPress={() => setCashInput(cart.total.toFixed(2))} />
              {[100, 200, 500, 1000].map((q) => (
                <QuickCash key={q} label={`₱${q}`} onPress={() => setCashInput(String(q))} />
              ))}
            </View>

            <View className="mt-3 flex-row items-baseline justify-between">
              <Text className="text-sm text-slate-600">Change</Text>
              <Text
                className={`text-lg font-bold ${
                  cash >= cart.total ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                ₱{Math.max(0, change).toFixed(2)}
              </Text>
            </View>

            <TouchableOpacity
              onPress={confirmCheckout}
              disabled={submitting || cash < cart.total}
              activeOpacity={0.85}
              className="mt-4 flex-row items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3.5 active:bg-emerald-700"
              style={{
                shadowColor: EMERALD_DARK,
                shadowOpacity: 0.3,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
                opacity: submitting || cash < cart.total ? 0.6 : 1,
              }}
            >
              <Printer size={18} color="#fff" />
              <Text className="text-base font-semibold text-white">
                {submitting ? "Processing..." : "Confirm & Print Receipt"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* ── Receipt Modal ───────────────────────────────────────────── */}
      <Modal visible={!!receipt} transparent animationType="fade" onRequestClose={() => setReceipt(null)}>
        <View className="flex-1 items-center justify-center bg-black/40 p-6">
          <Animated.View
            entering={ZoomIn.duration(260).easing(fastOut)}
            className="w-full max-w-md rounded-2xl bg-white p-5"
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 8 },
              elevation: 10,
            }}
          >
            <View className="mb-3 items-center">
              <View
                className="mb-2 h-14 w-14 items-center justify-center rounded-full bg-emerald-600"
                style={{
                  shadowColor: EMERALD,
                  shadowOpacity: 0.4,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 6,
                }}
              >
                <CheckCircle2 size={28} color="#fff" />
              </View>
              <Text className="text-lg font-bold text-slate-800">Sale Complete</Text>
              {receipt?.saleId && (
                <Text className="text-xs text-slate-500">Receipt #{receipt.saleId}</Text>
              )}
            </View>

            <Text className="text-center text-sm font-semibold text-slate-700">
              CM Pharmacy — {receipt?.branchName}
            </Text>
            <Text className="mb-3 text-center text-[11px] text-slate-500">
              {receipt?.date.toLocaleString()} • Cashier: {receipt?.cashier}
            </Text>

            <View className="mb-2 border-t border-dashed border-slate-300" />
            <View className="mb-2">
              {receipt?.items.map((i) => (
                <View key={i.product.id} className="mb-1 flex-row justify-between">
                  <Text numberOfLines={1} className="flex-1 text-sm text-slate-700">
                    {i.product.name}
                  </Text>
                  <Text className="text-sm text-slate-700">
                    {i.quantity} × ₱{i.product.price.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
            <View className="mb-2 border-t border-dashed border-slate-300" />

            <View className="flex-row justify-between">
              <Text className="text-sm text-slate-600">Subtotal</Text>
              <Text className="text-sm text-slate-700">₱{receipt?.subtotal.toFixed(2)}</Text>
            </View>
            {(receipt?.discount ?? 0) > 0 && (
              <View className="flex-row justify-between">
                <Text className="text-sm text-slate-600">Discount</Text>
                <Text className="text-sm font-semibold text-emerald-700">
                  −₱{receipt?.discount.toFixed(2)}
                </Text>
              </View>
            )}
            <View className="mt-1 flex-row items-baseline justify-between border-t border-emerald-100 pt-1">
              <Text className="text-base font-bold text-slate-800">TOTAL</Text>
              <Text className="text-xl font-extrabold text-emerald-600">
                ₱{receipt?.total.toFixed(2)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-slate-600">Cash</Text>
              <Text className="text-sm text-slate-700">₱{receipt?.cash.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-slate-600">Change</Text>
              <Text className="text-sm text-slate-700">₱{receipt?.change.toFixed(2)}</Text>
            </View>

            <View className="mt-4 flex-row gap-2">
              <TouchableOpacity
                onPress={() => setReceipt(null)}
                activeOpacity={0.85}
                className="flex-1 rounded-lg border border-emerald-300 bg-white py-3 active:bg-emerald-50"
              >
                <Text className="text-center text-sm font-semibold text-emerald-700">Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setReceipt(null)}
                activeOpacity={0.85}
                className="flex-1 flex-row items-center justify-center gap-1 rounded-lg bg-emerald-600 py-3 active:bg-emerald-700"
              >
                <Printer size={16} color="#fff" />
                <Text className="text-center text-sm font-semibold text-white">New Sale</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* ── Discount Picker Modal ───────────────────────────────────── */}
      <DiscountPicker
        item={discountFor}
        onClose={() => setDiscountFor(null)}
        onApply={(discountId, finalPrice) => {
          if (!discountFor) return;
          cart.setDiscount(discountFor.product.id, discountId, finalPrice);
          setDiscountFor(null);
        }}
      />
    </View>
  );
}

function DiscountPicker({
  item,
  onClose,
  onApply,
}: {
  item: CartItem | null;
  onClose: () => void;
  onApply: (discountId: number | null, finalPrice: number | null) => void;
}) {
  const productId = item?.product.id ?? null;
  const { data, isLoading } = useQuery({
    queryKey: ["discounts", productId],
    queryFn: () => applicableForProduct(productId as number),
    enabled: !!productId,
  });
  const discounts = (data ?? []).filter((d) => d.is_enabled);
  const price = item?.product.price ?? 0;

  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/40 p-6">
        <Animated.View
          entering={FadeInDown.duration(220).easing(fastOut)}
          className="w-full max-w-md rounded-2xl bg-white p-5"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
            elevation: 10,
          }}
        >
          <View className="mb-3 flex-row items-center gap-2">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-emerald-600">
              <Tag size={16} color="#fff" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-slate-800">Apply discount</Text>
              {item && (
                <Text numberOfLines={1} className="text-xs text-slate-500">
                  {item.product.name} • ₱{price.toFixed(2)}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text className="text-sm font-medium text-slate-500">Close</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator color={EMERALD} />
            </View>
          ) : discounts.length === 0 ? (
            <View className="items-center py-6">
              <View className="mb-2 h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                <Tag size={22} color="#a7f3d0" />
              </View>
              <Text className="text-sm font-semibold text-slate-700">No discounts available</Text>
              <Text className="mt-1 text-center text-xs text-slate-500">
                There are no active discounts for this product.
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {discounts.map((d, idx) => {
                const { amount, finalPrice } = calcDiscountedPrice(price, d);
                const selected = item?.discountId === d.id;
                return (
                  <Animated.View
                    key={d.id}
                    entering={FadeIn.duration(180).delay(Math.min(idx, 8) * 18).easing(fastOut)}
                  >
                    <TouchableOpacity
                      onPress={() => onApply(d.id, finalPrice)}
                      activeOpacity={0.85}
                      className={`mb-2 flex-row items-center gap-3 rounded-xl border p-3 ${
                        selected
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-slate-200 bg-white active:bg-emerald-50"
                      }`}
                    >
                      <View
                        className={`h-10 w-10 items-center justify-center rounded-full ${
                          selected ? "bg-emerald-600" : "bg-emerald-100"
                        }`}
                      >
                        <Tag size={16} color={selected ? "#fff" : EMERALD_DARK} />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text numberOfLines={1} className="flex-1 text-sm font-semibold text-slate-800">
                            {d.name}
                          </Text>
                          <View className="rounded-md bg-emerald-100 px-1.5 py-0.5">
                            <Text className="text-[10px] font-bold text-emerald-700">
                              {discountLabel(d)}
                            </Text>
                          </View>
                        </View>
                        <Text className="mt-0.5 text-[11px] text-slate-500">
                          Save ₱{amount.toFixed(2)} → ₱{finalPrice.toFixed(2)}
                        </Text>
                      </View>
                      {selected && <CheckCircle2 size={18} color={EMERALD} />}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </ScrollView>
          )}

          {item?.discountId != null && (
            <TouchableOpacity
              onPress={() => onApply(null, null)}
              activeOpacity={0.85}
              className="mt-2 rounded-lg border border-red-200 bg-white py-3 active:bg-red-50"
            >
              <Text className="text-center text-sm font-semibold text-red-600">
                Remove current discount
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function ProductCard({ product, onPress, index }: { product: Product; onPress: () => void; index: number }) {
  const stock = product.currentStock ?? product.branch_stocks?.[0]?.current_stock ?? 0;
  const sc = stockColor(stock);
  return (
    <Animated.View
      entering={FadeIn.duration(180).delay(Math.min(index, 12) * 12).easing(fastOut)}
      layout={LinearTransition.duration(180)}
      className="m-1 flex-1"
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        disabled={stock <= 0}
        className="rounded-xl border border-slate-200 bg-white p-3 active:border-emerald-300 active:bg-emerald-50"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
          opacity: stock <= 0 ? 0.55 : 1,
        }}
      >
        <View className={`mb-2 self-start rounded-md px-2 py-0.5 ${sc.bg}`}>
          <Text className={`text-[10px] font-semibold ${sc.text}`}>
            {stock <= 0 ? "Out of stock" : `Stock ${stock}`}
          </Text>
        </View>
        <Text numberOfLines={2} className="text-sm font-semibold text-slate-800">
          {product.name}
        </Text>
        <Text className="mt-0.5 text-[11px] text-slate-500">{product.sku}</Text>
        <Text className="mt-2 text-base font-bold text-emerald-600">₱{product.price.toFixed(2)}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ProductRow({ product, onPress, index }: { product: Product; onPress: () => void; index: number }) {
  const stock = product.currentStock ?? product.branch_stocks?.[0]?.current_stock ?? 0;
  const sc = stockColor(stock);
  return (
    <Animated.View
      entering={FadeIn.duration(160).delay(Math.min(index, 12) * 8).easing(fastOut)}
      layout={LinearTransition.duration(180)}
      className="px-1 py-0.5"
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        disabled={stock <= 0}
        className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 active:border-emerald-300 active:bg-emerald-50"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.03,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
          opacity: stock <= 0 ? 0.55 : 1,
        }}
      >
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text numberOfLines={1} className="flex-1 text-sm font-semibold text-slate-800">
              {product.name}
            </Text>
            <View className={`rounded-md px-1.5 py-0.5 ${sc.bg}`}>
              <Text className={`text-[10px] font-semibold ${sc.text}`}>
                {stock <= 0 ? "Out" : stock}
              </Text>
            </View>
          </View>
          {/* <Text className="mt-0.5 text-[11px] text-slate-500">{product.sku}</Text> */}
        </View>
        <Text className="text-base font-bold text-emerald-600">₱{product.price.toFixed(2)}</Text>
        <View className="h-8 w-8 items-center justify-center rounded-md bg-emerald-100">
          <Plus size={14} color={EMERALD_DARK} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function QuickCash({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 active:bg-emerald-100"
    >
      <Text className="text-sm font-semibold text-emerald-700">{label}</Text>
    </TouchableOpacity>
  );
}
