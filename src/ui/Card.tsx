// src/ui/Card.tsx
// Neutral surface primitive: white, hairline slate border, one soft shadow.
// Replaces the copy-pasted `rounded-2xl border border-emerald-100 bg-white` +
// inline shadow object that appeared on every screen.

import { View, type ViewProps } from "react-native";
import { shadow } from "@/ui/theme";

interface CardProps extends ViewProps {
  className?: string;
  /** Set false for a flat, borderless-shadow card (e.g. nested rows). */
  elevated?: boolean;
}

export function Card({ style, className = "", elevated = true, ...rest }: CardProps) {
  return (
    <View
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${className}`}
      style={[elevated ? shadow.card : null, style]}
      {...rest}
    />
  );
}
