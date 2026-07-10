// src/ui/StatCard.tsx
// Compact metric card (label / value / sub). Emerald value = the "headline"
// number; slate = secondary. Built on the shared Card.

import { Text } from "react-native";
import { Card } from "@/ui/Card";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  /** Render the value in emerald (use for the primary metric). */
  accent?: boolean;
}

export function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <Card className="flex-1 p-3">
      <Text className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </Text>
      <Text className={`text-2xl font-extrabold ${accent ? "text-emerald-600" : "text-slate-700"}`}>
        {value}
      </Text>
      {sub ? <Text className="text-xs text-slate-500">{sub}</Text> : null}
    </Card>
  );
}
