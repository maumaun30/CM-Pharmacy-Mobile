import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import {
  Bluetooth,
  BluetoothConnected,
  Building2,
  LogOut,
  Printer,
  Scan,
  Server,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react-native";
import { useAuth } from "@/auth/AuthContext";
import { clearPrinterMac, getSavedPrinterMac } from "@/hardware/escpos/printer";

const EMERALD = "#059669";
const EMERALD_DARK = "#047857";
const SLATE = "#64748b";
const fastOut = Easing.out(Easing.quad);

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [printerMac, setPrinterMac] = useState<string | null>(null);

  useEffect(() => {
    getSavedPrinterMac().then(setPrinterMac);
  }, []);

  const initials =
    `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`.toUpperCase() ||
    (user?.username?.[0]?.toUpperCase() ?? "?");

  const fullName =
    user?.first_name || user?.last_name
      ? `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim()
      : (user?.username ?? "Unknown");

  const branchName = user?.currentBranch?.name ?? user?.branch?.name ?? "—";
  const branchCode = user?.currentBranch?.code ?? user?.branch?.code ?? "";

  const confirmSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  };

  const confirmUnpair = async () => {
    Alert.alert("Unpair printer", "Remove the saved printer? You can re-pair anytime.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unpair",
        style: "destructive",
        onPress: async () => {
          await clearPrinterMac();
          setPrinterMac(null);
        },
      },
    ]);
  };

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
        <Text className="text-2xl font-bold text-slate-800">Settings</Text>
        <Text className="text-sm text-slate-500">Manage your session, hardware, and connection.</Text>
      </Animated.View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* ── Account card ─────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInUp.duration(260).delay(40).easing(fastOut)}
          className="mb-4 overflow-hidden rounded-2xl border border-emerald-100 bg-white"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        >
          <SectionHeader icon={<UserIcon size={14} color={EMERALD_DARK} />} label="Account" />
          <View className="flex-row items-center gap-3 p-4">
            <View
              className="h-14 w-14 items-center justify-center rounded-full bg-emerald-600"
              style={{
                shadowColor: EMERALD,
                shadowOpacity: 0.35,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
                elevation: 4,
              }}
            >
              <Text className="text-lg font-bold text-white">{initials}</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-base font-bold text-slate-800">{fullName}</Text>
                <View className="rounded-md bg-emerald-100 px-2 py-0.5">
                  <Text className="text-[10px] font-semibold uppercase text-emerald-700">{user?.role}</Text>
                </View>
              </View>
              <Text className="text-xs text-slate-500">@{user?.username}</Text>
              {user?.email && <Text className="text-xs text-slate-500">{user.email}</Text>}
            </View>
          </View>

          <View className="mx-4 mb-3 flex-row items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
            <Building2 size={16} color={EMERALD_DARK} />
            <Text className="text-sm font-medium text-slate-700">Branch</Text>
            <Text className="ml-auto text-sm font-semibold text-emerald-700">
              {branchCode ? `${branchName} (${branchCode})` : branchName}
            </Text>
          </View>

          <View className="border-t border-emerald-100 p-3">
            <TouchableOpacity
              onPress={confirmSignOut}
              activeOpacity={0.85}
              className="flex-row items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 py-3 active:bg-red-100"
            >
              <LogOut size={16} color="#b91c1c" />
              <Text className="text-sm font-semibold text-red-700">Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Receipt printer ──────────────────────────────────────── */}
        <Animated.View
          entering={FadeInUp.duration(260).delay(80).easing(fastOut)}
          className="mb-4 overflow-hidden rounded-2xl border border-emerald-100 bg-white"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        >
          <SectionHeader icon={<Printer size={14} color={EMERALD_DARK} />} label="Receipt Printer" />
          <View className="p-4">
            <View className="flex-row items-center gap-3">
              <View
                className={`h-10 w-10 items-center justify-center rounded-full ${
                  printerMac ? "bg-emerald-600" : "bg-slate-200"
                }`}
              >
                {printerMac ? (
                  <BluetoothConnected size={18} color="#fff" />
                ) : (
                  <Bluetooth size={18} color={SLATE} />
                )}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5">
                  <View
                    className={`h-2 w-2 rounded-full ${printerMac ? "bg-emerald-500" : "bg-slate-300"}`}
                  />
                  <Text
                    className={`text-sm font-semibold ${
                      printerMac ? "text-emerald-700" : "text-slate-500"
                    }`}
                  >
                    {printerMac ? "Paired" : "Not paired"}
                  </Text>
                </View>
                <Text className="mt-0.5 text-xs text-slate-500">
                  {printerMac ?? "Pair your Bluetooth ESC/POS printer to auto-print receipts."}
                </Text>
              </View>
            </View>

            <View className="mt-3 flex-row gap-2">
              <TouchableOpacity
                onPress={() => Alert.alert("Coming soon", "Printer pairing UI will be wired next.")}
                activeOpacity={0.85}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2.5 active:bg-emerald-700"
              >
                <Printer size={14} color="#fff" />
                <Text className="text-sm font-semibold text-white">
                  {printerMac ? "Re-pair" : "Pair Printer"}
                </Text>
              </TouchableOpacity>
              {printerMac && (
                <TouchableOpacity
                  onPress={confirmUnpair}
                  activeOpacity={0.85}
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 active:bg-red-100"
                >
                  <Text className="text-sm font-semibold text-red-700">Unpair</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>

        {/* ── Barcode scanner ──────────────────────────────────────── */}
        <Animated.View
          entering={FadeInUp.duration(260).delay(120).easing(fastOut)}
          className="mb-4 overflow-hidden rounded-2xl border border-emerald-100 bg-white"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        >
          <SectionHeader icon={<Scan size={14} color={EMERALD_DARK} />} label="Barcode Scanner" />
          <View className="flex-row items-center gap-3 p-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
              <Scan size={18} color={EMERALD_DARK} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-emerald-700">HID capture active</Text>
              <Text className="mt-0.5 text-xs text-slate-500">
                Pair the scanner once in Android Settings. Each scan auto-adds the matching product on the POS screen.
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Server ────────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInUp.duration(260).delay(160).easing(fastOut)}
          className="mb-4 overflow-hidden rounded-2xl border border-emerald-100 bg-white"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        >
          <SectionHeader icon={<Server size={14} color={EMERALD_DARK} />} label="Server" />
          <View className="p-4">
            <KeyValue label="API" value={process.env.EXPO_PUBLIC_API_BASE_URL ?? "(unset)"} />
            <KeyValue label="Socket" value={process.env.EXPO_PUBLIC_SOCKET_URL ?? "(unset)"} />
          </View>
        </Animated.View>

        {/* ── About ────────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeIn.duration(220).delay(200).easing(fastOut)}
          className="mb-2 flex-row items-center justify-center gap-1.5"
        >
          <ShieldCheck size={12} color={SLATE} />
          <Text className="text-[11px] text-slate-500">CM Pharmacy POS • v1.0.0</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5 border-b border-emerald-100 bg-emerald-50/60 px-4 py-2">
      {icon}
      <Text className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">{label}</Text>
    </View>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-1 flex-row items-baseline justify-between">
      <Text className="text-xs text-slate-500">{label}</Text>
      <Text className="ml-3 flex-1 text-right text-xs text-slate-700" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
