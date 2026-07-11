import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { TouchableOpacity as ListTouchableOpacity } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Receipt, RotateCw, Search, ShoppingBag, User as UserIcon } from "lucide-react-native";
import dayjs from "dayjs";
import { listSales } from "@/api/sales";
import { useAuth } from "@/auth/AuthContext";
import { useBranchSocket } from "@/socket/useBranchSocket";
import { fromApi } from "@/lib/date";
import { colors, EASE } from "@/ui/theme";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { Card } from "@/ui/Card";
import { StatCard } from "@/ui/StatCard";
import { Pill, saleStatusPill } from "@/ui/Pill";

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

export default function SalesList() {
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["sales"],
    queryFn: () => listSales(),
  });

  const { user } = useAuth();
  const branchId = user?.current_branch_id ?? user?.branch_id ?? null;

  // Real-time: refresh when a new sale lands on the branch socket, and whenever
  // the Sales tab regains focus (e.g. right after ringing one up on POS).
  useBranchSocket(branchId, { onNewSale: () => refetch() });
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const [search, setSearch] = useState("");

  const sales: Sale[] = useMemo(() => {
    const arr: Sale[] = Array.isArray(data) ? data : data?.sales ?? [];
    if (!search.trim()) return arr;
    const q = search.trim().toLowerCase();
    return arr.filter(
      (s) => String(s.id).includes(q) || (s.seller?.name ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  const todayStats = useMemo(() => {
    const today = dayjs().startOf("day");
    let count = 0;
    let total = 0;
    for (const s of sales) {
      if (fromApi(s.soldAt).isAfter(today)) {
        count++;
        total += Number(s.totalAmount) || 0;
      }
    }
    return { count, total };
  }, [sales]);

  return (
    <View className="flex-1 bg-slate-50">
      <ScreenHeader
        title="Sales"
        subtitle="Recent transactions for your branch."
        right={
          <TouchableOpacity
            onPress={() => refetch()}
            activeOpacity={0.85}
            className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200"
          >
            <RotateCw size={16} color={colors.emeraldDark} />
          </TouchableOpacity>
        }
      />

      <View className="px-4 pt-3">
        <Animated.View entering={FadeInUp.duration(240).delay(40).easing(EASE)} className="mb-3 flex-row gap-2">
          <StatCard label="Today" value={`₱${todayStats.total.toFixed(2)}`} accent sub={`${todayStats.count} ${todayStats.count === 1 ? "sale" : "sales"}`} />
          <StatCard label="All time" value={String(sales.length)} sub="total sales" />
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(240).delay(80).easing(EASE)} className="mb-3">
          <Card elevated={false} className="flex-row items-center px-3">
            <Search size={18} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by sale ID or cashier"
              placeholderTextColor={colors.textFaint}
              className="flex-1 px-3 py-3 text-base text-slate-900"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")} className="px-2 py-2">
                <Text className="text-xs text-slate-500">Clear</Text>
              </TouchableOpacity>
            )}
          </Card>
        </Animated.View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.emerald} />
        </View>
      ) : sales.length === 0 ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.emerald} />}
        >
          <Animated.View entering={FadeIn.duration(220).easing(EASE)} className="items-center">
            <View className="mb-3 h-20 w-20 items-center justify-center rounded-full bg-slate-100">
              <Receipt size={36} color={colors.textFaint} />
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
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.emerald} />}
            contentContainerStyle={{ paddingBottom: 16 }}
            renderItem={({ item }) => <SaleRow sale={item} />}
          />
        </View>
      )}
    </View>
  );
}

function SaleRow({ sale }: { sale: Sale }) {
  const router = useRouter();
  const pill = saleStatusPill(sale.status);
  const itemCount = sale.items?.reduce((sum, i) => sum + (i.quantity ?? 0), 0) ?? 0;

  return (
    <ListTouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push(`/sales/${sale.id}` as any)}
    >
          <Card className="mb-2 flex-row items-center gap-3 p-3 active:bg-slate-50">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
              <ShoppingBag size={18} color={colors.emeraldDark} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-bold text-slate-800">#{sale.id}</Text>
                <Pill label={pill.label} variant={pill.variant} />
              </View>
              <View className="mt-0.5 flex-row items-center gap-2">
                <Text className="text-[11px] text-slate-500">{fromApi(sale.soldAt).format("MMM D, h:mm A")}</Text>
                {sale.seller?.name && (
                  <View className="flex-row items-center gap-1">
                    <UserIcon size={10} color={colors.textMuted} />
                    <Text className="text-[11px] text-slate-500">{sale.seller.name}</Text>
                  </View>
                )}
              </View>
              <Text className="mt-0.5 text-[11px] text-slate-500">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-base font-extrabold text-emerald-600">₱{Number(sale.totalAmount).toFixed(2)}</Text>
              {sale.totalDiscount > 0 && (
                <Text className="text-[11px] font-medium text-emerald-700">−₱{Number(sale.totalDiscount).toFixed(2)}</Text>
              )}
            </View>
            <ChevronRight size={18} color={colors.textFaint} />
          </Card>
    </ListTouchableOpacity>
  );
}
