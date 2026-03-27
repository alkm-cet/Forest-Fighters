import {
  TouchableOpacity,
  Image,
  View,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { Text } from "./StyledText";

type Props = {
  onPress: () => void;
  style?: ViewStyle;
  disabled?: boolean;
};

const crossSwords = require("../assets/cross-swords.png");

export default function PvpBattleButton({
  onPress,
  style,
  disabled = false,
}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      disabled={disabled}
      style={[styles.outer, disabled && styles.disabled, style]}
    >
      {/* Inner bevel highlight */}
      <View style={styles.inner}>
        <Image source={crossSwords} style={styles.icon} resizeMode="contain" />
        <View style={styles.textStack}>
          <Text style={styles.pvpText}>PvP</Text>
          <Text style={styles.battleText}>BATTLE</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 18,
    backgroundColor: "#6B8D9F",
    borderWidth: 2.5,
    borderColor: "#4a5f72",
    // Bottom/right shadow gives raised bevel feel
    shadowColor: "#2e3d4a",
    shadowOpacity: 0.55,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    height: 71,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    // Top highlight to complete bevel illusion
    borderRadius: 16,
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
  textStack: {
    alignItems: "flex-start",
    justifyContent: "center",
  },
  pvpText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
    fontFamily: "Fredoka-Bold",
    letterSpacing: 0.5,
    lineHeight: 20,
    textShadowColor: "#1e2e3a",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  battleText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#e8f0f6",
    fontFamily: "Fredoka-Bold",
    letterSpacing: 1.5,
    lineHeight: 18,
    textShadowColor: "#1e2e3a",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  disabled: {
    opacity: 0.5,
  },
});
