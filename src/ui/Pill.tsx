// src/ui/Pill.tsx
// Small status chip + the single shared sale-status mapping. Previously a
// `statusPill()` helper was copy-pasted (with drift) across three screens.

import React from "react";
import { Text, View } from "react-native";

export type PillVariant = "success" | "warning" | "danger" | "neutral";

const VARIANTS: Record<PillVariant, { bg: string; text: string }> = {
  success: { bg: "bg-emerald-100", text: "text-emerald-700" },
  warning: { bg: "bg-amber-100", text: "text-amber-700" },
  danger: { bg: "bg-red-100", text: "text-red-700" },
  neutral: { bg: "bg-slate-100", text: "text-slate-600" },
};

interface PillProps {
  label: string;
  variant?: PillVariant;
  icon?: React.ReactNode;
}

export function Pill({ label, variant = "neutral", icon }: PillProps) {
  const v = VARIANTS[variant];
  return (
    <View className={`flex-row items-center gap-1 rounded-md px-1.5 py-0.5 ${v.bg}`}>
      {icon}
      <Text className={`text-[10px] font-semibold ${v.text}`}>{label}</Text>
    </View>
  );
}

/** Canonical sale-status → pill mapping, used everywhere a sale status renders. */
export function saleStatusPill(status: string | null): { label: string; variant: PillVariant } {
  const s = (status ?? "COMPLETED").toUpperCase();
  if (s === "PARTIALLY_REFUNDED" || s === "PARTIAL_REFUND")
    return { label: "Partial Refund", variant: "warning" };
  if (s === "FULLY_REFUNDED" || s === "REFUNDED")
    return { label: "Refunded", variant: "danger" };
  return { label: "Completed", variant: "success" };
}
