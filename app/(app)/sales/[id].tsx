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
  Printer,
  Receipt,
  RotateCw,
  Tag,
  Undo2,
  User as UserIcon,
} from "lucide-react-native";
import dayjs from "dayjs";
import { createRefund, createRefundRequest, listRefunds, listSales, type RefundPayload } from "@/api/sales";
import { useBranchSocket } from "@/socket/useBranchSocket";
import { printReceipt } from "@/hardware/escpos/printer";
import { branchReceiptFields, type ReceiptData } from "@/hardware/escpos/receiptTemplate";
import { computeVat, type VatLine } from "@/pos/vat";
import { isVatExemptCategory, type DiscountCategory } from "@/api/discounts";
import { fromApi } from "@/lib/date";
import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { colors, EASE } from "@/ui/theme";
import { Pill, saleStatusPill } from "@/ui/Pill";

// Local aliases kept so existing inline usages read the same, but sourced from
// the shared theme so the palette lives in one place.
const EMERALD = colors.emerald;
const EMERALD_DARK = colors.emeraldDark;
const SLATE = colors.textMuted;
const fastOut = EASE;

interface SaleItem {
  id: number;
  product: { id: number; name: string };
  quantity: number;
  price: number;
  discountedPrice: number | null;
  discountAmount: number;
  discount: { id: number; name: string; type: string; value: number; category?: DiscountCategory } | null;
}

interface Sale {
  id: number;
  totalAmount: number;
  totalDiscount: number;
  subtotal: number | null;
  cashAmount: number | null;
  changeAmount: number | null;
  customerName?: string | null;
  customerIdNumber?: string | null;
  customerDiscountType?: string | null;
  soldAt: string;
  status: string | null;
  branch?: {
    id: number; name: string; code: string;
    address?: string | null; city?: string | null; province?: string | null;
    postal_code?: string | null; phone?: string | null; tin?: string | null;
  } | null;
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

// Rebuild a printable receipt from the loaded sale, for reprinting — including
// the VAT breakdown and (for senior/PWD sales) the customer record.
function saleToReceiptData(s: Sale): ReceiptData {
  const vatLines: VatLine[] = s.items.map((i) => {
    const gross = i.price * i.quantity;
    const lineTotal = (i.discountedPrice ?? i.price) * i.quantity;
    const exempt = !!i.discount?.category && isVatExemptCategory(i.discount.category);
    return { gross, lineTotal, vatExempt: exempt };
  });
  const vat = computeVat(vatLines);
  const regularDiscount = s.items.reduce((sum, i) => {
    const exempt = !!i.discount?.category && isVatExemptCategory(i.discount.category);
    if (exempt || i.discountedPrice == null) return sum;
    return sum + (i.price - i.discountedPrice) * i.quantity;
  }, 0);

  const customer =
    s.customerName && s.customerDiscountType
      ? {
          name: s.customerName,
          idNumber: s.customerIdNumber ?? "",
          discountType: s.customerDiscountType,
        }
      : null;

  return {
    ...branchReceiptFields(s.branch),
    saleId: s.id,
    cashier: s.seller?.name ?? "",
    date: fromApi(s.soldAt).format("MMM D, YYYY h:mm A"),
    lines: s.items.map((i) => ({
      name: i.product?.name ?? "Item",
      qty: i.quantity,
      price: i.price,
      discountAmount: i.discountAmount || undefined,
    })),
    subtotal: s.subtotal ?? s.totalAmount,
    discount: regularDiscount,
    total: s.totalAmount,
    cash: s.cashAmount ?? 0,
    change: s.changeAmount ?? 0,
    vat,
    customer,
  };
}

export default function SaleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const saleId = Number(id);
  const [refundOpen, setRefundOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const { user } = useAuth();
  const qc = useQueryClient();
  // Issuing refunds is a supervisor action (API: sales.refund → admin + manager).
  // Cashiers can still view the sale and its refund history, just not refund.
  const canRefund = can(user, "sales.refund");

  const { data, isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: () => listSales(),
  });

