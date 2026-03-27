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

const dungeonIcon = require("../assets/dungeon.png");

export default function EnterDungeonButton({
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
      <View style={styles.inner}>
        <Image source={dungeonIcon} style={styles.icon} resizeMode="contain" />
        <View style={styles.textStack}>
          <Text style={styles.enterText}>ENTER</Text>
          <Text style={styles.dungeonText}>DUNGEON</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 18,
    backgroundColor: "#6D7579",
    borderWidth: 2.5,
    borderColor: "#4a5f72",
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
  enterText: {
    fontSize: 15,
    fontWeight: "800",
    fontFamily: "Fredoka-Bold",
    color: "#ffffff",
    letterSpacing: 0.5,
    lineHeight: 20,
    textShadowColor: "#1e2e3a",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dungeonText: {
    fontSize: 15,
    fontWeight: "800",
    fontFamily: "Fredoka-Bold",
    color: "#e8f0f6",
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
