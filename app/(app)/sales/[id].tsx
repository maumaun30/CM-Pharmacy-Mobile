import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp, LinearTransition } from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Calendar,
  Minus,
  Plus,
  Receipt,
  RotateCw,
  Tag,
  Undo2,
  User as UserIcon,
} from "lucide-react-native";
import dayjs from "dayjs";
import { createRefund, listRefunds, listSales, type RefundPayload } from "@/api/sales";

const EMERALD = "#059669";
const EMERALD_DARK = "#047857";
const SLATE = "#64748b";
const fastOut = Easing.out(Easing.quad);

interface SaleItem {
  id: number;
  product: { id: number; name: string };
  quantity: number;
  price: number;
  discountedPrice: number | null;
  discountAmount: number;
  discount: { id: number; name: string; type: string; value: number } | null;
}

interface Sale {
  id: number;
  totalAmount: number;
  totalDiscount: number;
  subtotal: number | null;
  cashAmount: number | null;
  changeAmount: number | null;
  soldAt: string;
  status: string | null;
  branch?: { id: number; name: string; code: string } | null;
  seller?: { id: number; name: string; email?: string } | null;
  items: SaleItem[];
}

interface RefundRecord {
  id: number;
  saleId: number;
  totalRefund: number;
  reason: string | null;
  createdAt: string;
  refundedBy: { id: number; name: string } | null;
  items: {
    id: number;
    saleItemId: number;
    product: { id: number; name: string };
    quantity: number;
    refundAmount: number;
  }[];
}

function statusPill(status: string | null) {
  const s = (status ?? "COMPLETED").toUpperCase();
  if (s === "PARTIALLY_REFUNDED" || s === "PARTIAL_REFUND")
    return { label: "Partial Refund", bg: "bg-amber-100", text: "text-amber-700" };
  if (s === "FULLY_REFUNDED" || s === "REFUNDED")
    return { label: "Refunded", bg: "bg-red-100", text: "text-red-700" };
  return { label: "Completed", bg: "bg-emerald-100", text: "text-emerald-700" };
}