  // Live feedback for the requester: when a supervisor resolves this user's
  // refund request remotely, refresh the sale/refunds and tell them.
  const activeBranchId = user?.current_branch_id ?? user?.branch_id ?? null;
  useBranchSocket(activeBranchId, {
    onRefundRequestResolved: (p) => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["refunds", saleId] });
      if (p?.requested_by === user?.id) {
        Alert.alert(
          p?.status === "approved" ? "Refund request approved" : "Refund request declined",
          `Sale #${p?.sale_id}${p?.review_note ? ` — ${p.review_note}` : ""}`,
        );
      }
    },
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
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator color={EMERALD} />
      </View>
    );
  }

  if (!sale) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-6">
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

  const pill = saleStatusPill(sale.status);
  const subtotal = sale.subtotal ?? sale.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const hasRefundActivity = refunds.length > 0 || /REFUND/i.test(sale.status ?? "");

  const reprint = async () => {
    if (printing || !sale) return;
    setPrinting(true);
    const res = await printReceipt(saleToReceiptData(sale), { openDrawer: false });
    setPrinting(false);
    if (!res.ok) {
      Alert.alert(
        res.error === "No printer paired" ? "No printer paired" : "Print failed",
        res.error ?? "Unknown error",
      );
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      <Animated.View
        entering={FadeInDown.duration(220).easing(fastOut)}
        className="mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        }}
      >
        <View className="flex-row items-center gap-3 bg-slate-50 p-4">
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
              {fromApi(sale.soldAt).format("MMM D, YYYY • h:mm A")}
            </Text>
          </View>
          <Pill label={pill.label} variant={pill.variant} />
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
            {fromApi(sale.soldAt).format("MMM D, YYYY h:mm:ss A")}
          </MetaRow>
          {sale.customerDiscountType && (
            <MetaRow
              icon={<UserIcon size={14} color={EMERALD_DARK} />}
              label={sale.customerDiscountType === "SENIOR_CITIZEN" ? "Senior Citizen" : "PWD"}
            >
              {`${sale.customerName ?? "—"}${sale.customerIdNumber ? ` · ${sale.customerIdNumber}` : ""}`}
            </MetaRow>
          )}
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.duration(240).delay(40).easing(fastOut)}
        className="mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        }}
      >
        <View className="border-b border-slate-200 bg-slate-50 px-4 py-2">
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
        className="mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        }}
      >
        <View className="border-b border-slate-200 bg-slate-50 px-4 py-2">
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
          <View className="mt-1 flex-row items-baseline justify-between border-t border-slate-200 pt-2">
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

      {/* ── Actions: reprint (all roles) + refund (supervisors only) ──── */}
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
            {refundable <= 0
              ? "Fully refunded"
              : canRefund
                ? "Process refund"
                : "Request refund"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={reprint}
          disabled={printing}
          activeOpacity={0.85}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white py-3 active:bg-emerald-50"
          style={{ opacity: printing ? 0.6 : 1 }}
        >
          {printing ? (
            <ActivityIndicator size="small" color={EMERALD_DARK} />
          ) : (
            <Printer size={16} color={EMERALD_DARK} />
          )}
          <Text className="text-sm font-semibold text-emerald-700">Reprint receipt</Text>
        </TouchableOpacity>
        {canRefund && (
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
        )}
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
                    {fromApi(r.createdAt).format("MMM D, YYYY • h:mm A")}
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
        requirePin={!canRefund}
      />
    </ScrollView>
  );
}

