import {
  TouchableOpacity,
  Image,
  View,
  StyleSheet,
  ViewStyle,
  ImageSourcePropType,
} from "react-native";
import { Text } from "./StyledText";
import { ReactNode } from "react";

type Props = {
  btnImage?: ImageSourcePropType;
  btnIcon?: ReactNode;
  btnImagePos?: "left" | "right";
  text: string;
  onClick: () => void;
  bgColor?: string;
  borderColor?: string;
  style?: ViewStyle;
  disabled?: boolean;
};

export default function CustomButton({
  btnImage,
  btnIcon,
  btnImagePos = "left",
  text,
  onClick,
  bgColor = "#6B8D9F",
  borderColor = "#4a5f72",
  style,
  disabled = false,
}: Props) {
  // btnIcon takes precedence over btnImage when both are provided
  const leadEl = btnIcon ? (
    btnIcon
  ) : btnImage ? (
    <Image source={btnImage} style={styles.icon} resizeMode="contain" />
  ) : null;

  return (
    <TouchableOpacity
      onPress={onClick}
      activeOpacity={0.75}
      disabled={disabled}
      style={[
        styles.outer,
        { backgroundColor: bgColor, borderColor },
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.inner}>
        {btnImagePos === "left" && leadEl}
        <Text style={styles.label}>{text}</Text>
        {btnImagePos === "right" && leadEl}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 18,
    borderWidth: 2.5,
    shadowColor: "#2e3d4a",
    shadowOpacity: 0.55,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    height: 71,
  },
  inner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    gap: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "red",
    borderTopWidth: 2,
    borderTopColor: "#a8bfcf",
    borderLeftWidth: 1.5,
    borderLeftColor: "#a8bfcf",
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderBottomColor: "transparent",
    borderRightColor: "transparent",
  },
  icon: {
    width: 44,
    height: 44,
  },
  label: {
    fontSize: 15,
    fontWeight: "800",
    fontFamily: "Fredoka-Bold",
    color: "#ffffff",
    letterSpacing: 1,
    textShadowColor: "#1e2e3a",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    flexShrink: 1,
  },
  disabled: {
    opacity: 0.5,
  },
});
