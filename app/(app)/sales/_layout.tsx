import { Stack } from "expo-router";

const EMERALD = "#059669";

export default function SalesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#ffffff" },
        headerTintColor: EMERALD,
        headerTitleStyle: { fontWeight: "700", color: "#1e293b" },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "Sale Detail" }} />
    </Stack>
  );
}
