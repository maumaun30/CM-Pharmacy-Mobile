// src/ui/ScreenHeader.tsx
// Consistent top-of-screen header: safe-area aware, white with a hairline bottom
// border and a subtle shadow. Optional right-side slot for an action button.

import React from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { EASE, shadow } from "@/ui/theme";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      entering={FadeInDown.duration(220).easing(EASE)}
      className="border-b border-slate-200 bg-white px-4"
      style={[{ paddingTop: insets.top + 16, paddingBottom: 16 }, shadow.sm]}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-2xl font-bold text-slate-800">{title}</Text>
          {subtitle ? <Text className="mt-0.5 text-sm text-slate-500">{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </Animated.View>
  );
}
