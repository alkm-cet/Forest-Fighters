import { TouchableOpacity, StyleSheet, ViewStyle } from "react-native";
import { Text } from "./StyledText";

type Variant = "primary" | "danger" | "info" | "ghost";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  subLabel?: string;
  icon?: string;
  style?: ViewStyle;
  disabled?: boolean;
};

const BG: Record<Variant, string> = {
  primary:  "#4a7c3f",
  danger:   "#c0392b",
  info:     "#2471a3",
  ghost:    "transparent",
};

const BORDER: Record<Variant, string> = {
  primary:  "#2d5a24",
  danger:   "#922b21",
  info:     "#1a5276",
  ghost:    "#c8a96e",
};

const TEXT_COLOR: Record<Variant, string> = {
  primary:  "#fff",
  danger:   "#fff",
  info:     "#fff",
  ghost:    "#4a2e0a",
};

export default function Button({
  label,
  onPress,
  variant = "primary",
  subLabel,
  icon,
  style,
  disabled = false,
}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      disabled={disabled}
      style={[
        styles.base,
        {
          backgroundColor: BG[variant],
          borderColor: BORDER[variant],
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={[styles.label, { color: TEXT_COLOR[variant] }]}>{label}</Text>
      {subLabel ? (
        <Text style={[styles.subLabel, { color: TEXT_COLOR[variant] }]}>{subLabel}</Text>
      ) : null}
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
  icon: {
    fontSize: 20,
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
