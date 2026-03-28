import {
  TouchableOpacity,
  View,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { Text } from "./StyledText";
import { TrendingUp } from "lucide-react-native";
import { useLanguage } from "../lib/i18n";

type Props = {
  onPress: () => void;
  style?: ViewStyle;
  disabled?: boolean;
};

export default function UpgradeFarmerButton({
  onPress,
  style,
  disabled = false,
}: Props) {
  const { t } = useLanguage();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      disabled={disabled}
      style={[styles.outer, disabled && styles.disabled, style]}
    >
      <View style={styles.inner}>
        <TrendingUp size={28} color="#fff" strokeWidth={2.5} />
        <View style={styles.textStack}>
          <Text style={styles.upgradeLabel}>{t("upgrade")}</Text>
          <Text style={styles.upgradeSub}>{t("farmer")}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 18,
    backgroundColor: "#4a8c3f",
    borderWidth: 2.5,
    borderColor: "#2e5e26",
    shadowColor: "#1a3a12",
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
    borderTopColor: "#7ec472",
    borderLeftWidth: 1.5,
    borderLeftColor: "#7ec472",
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderBottomColor: "transparent",
    borderRightColor: "transparent",
  },
  textStack: {
    alignItems: "flex-start",
    justifyContent: "center",
  },
  upgradeLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
    fontFamily: "Fredoka-Bold",
    letterSpacing: 1.5,
    lineHeight: 20,
    textShadowColor: "#1a3a12",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  upgradeSub: {
    fontSize: 15,
    fontWeight: "800",
    color: "#d4f5d0",
    fontFamily: "Fredoka-Bold",
    letterSpacing: 0.5,
    lineHeight: 18,
    textShadowColor: "#1a3a12",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  disabled: {
    opacity: 0.5,
  },
});
