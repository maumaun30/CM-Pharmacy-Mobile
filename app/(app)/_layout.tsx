import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { Receipt, ScanLine, Settings } from "lucide-react-native";
import { useAuth } from "@/auth/AuthContext";

const EMERALD = "#059669";
const SLATE_400 = "#94a3b8";

export default function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-emerald-50">
        <ActivityIndicator size="large" color={EMERALD} />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: EMERALD,
        tabBarInactiveTintColor: SLATE_400,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginBottom: 4,
        },
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#d1fae5",
          borderTopWidth: 1,
          height: 60,
          paddingTop: 6,
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: -2 },
          elevation: 8,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tabs.Screen
        name="pos"
        options={{
          title: "POS",
          tabBarIcon: ({ color, size, focused }) => (
            <ScanLine color={color} size={size} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: "Sales",
          tabBarIcon: ({ color, size, focused }) => (
            <Receipt color={color} size={size} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size, focused }) => (
            <Settings color={color} size={size} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
    </Tabs>
  );
}
