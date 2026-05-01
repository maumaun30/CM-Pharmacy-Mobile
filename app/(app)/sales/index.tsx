import { useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { FlashList } from "@shopify/flash-list";
import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Receipt, RotateCw, Search, ShoppingBag, Undo2, User as UserIcon } from "lucide-react-native";
import dayjs from "dayjs";
import { listSales } from "@/api/sales";

const EMERALD = "#059669";
const EMERALD_DARK = "#047857";
const SLATE = "#64748b";
const fastOut = Easing.out(Easing.quad);

interface Sale {
  id: number;
  totalAmount: number;
  totalDiscount: number;
  subtotal: number | null;
  soldAt: string;
  status: string | null;
  seller?: { name: string } | null;
  items: { id: number; quantity: number }[];
}

function statusPill(status: string | null) {
  const s = (status ?? "COMPLETED").toUpperCase();
  if (s === "PARTIAL_REFUND")
    return { label: "Partial Refund", bg: "bg-amber-100", text: "text-amber-700", icon: <Undo2 size={11} color="#b45309" /> };
  if (s === "REFUNDED")
    return { label: "Refunded", bg: "bg-red-100", text: "text-red-700", icon: <Undo2 size={11} color="#b91c1c" /> };
  return { label: "Completed", bg: "bg-emerald-100", text: "text-emerald-700", icon: null as any };
}

export default function SalesList() {
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["sales"],
    queryFn: () => listSales(),
  });

  const [search, setSearch] = useState("");

  const sales: Sale[] = useMemo(() => {
    const arr: Sale[] = Array.isArray(data) ? data : data?.sales ?? [];
    if (!search.trim()) return arr;
    const q = search.trim().toLowerCase();
    return arr.filter(
      (s) =>
        String(s.id).includes(q) ||
        (s.seller?.name ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  const todayStats = useMemo(() => {
    const today = dayjs().startOf("day");
    let count = 0;
    let total = 0;
    for (const s of sales) {
      if (dayjs(s.soldAt).isAfter(today)) {
        count++;
        total += Number(s.totalAmount) || 0;
      }
    }
    return { count, total };
  }, [sales]);

  return (
    <View className="flex-1 bg-emerald-50/40">
      <Animated.View
        entering={FadeInDown.duration(220).easing(fastOut)}
        className="border-b border-emerald-100 bg-white px-4 py-4"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.03,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        }}
      >
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-slate-800">Sales</Text>
            <Text className="text-sm text-slate-500">Recent transactions for your branch.</Text>
          </View>
          <TouchableOpacity
            onPress={() => refetch()}
            activeOpacity={0.85}
            className="h-10 w-10 items-center justify-center rounded-full bg-emerald-100 active:bg-emerald-200"
          >
            <RotateCw size={16} color={EMERALD_DARK} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <View className="px-4 pt-3">
        <Animated.View
          entering={FadeInUp.duration(240).delay(40).easing(fastOut)}
          className="mb-3 flex-row gap-2"
        >
          <View
            className="flex-1 rounded-xl border border-emerald-100 bg-white p-3"
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.04,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
              elevation: 1,
            }}
          >
            <Text className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Today</Text>
            <Text className="text-2xl font-extrabold text-emerald-600">
              ₱{todayStats.total.toFixed(2)}
            </Text>
            <Text className="text-xs text-slate-500">
              {todayStats.count} {todayStats.count === 1 ? "sale" : "sales"}
            </Text>
          </View>
          <View
            className="flex-1 rounded-xl border border-emerald-100 bg-white p-3"
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.04,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
              elevation: 1,
            }}
          >
            <Text className="text-[11px] font-medium uppercase tracking-wider text-slate-500">All time</Text>
            <Text className="text-2xl font-extrabold text-slate-700">{sales.length}</Text>
            <Text className="text-xs text-slate-500">total sales</Text>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.duration(240).delay(80).easing(fastOut)}
          className="mb-3 flex-row items-center rounded-xl border border-emerald-100 bg-white px-3"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 1,
          }}
        >
          <Search size={18} color={SLATE} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by sale ID or cashier"
            placeholderTextColor="#94a3b8"
            className="flex-1 px-3 py-3 text-base text-slate-900"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} className="px-2 py-2">
              <Text className="text-xs text-slate-500">Clear</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={EMERALD} />
        </View>
      ) : sales.length === 0 ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={EMERALD} />}
        >
          <Animated.View entering={FadeIn.duration(220).easing(fastOut)} className="items-center">
            <View className="mb-3 h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
              <Receipt size={36} color="#a7f3d0" />
            </View>
            <Text className="text-base font-semibold text-slate-700">No sales yet</Text>
            <Text className="mt-1 text-center text-xs text-slate-500">
              {search ? "Try a different search term." : "Your sales will appear here as you ring them up."}
            </Text>
          </Animated.View>
        </ScrollView>
      ) : (
        <View className="flex-1 px-4 pb-2">
          <FlashList
            data={sales}
            keyExtractor={(s) => String(s.id)}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={EMERALD} />}
            contentContainerStyle={{ paddingBottom: 16 }}
            renderItem={({ item, index }) => <SaleRow sale={item} index={index} />}
          />
        </View>
      )}
    </View>
  );
}

function SaleRow({ sale, index }: { sale: Sale; index: number }) {
  const pill = statusPill(sale.status);
  const itemCount = sale.items?.reduce((sum, i) => sum + (i.quantity ?? 0), 0) ?? 0;

  return (
    <Animated.View entering={FadeInUp.duration(200).delay(Math.min(index, 10) * 18).easing(fastOut)}>
      <Link href={`/(app)/sales/${sale.id}` as any} asChild>
        <TouchableOpacity
          activeOpacity={0.85}
          className="mb-2 rounded-xl border border-emerald-100 bg-white p-3 active:border-emerald-300 active:bg-emerald-50"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.03,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }}
        >
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-emerald-100">
              <ShoppingBag size={18} color={EMERALD_DARK} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-bold text-slate-800">#{sale.id}</Text>
                <View className={`flex-row items-center gap-1 rounded-md px-1.5 py-0.5 ${pill.bg}`}>
                  {pill.icon}
                  <Text className={`text-[10px] font-semibold ${pill.text}`}>{pill.label}</Text>
                </View>
              </View>
              <View className="mt-0.5 flex-row items-center gap-2">
                <Text className="text-[11px] text-slate-500">
                  {dayjs(sale.soldAt).format("MMM D, h:mm A")}
                </Text>
                {sale.seller?.name && (
                  <View className="flex-row items-center gap-1">
                    <UserIcon size={10} color={SLATE} />
                    <Text className="text-[11px] text-slate-500">{sale.seller.name}</Text>
                  </View>
                )}
              </View>
              <Text className="mt-0.5 text-[11px] text-slate-500">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-base font-extrabold text-emerald-600">
                ₱{Number(sale.totalAmount).toFixed(2)}
              </Text>
              {sale.totalDiscount > 0 && (
                <Text className="text-[11px] font-medium text-emerald-700">
                  −₱{Number(sale.totalDiscount).toFixed(2)}
                </Text>
              )}
            </View>
            <ChevronRight size={18} color={SLATE} />
          </View>
        </TouchableOpacity>
      </Link>
    </Animated.View>
  );
}
