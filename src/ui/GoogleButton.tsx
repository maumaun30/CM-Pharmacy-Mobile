import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/ui/theme";

// Brand-neutral "Continue with Google" button matching the app's card styling.
// Renders the official multi-color Google "G" via react-native-svg.

export function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </Svg>
  );
}

interface Props {
  onPress: () => void;
  label?: string;
  loading?: boolean;
  disabled?: boolean;
}

export function GoogleButton({
  onPress,
  label = "Continue with Google",
  loading = false,
  disabled = false,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      className="flex-row items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white py-3 active:bg-slate-50"
      style={{ opacity: isDisabled ? 0.6 : 1 }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.textMuted} />
      ) : (
        <GoogleG />
      )}
      <Text className="text-base font-semibold text-slate-700">{label}</Text>
      <View />
    </TouchableOpacity>
  );
}
