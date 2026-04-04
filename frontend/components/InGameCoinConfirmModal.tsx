import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Text } from "./StyledText";
import { useCoinConfirm } from "../lib/coin-confirm-context";
import { useLanguage } from "../lib/i18n";

export default function InGameCoinConfirmModal({ coins }: { coins: number }) {
  const { config, dismiss } = useCoinConfirm();
  const { t } = useLanguage();

  if (!config) return null;

  const canAfford = coins >= config.transactionCost;

  function handleConfirm() {
    if (!canAfford) return;
    dismiss();
    config!.onConfirm();
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={dismiss}
      />
      {/* Card */}
      <View style={styles.centered} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.costBadge}>
            <Text style={styles.costText}>🪙 ×{config.transactionCost}</Text>
          </View>

          <Text style={styles.title}>{config.transactionTitle}</Text>
          <Text style={styles.desc}>{config.transactionDesc}</Text>

          {!canAfford && (
            <Text style={styles.notEnough}>{t("notEnoughCoins")}</Text>
          )}

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={dismiss}>
              <Text style={styles.cancelText}>{t("cancelBtn")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !canAfford && styles.confirmDisabled]}
              onPress={handleConfirm}
              activeOpacity={canAfford ? 0.75 : 1}
            >
              <Text style={styles.confirmText}>{t("confirmUpgradeBtn")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#f5e9cc",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#c8a96e",
    paddingHorizontal: 24,
    paddingVertical: 20,
    width: 300,
    alignItems: "center",
    gap: 10,
  },
  costBadge: {
    backgroundColor: "#b8860b",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: "#8b6508",
  },
  costText: {
    fontSize: 20,
    fontWeight: "900",
    fontFamily: "Fredoka-Bold",
    color: "#fff",
  },
  title: {
    fontSize: 17,
    fontWeight: "900",
    fontFamily: "Fredoka-Bold",
    color: "#3a1e00",
    textAlign: "center",
  },
  desc: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Fredoka-Regular",
    color: "#6a4020",
    textAlign: "center",
    lineHeight: 18,
  },
  notEnough: {
    fontSize: 12,
    fontWeight: "700",
    color: "#c0392b",
    fontFamily: "Fredoka-Bold",
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#e8d5a8",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    alignItems: "center",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "800",
    fontFamily: "Fredoka-Bold",
    color: "#6a4020",
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#b8860b",
    borderWidth: 1.5,
    borderColor: "#8b6508",
    alignItems: "center",
  },
  confirmDisabled: {
    opacity: 0.4,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: "800",
    fontFamily: "Fredoka-Bold",
    color: "#fff",
  },
});
