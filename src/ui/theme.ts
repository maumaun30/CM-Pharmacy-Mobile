// src/ui/theme.ts
// Shared design tokens for the mobile app. Import these instead of re-declaring
// colors / shadows / easing in every screen.
//
// Visual language ("refined emerald"): neutral slate surfaces, hairline borders,
// one restrained shadow preset, and emerald reserved as an ACCENT — totals,
// primary actions, and active states — never as a background wash.

import { Easing } from "react-native-reanimated";
import type { ViewStyle } from "react-native";

export const colors = {
  // Brand accent
  emerald: "#059669", // emerald-600
  emeraldDark: "#047857", // emerald-700
  // Neutrals
  bg: "#f8fafc", // slate-50 — screen background
  surface: "#ffffff",
  border: "#e2e8f0", // slate-200 — hairline card border
  text: "#1e293b", // slate-800
  textMuted: "#64748b", // slate-500
  textFaint: "#94a3b8", // slate-400
  // Status
  amber: "#b45309",
  red: "#b91c1c",
} as const;

// One soft elevation preset, applied via the shared primitives so every card
// reads the same (previously each screen hand-wrote this object inline).
export const shadow: Record<"sm" | "card", ViewStyle> = {
  sm: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  card: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
};

// Shared entrance easing (was `Easing.out(Easing.quad)` re-declared per screen).
export const EASE = Easing.out(Easing.quad);
