import React from "react";
import { TouchableOpacity, StyleSheet, ViewStyle } from "react-native";
import { Text } from "./StyledText";

type Variant = "primary" | "danger" | "info" | "ghost" | "stone";

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  subLabel?: string;
  icon?: LucideIcon;
  style?: ViewStyle;
  disabled?: boolean;
};

const BG: Record<Variant, string> = {
  primary: "#4a7c3f",
  danger:  "#c0392b",
  info:    "#2471a3",
  ghost:   "transparent",
  stone:   "#6b7a5e",
};

const BORDER: Record<Variant, string> = {
  primary: "#2d5a24",
  danger:  "#922b21",
  info:    "#1a5276",
  ghost:   "#c8a96e",
  stone:   "#4a5740",
};

const TEXT_COLOR: Record<Variant, string> = {
  primary: "#fff",
  danger:  "#fff",
  info:    "#fff",
  ghost:   "#4a2e0a",
  stone:   "#fff",
};

export default function Button({
  label,
  onPress,
  variant = "primary",
  subLabel,
  icon: Icon,
  style,
  disabled = false,
}: Props) {
  const color = TEXT_COLOR[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      disabled={disabled}
      style={[
        styles.base,
        { backgroundColor: BG[variant], borderColor: BORDER[variant], opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {Icon ? <Icon size={20} color={color} strokeWidth={2} /> : null}
      <Text style={[styles.label, { color }]}>{label}</Text>
      {subLabel ? <Text style={[styles.subLabel, { color }]}>{subLabel}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  subLabel: {
    fontSize: 10,
    fontWeight: "500",
    opacity: 0.8,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