function RefundModal({
  visible,
  onClose,
  sale,
  refundedQtyByItem,
  requirePin,
}: {
  visible: boolean;
  onClose: () => void;
  sale: Sale;
  refundedQtyByItem: Map<number, number>;
  requirePin: boolean;
}) {
  const qc = useQueryClient();
  const [qtyByItem, setQtyByItem] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("");
  const [managerPin, setManagerPin] = useState("");

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
      setManagerPin("");
      onClose();
      Alert.alert("Refund processed", `₱${refundTotal.toFixed(2)} refunded successfully.`);
    },
    onError: (e: any) => {
      Alert.alert("Refund failed", e?.response?.data?.message ?? e?.message ?? "Unknown error");
    },
  });

  // No supervisor on the floor? Send the refund for remote approval instead.
  const requestMutation = useMutation({
    mutationFn: (payload: { items: { saleItemId: number; quantity: number }[]; reason?: string }) =>
      createRefundRequest(sale.id, payload),
    onSuccess: () => {
      setQtyByItem({});
      setReason("");
      setManagerPin("");
      onClose();
      Alert.alert(
        "Request sent",
        `₱${refundTotal.toFixed(2)} refund request submitted — you'll be notified once a manager reviews it.`,
      );
    },
    onError: (e: any) => {
      Alert.alert("Request failed", e?.response?.data?.message ?? e?.message ?? "Unknown error");
    },
  });

  function setQty(saleItemId: number, refundable: number, next: number) {
    const clamped = Math.max(0, Math.min(refundable, next));
    setQtyByItem((prev) => ({ ...prev, [saleItemId]: clamped }));
  }

  function selectedItems() {
    return refundLines
      .filter((l) => l.qty > 0)
      .map((l) => ({ saleItemId: l.saleItemId, quantity: l.qty }));
  }

  function submit() {
    const items = selectedItems();
    if (items.length === 0) {
      Alert.alert("Nothing to refund", "Pick at least one item to refund.");
      return;
    }
    if (requirePin && !managerPin.trim()) {
      Alert.alert("Manager PIN required", "Enter a manager's PIN to authorize this refund.");
      return;
    }
    mutation.mutate({
      items,
      reason: reason.trim() || undefined,
      managerPin: requirePin ? managerPin.trim() : undefined,
    });
  }

  function submitRequest() {
    const items = selectedItems();
    if (items.length === 0) {
      Alert.alert("Nothing to refund", "Pick at least one item to refund.");
      return;
    }
    requestMutation.mutate({ items, reason: reason.trim() || undefined });
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
            className="rounded-lg border border-emerald-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            style={{ minHeight: 56, textAlignVertical: "top" }}
          />

          {requirePin && (
            <View className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <Text className="mb-2 text-sm font-semibold text-amber-800">
                Manager authorization<Text className="text-red-500"> *</Text>
              </Text>
              <TextInput
                value={managerPin}
                onChangeText={(t) => setManagerPin(t.replace(/[^0-9]/g, ""))}
                placeholder="Manager PIN"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                keyboardType="number-pad"
                maxLength={6}
                className="rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-base tracking-widest text-slate-900"
              />
              <Text className="mt-1 text-[11px] text-amber-700">
                A manager or admin must enter their PIN to approve this refund.
              </Text>

              <TouchableOpacity
                onPress={submitRequest}
                disabled={requestMutation.isPending || totalQty === 0}
                activeOpacity={0.85}
                className="mt-3 flex-row items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white py-2.5 active:bg-amber-100"
                style={{ opacity: requestMutation.isPending || totalQty === 0 ? 0.6 : 1 }}
              >
                {requestMutation.isPending ? (
                  <ActivityIndicator size="small" color="#b45309" />
                ) : (
                  <Undo2 size={14} color="#b45309" />
                )}
                <Text className="text-sm font-semibold text-amber-800">
                  {requestMutation.isPending ? "Sending request..." : "No manager around? Request approval"}
                </Text>
              </TouchableOpacity>
              <Text className="mt-1 text-[10px] text-amber-700">
                Sends the refund for remote approval — no PIN needed.
              </Text>
            </View>
          )}

          <View className="mt-3 flex-row items-baseline justify-between border-t border-slate-200 pt-2">
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