export default function SaleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const saleId = Number(id);
  const [refundOpen, setRefundOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: () => listSales(),
  });

  const sale: Sale | null = useMemo(() => {
    const arr: Sale[] = Array.isArray(data) ? data : data?.sales ?? [];
    return arr.find((s) => Number(s.id) === saleId) ?? null;
  }, [data, saleId]);

  const { data: refunds = [], refetch: refetchRefunds, isFetching: refundsFetching } = useQuery<
    RefundRecord[]
  >({
    queryKey: ["refunds", saleId],
    queryFn: () => listRefunds(saleId),
    enabled: Number.isFinite(saleId),
  });

  const refundedQtyByItem = useMemo(() => {
    const map = new Map<number, number>();
    for (const r of refunds) {
      for (const it of r.items) {
        map.set(it.saleItemId, (map.get(it.saleItemId) ?? 0) + it.quantity);
      }
    }
    return map;
  }, [refunds]);

  const totalRefunded = useMemo(
    () => refunds.reduce((s, r) => s + Number(r.totalRefund), 0),
    [refunds],
  );

  const refundable = useMemo(() => {
    if (!sale) return 0;
    return sale.items.reduce((s, it) => {
      const refunded = refundedQtyByItem.get(it.id) ?? 0;
      return s + Math.max(0, it.quantity - refunded);
    }, 0);
  }, [sale, refundedQtyByItem]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-emerald-50/40">
        <ActivityIndicator color={EMERALD} />
      </View>
    );
  }

  if (!sale) {
    return (
      <View className="flex-1 items-center justify-center bg-emerald-50/40 px-6">
        <View className="mb-3 h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <Receipt size={28} color="#a7f3d0" />
        </View>
        <Text className="text-base font-semibold text-slate-700">Sale not found</Text>
        <Text className="mt-1 text-center text-xs text-slate-500">
          The sale may have been refunded or deleted.
        </Text>
      </View>
    );
  }

  const pill = statusPill(sale.status);
  const subtotal = sale.subtotal ?? sale.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const hasRefundActivity = refunds.length > 0 || /REFUND/i.test(sale.status ?? "");

  return (
    <ScrollView
      className="flex-1 bg-emerald-50/40"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      <Animated.View
        entering={FadeInDown.duration(220).easing(fastOut)}
        className="mb-3 overflow-hidden rounded-2xl border border-emerald-100 bg-white"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        }}
      >
        <View className="flex-row items-center gap-3 bg-emerald-50/60 p-4">
          <View
            className="h-12 w-12 items-center justify-center rounded-full bg-emerald-600"
            style={{
              shadowColor: EMERALD,
              shadowOpacity: 0.35,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 4,
            }}
          >
            <Receipt size={22} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-slate-800">Sale #{sale.id}</Text>
            <Text className="text-xs text-slate-500">
              {dayjs(sale.soldAt).format("MMM D, YYYY • h:mm A")}
            </Text>
          </View>
          <View className={`rounded-md px-2 py-1 ${pill.bg}`}>
            <Text className={`text-[11px] font-semibold ${pill.text}`}>{pill.label}</Text>
          </View>
        </View>

        <View className="p-4">
          <MetaRow icon={<Building2 size={14} color={EMERALD_DARK} />} label="Branch">
            {sale.branch
              ? `${sale.branch.name}${sale.branch.code ? ` (${sale.branch.code})` : ""}`
              : "—"}
          </MetaRow>
          <MetaRow icon={<UserIcon size={14} color={EMERALD_DARK} />} label="Sold by">
            {sale.seller?.name ?? "—"}
          </MetaRow>
          <MetaRow icon={<Calendar size={14} color={EMERALD_DARK} />} label="Time">
            {dayjs(sale.soldAt).format("MMM D, YYYY h:mm:ss A")}
          </MetaRow>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.duration(240).delay(40).easing(fastOut)}
        className="mb-3 overflow-hidden rounded-2xl border border-emerald-100 bg-white"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        }}
      >
        <View className="border-b border-emerald-100 bg-emerald-50/60 px-4 py-2">
          <Text className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Items
          </Text>
        </View>
        <View className="px-4 py-2">
          {sale.items.map((it, idx) => {
            const refundedQ = refundedQtyByItem.get(it.id) ?? 0;
            return (
              <Animated.View
                key={it.id}
                entering={FadeIn.duration(180).delay(Math.min(idx, 10) * 14).easing(fastOut)}
                className="border-b border-slate-100 py-3 last:border-b-0"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-semibold text-slate-800">{it.product.name}</Text>
                    <Text className="text-[11px] text-slate-500">
                      {it.quantity} × ₱{Number(it.price).toFixed(2)}
                    </Text>
                    <View className="mt-1 flex-row flex-wrap items-center gap-1">
                      {it.discount && (
                        <View className="flex-row items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5">
                          <Tag size={10} color={EMERALD} />
                          <Text className="text-[10px] font-semibold text-emerald-700">
                            {it.discount.name}
                            {it.discount.type === "PERCENTAGE" ? ` ${it.discount.value}%` : ""}
                          </Text>
                        </View>
                      )}
                      {refundedQ > 0 && (
                        <View className="flex-row items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5">
                          <Undo2 size={10} color="#b45309" />
                          <Text className="text-[10px] font-semibold text-amber-700">
                            {refundedQ} refunded
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm font-semibold text-slate-800">
                      ₱{(Number(it.price) * it.quantity).toFixed(2)}
                    </Text>
                    {it.discountAmount > 0 && (
                      <Text className="text-[11px] font-medium text-emerald-700">
                        −₱{Number(it.discountAmount).toFixed(2)}
                      </Text>
                    )}
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.duration(240).delay(80).easing(fastOut)}
        className="mb-3 overflow-hidden rounded-2xl border border-emerald-100 bg-white"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        }}
      >
        <View className="border-b border-emerald-100 bg-emerald-50/60 px-4 py-2">
          <Text className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Totals
          </Text>
        </View>
        <View className="p-4">
          <Row label="Subtotal" value={`₱${Number(subtotal).toFixed(2)}`} />
          {sale.totalDiscount > 0 && (
            <Row
              label="Discount"
              value={`−₱${Number(sale.totalDiscount).toFixed(2)}`}
              accent
            />
          )}
          <View className="mt-1 flex-row items-baseline justify-between border-t border-emerald-100 pt-2">
            <Text className="text-base font-bold text-slate-800">TOTAL</Text>
            <Text className="text-2xl font-extrabold text-emerald-600">
              ₱{Number(sale.totalAmount).toFixed(2)}
            </Text>
          </View>
          {sale.cashAmount != null && (
            <View className="mt-2 border-t border-dashed border-slate-200 pt-2">
              <Row label="Cash" value={`₱${Number(sale.cashAmount).toFixed(2)}`} />
              <Row label="Change" value={`₱${Number(sale.changeAmount ?? 0).toFixed(2)}`} />
            </View>
          )}
          {totalRefunded > 0 && (
            <View className="mt-2 border-t border-dashed border-amber-200 pt-2">
              <Row
                label="Refunded"
                value={`−₱${totalRefunded.toFixed(2)}`}
                accent
              />
              <Row
                label="Net"
                value={`₱${Math.max(0, Number(sale.totalAmount) - totalRefunded).toFixed(2)}`}
              />
            </View>
          )}
        </View>
      </Animated.View>

      {/* ── Refund actions ───────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInUp.duration(240).delay(120).easing(fastOut)}
        className="mb-3 flex-row gap-2"
      >
        <TouchableOpacity
          onPress={() => setRefundOpen(true)}
          disabled={refundable <= 0}
          activeOpacity={0.85}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 active:bg-emerald-700"
          style={{
            shadowColor: EMERALD_DARK,
            shadowOpacity: refundable <= 0 ? 0 : 0.25,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: refundable <= 0 ? 0 : 4,
            opacity: refundable <= 0 ? 0.5 : 1,
          }}
        >
          <Undo2 size={16} color="#fff" />
          <Text className="text-sm font-semibold text-white">
            {refundable <= 0 ? "Fully refunded" : "Process refund"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => refetchRefunds()}
          activeOpacity={0.85}
          className="h-11 w-11 items-center justify-center rounded-xl border border-emerald-200 bg-white active:bg-emerald-50"
        >
          {refundsFetching ? (
            <ActivityIndicator size="small" color={EMERALD_DARK} />
          ) : (
            <RotateCw size={16} color={EMERALD_DARK} />
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* ── Refund history ───────────────────────────────────────────── */}
      {hasRefundActivity && (
        <Animated.View
          entering={FadeInUp.duration(240).delay(140).easing(fastOut)}
          className="mb-3 overflow-hidden rounded-2xl border border-amber-200 bg-white"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        >
          <View className="flex-row items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
            <Undo2 size={14} color="#b45309" />
            <Text className="flex-1 text-[11px] font-bold uppercase tracking-wider text-amber-700">
              Refund history
            </Text>
            <Text className="text-[11px] font-semibold text-amber-700">
              {refunds.length} {refunds.length === 1 ? "refund" : "refunds"}
            </Text>
          </View>
          <View className="px-4 py-2">
            {refunds.length === 0 ? (
              <Text className="py-3 text-center text-xs text-slate-500">
                No refund records yet.
              </Text>
            ) : (
              refunds.map((r, idx) => (
                <Animated.View
                  key={r.id}
                  entering={FadeIn.duration(180).delay(Math.min(idx, 6) * 16).easing(fastOut)}
                  layout={LinearTransition.duration(180)}
                  className="border-b border-slate-100 py-3 last:border-b-0"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-slate-800">
                      Refund #{r.id}
                    </Text>
                    <Text className="text-sm font-bold text-amber-700">
                      −₱{Number(r.totalRefund).toFixed(2)}
                    </Text>
                  </View>
                  <Text className="text-[11px] text-slate-500">
                    {dayjs(r.createdAt).format("MMM D, YYYY • h:mm A")}
                    {r.refundedBy ? ` • by ${r.refundedBy.name}` : ""}
                  </Text>
                  {r.items.map((it) => (
                    <View
                      key={it.id}
                      className="mt-1 flex-row items-center justify-between"
                    >
                      <Text className="flex-1 text-[11px] text-slate-600">
                        • {it.product.name} × {it.quantity}
                      </Text>
                      <Text className="text-[11px] text-slate-700">
                        −₱{Number(it.refundAmount).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                  {r.reason && (
                    <View className="mt-1 rounded-md bg-slate-50 px-2 py-1.5">
                      <Text className="text-[11px] italic text-slate-600">"{r.reason}"</Text>
                    </View>
                  )}
                </Animated.View>
              ))
            )}
          </View>
        </Animated.View>
      )}

      <RefundModal
        visible={refundOpen}
        onClose={() => setRefundOpen(false)}
        sale={sale}
        refundedQtyByItem={refundedQtyByItem}
      />
    </ScrollView>
  );
}

function RefundModal({
  visible,
  onClose,
  sale,
  refundedQtyByItem,
}: {
  visible: boolean;
  onClose: () => void;
  sale: Sale;
  refundedQtyByItem: Map<number, number>;
}) {
  const qc = useQueryClient();
  const [qtyByItem, setQtyByItem] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("");

  const refundLines = useMemo(
    () =>
      sale.items.map((it) => {
        const refunded = refundedQtyByItem.get(it.id) ?? 0;
        const refundable = Math.max(0, it.quantity - refunded);
        const unitPrice = it.discountedPrice != null ? Number(it.discountedPrice) : Number(it.price);
        const qty = qtyByItem[it.id] ?? 0;
        return {
          saleItemId: it.id,
          name: it.product.name,
          unitPrice,
          refunded,
          refundable,
          qty,
          lineTotal: unitPrice * qty,
        };
      }),
    [sale.items, refundedQtyByItem, qtyByItem],
  );

  const refundTotal = refundLines.reduce((s, l) => s + l.lineTotal, 0);
  const totalQty = refundLines.reduce((s, l) => s + l.qty, 0);

  const mutation = useMutation({
    mutationFn: (payload: RefundPayload) => createRefund(sale.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["refunds", sale.id] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setQtyByItem({});
      setReason("");
      onClose();
      Alert.alert("Refund processed", `₱${refundTotal.toFixed(2)} refunded successfully.`);
    },
    onError: (e: any) => {
      Alert.alert("Refund failed", e?.response?.data?.message ?? e?.message ?? "Unknown error");
    },
  });

  function setQty(saleItemId: number, refundable: number, next: number) {
    const clamped = Math.max(0, Math.min(refundable, next));
    setQtyByItem((prev) => ({ ...prev, [saleItemId]: clamped }));
  }

  function submit() {
    const items = refundLines
      .filter((l) => l.qty > 0)
      .map((l) => ({ saleItemId: l.saleItemId, quantity: l.qty }));
    if (items.length === 0) {
      Alert.alert("Nothing to refund", "Pick at least one item to refund.");
      return;
    }
    mutation.mutate({ items, reason: reason.trim() || undefined });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/40 p-6">
        <Animated.View
          entering={FadeInDown.duration(220).easing(fastOut)}
          className="w-full max-w-lg rounded-2xl bg-white p-5"
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
              <Undo2 size={16} color="#fff" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-slate-800">Process refund</Text>
              <Text className="text-xs text-slate-500">Sale #{sale.id}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text className="text-sm font-medium text-slate-500">Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {refundLines.map((l, idx) => (
              <Animated.View
                key={l.saleItemId}
                entering={FadeIn.duration(180).delay(Math.min(idx, 8) * 16).easing(fastOut)}
                className="mb-2 rounded-xl border border-slate-200 bg-white p-3"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-2">
                    <Text numberOfLines={1} className="text-sm font-semibold text-slate-800">
                      {l.name}
                    </Text>
                    <Text className="mt-0.5 text-[11px] text-slate-500">
                      ₱{l.unitPrice.toFixed(2)} • Refunded {l.refunded} • Refundable {l.refundable}
                    </Text>
                  </View>
                  <Text className="text-sm font-semibold text-emerald-700">
                    {l.qty > 0 ? `−₱${l.lineTotal.toFixed(2)}` : "—"}
                  </Text>
                </View>

                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-[11px] text-slate-500">Refund qty</Text>
                  <View className="flex-row items-center gap-1.5">
                    <TouchableOpacity
                      onPress={() => setQty(l.saleItemId, l.refundable, l.qty - 1)}
                      disabled={l.qty <= 0}
                      className="h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-white active:bg-emerald-50"
                      style={{ opacity: l.qty <= 0 ? 0.4 : 1 }}
                    >
                      <Minus size={14} color={EMERALD_DARK} />
                    </TouchableOpacity>
                    <Text className="min-w-[24px] text-center text-sm font-semibold text-slate-800">
                      {l.qty}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setQty(l.saleItemId, l.refundable, l.qty + 1)}
                      disabled={l.qty >= l.refundable}
                      className="h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-white active:bg-emerald-50"
                      style={{ opacity: l.qty >= l.refundable ? 0.4 : 1 }}
                    >
                      <Plus size={14} color={EMERALD_DARK} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setQty(l.saleItemId, l.refundable, l.refundable)}
                      disabled={l.refundable <= 0 || l.qty >= l.refundable}
                      className="ml-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 active:bg-emerald-100"
                      style={{ opacity: l.refundable <= 0 || l.qty >= l.refundable ? 0.4 : 1 }}
                    >
                      <Text className="text-[10px] font-semibold text-emerald-700">Max</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            ))}
          </ScrollView>

          <Text className="mb-1.5 mt-2 text-sm font-medium text-slate-700">Reason (optional)</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Customer changed mind"
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={2}
            className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-sm text-slate-900"
            style={{ minHeight: 56, textAlignVertical: "top" }}
          />

          <View className="mt-3 flex-row items-baseline justify-between border-t border-emerald-100 pt-2">
            <Text className="text-sm text-slate-600">
              Refund total ({totalQty} {totalQty === 1 ? "item" : "items"})
            </Text>
            <Text className="text-xl font-extrabold text-emerald-600">
              ₱{refundTotal.toFixed(2)}
            </Text>
          </View>

          <TouchableOpacity
            onPress={submit}
            disabled={mutation.isPending || totalQty === 0}
            activeOpacity={0.85}
            className="mt-3 flex-row items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3.5 active:bg-emerald-700"
            style={{
              shadowColor: EMERALD_DARK,
              shadowOpacity: 0.3,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
              opacity: mutation.isPending || totalQty === 0 ? 0.6 : 1,
            }}
          >
            {mutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Undo2 size={16} color="#fff" />
            )}
            <Text className="text-base font-semibold text-white">
              {mutation.isPending ? "Processing..." : "Submit refund"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

function MetaRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-1.5 flex-row items-center gap-2">
      {icon}
      <Text className="w-20 text-xs text-slate-500">{label}</Text>
      <Text className="flex-1 text-xs font-semibold text-slate-700">{children}</Text>
    </View>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View className="mb-0.5 flex-row justify-between">
      <Text className="text-sm text-slate-600">{label}</Text>
      <Text
        className={`text-sm ${accent ? "font-semibold text-emerald-700" : "text-slate-800"}`}
      >
        {value}
      </Text>
    </View>
  );
}
