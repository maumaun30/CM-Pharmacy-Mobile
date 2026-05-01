import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, ShieldCheck, User } from "lucide-react-native";
import { useAuth } from "@/auth/AuthContext";

const EMERALD = "#059669";
const EMERALD_DARK = "#047857";
const SLATE = "#64748b";

type LoginState = "idle" | "loading" | "success";

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<LoginState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [usernameFocus, setUsernameFocus] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);

  const isBusy = state !== "idle";
  const canSubmit = !isBusy && username.trim().length > 0 && password.length > 0;
  const fastOut = Easing.out(Easing.quad);

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  const triggerShake = () => {
    shakeX.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
      ),
      3,
      true,
    );
    setTimeout(() => (shakeX.value = withTiming(0, { duration: 60 })), 320);
  };

  const ringRotate = useSharedValue(0);
  useEffect(() => {
    if (state === "loading") {
      ringRotate.value = 0;
      ringRotate.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1);
    }
  }, [state, ringRotate]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${ringRotate.value}deg` }] }));

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setState("loading");
    try {
      await signIn(username.trim(), password);
      setState("success");
      setTimeout(() => router.replace("/(app)/pos"), 550);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Login failed. Please try again.");
      setState("idle");
      triggerShake();
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-emerald-50 px-8">
      <Animated.View
        entering={FadeIn.duration(400).easing(fastOut)}
        className="absolute inset-0"
        pointerEvents="none"
      >
        <View className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-emerald-200 opacity-50" />
        <View className="absolute -right-20 bottom-20 h-80 w-80 rounded-full bg-green-200 opacity-50" />
        <View className="absolute right-1/4 top-1/3 h-40 w-40 rounded-full bg-teal-200 opacity-40" />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(320).easing(fastOut)}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-emerald-100 bg-white p-8"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        }}
      >
        <View className="mb-6 items-center">
          <Animated.View
            entering={ZoomIn.duration(280).delay(80).easing(fastOut)}
            className="mb-3 h-16 w-16 items-center justify-center rounded-full bg-emerald-600"
            style={{
              shadowColor: EMERALD,
              shadowOpacity: 0.4,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
          >
            <Lock size={28} color="#fff" />
          </Animated.View>
          <Animated.Text
            entering={FadeInUp.duration(260).delay(120).easing(fastOut)}
            className="text-2xl font-bold text-slate-800"
          >
            CM Pharmacy POS
          </Animated.Text>
          <Animated.Text
            entering={FadeInUp.duration(260).delay(160).easing(fastOut)}
            className="mt-1 text-sm text-slate-500"
          >
            Welcome back! Sign in to continue
          </Animated.Text>
        </View>

        {error && (
          <Animated.View
            key={error}
            entering={FadeInDown.duration(200).easing(fastOut)}
            style={shakeStyle}
            className="mb-4 flex-row items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3"
          >
            <AlertCircle size={18} color="#dc2626" />
            <Text className="flex-1 text-sm font-medium text-red-700">{error}</Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeInUp.duration(260).delay(200).easing(fastOut)}>
          <Text className="mb-1.5 text-sm font-medium text-slate-700">Username</Text>
          <View
            className={`mb-4 flex-row items-center rounded-lg border bg-slate-50 ${
              usernameFocus ? "border-emerald-500 bg-white" : "border-slate-300"
            }`}
          >
            <View className="pl-3">
              <User size={18} color={usernameFocus ? EMERALD : SLATE} />
            </View>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isBusy}
              value={username}
              onChangeText={setUsername}
              onFocus={() => setUsernameFocus(true)}
              onBlur={() => setUsernameFocus(false)}
              onSubmitEditing={onSubmit}
              returnKeyType="next"
              className="flex-1 px-3 py-3 text-base text-slate-900"
              placeholder="Enter your username"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(260).delay(240).easing(fastOut)}>
          <Text className="mb-1.5 text-sm font-medium text-slate-700">Password</Text>
          <View
            className={`mb-6 flex-row items-center rounded-lg border bg-slate-50 ${
              passwordFocus ? "border-emerald-500 bg-white" : "border-slate-300"
            }`}
          >
            <View className="pl-3">
              <Lock size={18} color={passwordFocus ? EMERALD : SLATE} />
            </View>
            <TextInput
              secureTextEntry={!showPassword}
              editable={!isBusy}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocus(true)}
              onBlur={() => setPasswordFocus(false)}
              onSubmitEditing={onSubmit}
              returnKeyType="go"
              className="flex-1 px-3 py-3 text-base text-slate-900"
              placeholder="Enter your password"
              placeholderTextColor="#94a3b8"
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} className="px-3 py-3" disabled={isBusy}>
              {showPassword ? <EyeOff size={18} color={SLATE} /> : <Eye size={18} color={SLATE} />}
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(260).delay(280).easing(fastOut)}>
          <TouchableOpacity
            onPress={onSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
            className="rounded-lg bg-emerald-600 py-3.5 active:bg-emerald-700"
            style={{
              shadowColor: EMERALD_DARK,
              shadowOpacity: 0.3,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
              opacity: canSubmit ? 1 : 0.6,
            }}
          >
            <View className="flex-row items-center justify-center gap-2">
              <ShieldCheck size={18} color="#fff" />
              <Text className="text-base font-semibold text-white">Sign In</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <Animated.Text
          entering={FadeIn.duration(260).delay(360)}
          className="mt-6 text-center text-[11px] text-slate-400"
        >
          {process.env.EXPO_PUBLIC_API_BASE_URL ?? "API not configured"}
        </Animated.Text>

        {isBusy && (
          <Animated.View
            entering={FadeIn.duration(180)}
            className="absolute inset-0 items-center justify-center bg-white/95"
          >
            {state === "loading" ? (
              <Animated.View entering={ZoomIn.duration(220).easing(fastOut)} className="items-center gap-3">
                <View className="h-20 w-20 items-center justify-center">
                  <Animated.View
                    style={[
                      ringStyle,
                      {
                        position: "absolute",
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        borderWidth: 4,
                        borderColor: "#a7f3d0",
                        borderTopColor: EMERALD,
                      },
                    ]}
                  />
                  <View
                    className="h-16 w-16 items-center justify-center rounded-full bg-emerald-600"
                    style={{
                      shadowColor: EMERALD,
                      shadowOpacity: 0.4,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 6,
                    }}
                  >
                    <ShieldCheck size={28} color="#fff" />
                  </View>
                </View>
                <View className="items-center">
                  <Text className="text-base font-bold text-slate-800">Signing you in</Text>
                  <View className="mt-0.5 flex-row items-center gap-1.5">
                    <ActivityIndicator size="small" color={SLATE} />
                    <Text className="text-xs text-slate-500">Verifying credentials...</Text>
                  </View>
                </View>
              </Animated.View>
            ) : (
              <Animated.View
                entering={ZoomIn.duration(260).easing(fastOut)}
                className="items-center gap-3"
              >
                <View
                  className="h-20 w-20 items-center justify-center rounded-full bg-emerald-600"
                  style={{
                    shadowColor: EMERALD,
                    shadowOpacity: 0.4,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 6,
                  }}
                >
                  <CheckCircle2 size={36} color="#fff" />
                </View>
                <View className="items-center">
                  <Text className="text-base font-bold text-slate-800">Welcome back!</Text>
                  <Text className="mt-0.5 text-xs text-slate-500">Taking you to the POS...</Text>
                </View>
              </Animated.View>
            )}
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}
