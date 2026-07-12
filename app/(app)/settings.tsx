import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import dayjs from "dayjs";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import {
  Bluetooth,
  BluetoothConnected,
  Building2,
  Check,
  KeyRound,
  Link2,
  LogOut,
  Printer,
  Scan,
  Server,
  ShieldCheck,
  Unlink,
  User as UserIcon,
} from "lucide-react-native";
import { useAuth } from "@/auth/AuthContext";
import { changePassword } from "@/api/auth";
import { getGoogleIdToken, GoogleCancelled, googleConfigured } from "@/auth/google";
import { GoogleButton, GoogleG } from "@/ui/GoogleButton";
import {
  clearPrinterMac,
  getSavedPrinterMac,
  savePrinterMac,
  listPairedDevices,
  printReceipt,
  kickCashDrawer,
  type PairedDevice,
} from "@/hardware/escpos/printer";
import { colors, EASE } from "@/ui/theme";
import { ScreenHeader } from "@/ui/ScreenHeader";

const EMERALD = colors.emerald;
const EMERALD_DARK = colors.emeraldDark;
const SLATE = colors.textMuted;
const fastOut = EASE;

export default function SettingsScreen() {
  const { user, signOut, linkGoogle, unlinkGoogle } = useAuth();
  const [printerMac, setPrinterMac] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [pairOpen, setPairOpen] = useState(false);
  const [pairDevices, setPairDevices] = useState<PairedDevice[]>([]);
  const [pairLoading, setPairLoading] = useState(false);
  const [printerBusy, setPrinterBusy] = useState(false);
  // Change-password modal
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    getSavedPrinterMac().then(setPrinterMac);
  }, []);

  const openPair = async () => {
    setPairOpen(true);
    setPairLoading(true);
    try {
      setPairDevices(await listPairedDevices());
    } catch (e: any) {
      setPairOpen(false);
      Alert.alert(
        "Bluetooth",
        e?.message ??
          "Couldn't list devices. Pair the printer in Android Bluetooth settings first, then try again.",
      );
    } finally {
      setPairLoading(false);
    }
  };

  const selectDevice = async (d: PairedDevice) => {
    await savePrinterMac(d.address);
    setPrinterMac(d.address);
    setPairOpen(false);
  };

  const testPrint = async () => {
    if (printerBusy) return;
    setPrinterBusy(true);
    const res = await printReceipt(
      {
        branchName,
        saleId: 0,
        cashier: fullName,
        date: dayjs().format("MMM D, YYYY h:mm A"),
        lines: [{ name: "Test print", qty: 1, price: 0 }],
        subtotal: 0,
        discount: 0,
        total: 0,
        cash: 0,
        change: 0,
      },
      { openDrawer: false },
    );
    setPrinterBusy(false);
    Alert.alert(
      res.ok ? "Test sent" : "Print failed",
      res.ok ? "Check the printer output." : res.error ?? "Unknown error",
    );
  };

  const openDrawer = async () => {
    if (printerBusy) return;
    setPrinterBusy(true);
    const res = await kickCashDrawer();
    setPrinterBusy(false);
    if (!res.ok) Alert.alert("Cash drawer", res.error ?? "Failed to open");
  };

  const onConnectGoogle = async () => {
    if (googleBusy) return;
    setGoogleBusy(true);
    try {
      const idToken = await getGoogleIdToken();
      await linkGoogle(idToken);
    } catch (e: any) {
      if (!(e instanceof GoogleCancelled)) {
        Alert.alert(
          "Couldn't connect Google",
          e?.response?.data?.message ?? e?.message ?? "Please try again.",
        );
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const confirmDisconnectGoogle = () => {
    Alert.alert(
      "Disconnect Google",
      "You'll still sign in with your username, password, or PIN.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            setGoogleBusy(true);
            try {
              await unlinkGoogle();
            } catch (e: any) {
              Alert.alert(
                "Couldn't disconnect",
                e?.response?.data?.message ?? e?.message ?? "Please try again.",
              );
            } finally {
              setGoogleBusy(false);
            }
          },
        },
      ],
    );
  };

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

  const openChangePassword = () => {
    setPwCurrent("");
    setPwNew("");
    setPwConfirm("");
    setPwOpen(true);
  };

  const submitChangePassword = async () => {
    if (!pwCurrent || !pwNew) {
      Alert.alert("Missing fields", "Enter your current and new password.");
      return;
    }
    if (pwNew.length < 6) {
      Alert.alert("Weak password", "New password must be at least 6 characters.");
      return;
    }
    if (pwNew !== pwConfirm) {
      Alert.alert("Passwords don't match", "New password and confirmation must match.");
      return;
    }
    setPwBusy(true);
    try {
      await changePassword(pwCurrent, pwNew);
      setPwOpen(false);
      Alert.alert("Password changed", "Your password has been updated.");
    } catch (e: any) {
      Alert.alert(
        "Couldn't change password",
        e?.response?.data?.message ?? e?.message ?? "Unknown error",
      );
    } finally {
      setPwBusy(false);
    }
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
    <View className="flex-1 bg-slate-50">
      <ScreenHeader title="Settings" subtitle="Manage your session, hardware, and connection." />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* ── Account card ─────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInUp.duration(260).delay(40).easing(fastOut)}
          className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white"
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

          <View className="border-t border-slate-200 p-3 gap-2">
            <TouchableOpacity
              onPress={openChangePassword}
              activeOpacity={0.85}
              className="flex-row items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 py-3 active:bg-emerald-100"
            >
              <KeyRound size={16} color={EMERALD_DARK} />
              <Text className="text-sm font-semibold text-emerald-700">Change Password</Text>
            </TouchableOpacity>
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

        {/* ── Linked accounts ──────────────────────────────────────── */}
        {googleConfigured && (
          <Animated.View
            entering={FadeInUp.duration(260).delay(60).easing(fastOut)}
            className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white"
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.04,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
            <SectionHeader icon={<Link2 size={14} color={EMERALD_DARK} />} label="Linked Accounts" />
            <View className="p-4">
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white">
                  <GoogleG size={18} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-slate-800">Google</Text>
                  {user?.google_linked ? (
                    <View className="flex-row items-center gap-1">
                      <Check size={12} color={EMERALD} />
                      <Text className="text-xs text-emerald-700" numberOfLines={1}>
                        Connected{user.google_email ? ` · ${user.google_email}` : ""}
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-xs text-slate-500">Not connected — sign in faster next time</Text>
                  )}
                </View>
              </View>

              <View className="mt-3">
                {user?.google_linked ? (
                  <TouchableOpacity
                    onPress={confirmDisconnectGoogle}
                    disabled={googleBusy}
                    activeOpacity={0.85}
                    className="flex-row items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-2.5 active:bg-red-100"
                    style={{ opacity: googleBusy ? 0.6 : 1 }}
                  >
                    <Unlink size={14} color="#b91c1c" />
                    <Text className="text-sm font-semibold text-red-700">Disconnect</Text>
                  </TouchableOpacity>
                ) : (
                  <GoogleButton onPress={onConnectGoogle} loading={googleBusy} />
                )}
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Receipt printer ──────────────────────────────────────── */}
        <Animated.View
          entering={FadeInUp.duration(260).delay(80).easing(fastOut)}
          className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white"
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
                onPress={openPair}
                activeOpacity={0.85}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2.5 active:bg-emerald-700"
              >
                <Bluetooth size={14} color="#fff" />
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

            {printerMac && (
              <View className="mt-2 flex-row gap-2">
                <TouchableOpacity
                  onPress={testPrint}
                  disabled={printerBusy}
                  activeOpacity={0.85}
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white py-2.5 active:bg-emerald-50"
                  style={{ opacity: printerBusy ? 0.6 : 1 }}
                >
                  {printerBusy ? (
                    <ActivityIndicator size="small" color={EMERALD_DARK} />
                  ) : (
                    <Printer size={14} color={EMERALD_DARK} />
                  )}
                  <Text className="text-sm font-semibold text-emerald-700">Test print</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={openDrawer}
                  disabled={printerBusy}
                  activeOpacity={0.85}
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white py-2.5 active:bg-emerald-50"
                  style={{ opacity: printerBusy ? 0.6 : 1 }}
                >
                  <Text className="text-sm font-semibold text-emerald-700">Open drawer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── Barcode scanner ──────────────────────────────────────── */}
        <Animated.View
          entering={FadeInUp.duration(260).delay(120).easing(fastOut)}
          className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white"
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
          className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white"
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
          <Text className="text-[11px] text-slate-500">Maun Pharmacy • v1.0.0</Text>
        </Animated.View>
      </ScrollView>

      {/* ── Printer pairing modal (bonded Bluetooth devices) ──────────── */}
      <Modal visible={pairOpen} transparent animationType="fade" onRequestClose={() => setPairOpen(false)}>
        <View className="flex-1 items-center justify-center bg-black/40 p-6">
          <View className="w-full max-w-md rounded-2xl bg-white p-5">
            <View className="mb-3 flex-row items-center gap-2">
              <Bluetooth size={18} color={EMERALD_DARK} />
              <Text className="flex-1 text-base font-bold text-slate-800">Select printer</Text>
              <TouchableOpacity onPress={() => setPairOpen(false)}>
                <Text className="text-sm font-medium text-slate-500">Close</Text>
              </TouchableOpacity>
            </View>

            {pairLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator color={EMERALD} />
                <Text className="mt-2 text-xs text-slate-500">Reading paired devices…</Text>
              </View>
            ) : pairDevices.length === 0 ? (
              <Text className="py-6 text-center text-sm text-slate-500">
                No paired devices. Pair the printer in Android Bluetooth settings first, then reopen this.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {pairDevices.map((d) => {
                  const selected = d.address === printerMac;
                  return (
                    <TouchableOpacity
                      key={d.address}
                      onPress={() => selectDevice(d)}
                      activeOpacity={0.85}
                      className={`mb-2 flex-row items-center gap-3 rounded-xl border p-3 ${
                        selected ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <BluetoothConnected size={16} color={selected ? EMERALD_DARK : SLATE} />
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-slate-800">{d.name}</Text>
                        <Text className="text-[11px] text-slate-500">{d.address}</Text>
                      </View>
                      {selected && <Check size={16} color={EMERALD_DARK} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Change password modal ─────────────────────────────────────── */}
      <Modal visible={pwOpen} transparent animationType="fade" onRequestClose={() => setPwOpen(false)}>
        <View className="flex-1 items-center justify-center bg-black/40 p-6">
          <View className="w-full max-w-md rounded-2xl bg-white p-5">
            <View className="mb-3 flex-row items-center gap-2">
              <KeyRound size={18} color={EMERALD_DARK} />
              <Text className="flex-1 text-base font-bold text-slate-800">Change password</Text>
              <TouchableOpacity onPress={() => setPwOpen(false)} disabled={pwBusy}>
                <Text className="text-sm font-medium text-slate-500">Close</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              value={pwCurrent}
              onChangeText={setPwCurrent}
              placeholder="Current password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base text-slate-900"
            />
            <TextInput
              value={pwNew}
              onChangeText={setPwNew}
              placeholder="New password (min 6 characters)"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base text-slate-900"
            />
            <TextInput
              value={pwConfirm}
              onChangeText={setPwConfirm}
              placeholder="Confirm new password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base text-slate-900"
            />

            <TouchableOpacity
              onPress={submitChangePassword}
              disabled={pwBusy}
              activeOpacity={0.85}
              className="flex-row items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 active:bg-emerald-700"
              style={{ opacity: pwBusy ? 0.6 : 1 }}
            >
              {pwBusy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <KeyRound size={16} color="#fff" />
              )}
              <Text className="text-sm font-semibold text-white">Update password</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-4 py-2">
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
