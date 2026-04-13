import { Modal, View, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Text } from "./StyledText";
import { RESOURCE_META } from "../constants/resources";
import { useLanguage } from "../lib/i18n";
import type { AdvancedResourceKey, ResourceKey, Resources } from "../types";

type AdvancedCapUpgradeConfirm = {
  resource: AdvancedResourceKey;
  currentCap: number;
  cost1: number;
  cost2: number;
  costRes1: ResourceKey;
  costRes2: ResourceKey;
  emoji: string;
};

type Props = {
  confirm: AdvancedCapUpgradeConfirm | null;
  resources: Resources;
  onClose: () => void;
  onConfirm: (resource: string) => Promise<void>;
};

export default function AdvancedCapUpgradeModal({ confirm, resources, onClose, onConfirm }: Props) {
  const { t } = useLanguage();

  if (!confirm) return null;

  const { resource, currentCap, cost1, cost2, costRes1, costRes2, emoji } = confirm;
  const meta1 = RESOURCE_META[costRes1];
  const meta2 = RESOURCE_META[costRes2];
  const canAfford = resources[costRes1] >= cost1 && resources[costRes2] >= cost2;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t("upgradeCapacityTitle")}</Text>

          <View style={styles.resourceRow}>
            <Text style={{ fontSize: 32 }}>{emoji}</Text>
            <Text style={styles.capChange}>
              {currentCap}
              <Text style={styles.arrow}> → </Text>
              <Text style={styles.newCap}>{currentCap + 2}</Text>
            </Text>
          </View>

          <Text style={styles.info}>{t("upgradeCapacityInfo")}</Text>

          <View style={styles.costRow}>
            <View style={styles.costItem}>
              <Image source={meta1.image!} style={styles.costIcon} resizeMode="contain" />
              <Text style={[styles.costText, resources[costRes1] < cost1 && styles.costLow]}>
                ×{cost1}
              </Text>
            </View>
            <Text style={styles.plus}>+</Text>
            <View style={styles.costItem}>
              <Image source={meta2.image!} style={styles.costIcon} resizeMode="contain" />
              <Text style={[styles.costText, resources[costRes2] < cost2 && styles.costLow]}>
                ×{cost2}
              </Text>
            </View>
          </View>

          <View style={styles.btns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{t("cancelBtn")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !canAfford && styles.confirmDisabled]}
              activeOpacity={canAfford ? 0.75 : 1}
              onPress={async () => {
                if (!canAfford) return;
                onClose();
                try {
                  await onConfirm(resource);
                } catch (err: any) {
                  alert(err.response?.data?.error ?? "Kapasite artırılamadı");
                }
              }}
            >
              <Text style={styles.confirmText}>{t("confirmUpgradeBtn")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: "#f5edd8", borderRadius: 20, borderWidth: 2, borderColor: "#d4b896", marginHorizontal: 32, padding: 24, alignItems: "center" },
  title: { fontSize: 18, fontWeight: "800", color: "#3a2a10", marginBottom: 16, textAlign: "center" },
  resourceRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  capChange: { fontSize: 22, fontWeight: "800", color: "#3a2a10" },
  arrow: { color: "#9a7040", fontSize: 20 },
  newCap: { color: "#4a7c3f", fontSize: 22 },
  info: { fontSize: 12, color: "#9a7040", marginBottom: 16 },
  costRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#ede0c4", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 20 },
  costItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  costIcon: { width: 24, height: 24 },
  costText: { fontSize: 16, fontWeight: "800", color: "#3a2a10" },
  costLow: { color: "#c0392b" },
  plus: { fontSize: 16, fontWeight: "700", color: "#9a7040" },
  btns: { flexDirection: "row", gap: 10, width: "100%" },
  cancelBtn: { flex: 1, backgroundColor: "#ede0c4", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1.5, borderColor: "#d4b896" },
  cancelText: { fontSize: 14, fontWeight: "700", color: "#6a4010" },
  confirmBtn: { flex: 1, backgroundColor: "#4a7c3f", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  confirmDisabled: { backgroundColor: "#9ab89a" },
  confirmText: { fontSize: 14, fontWeight: "800", color: "#fff" },
});
