import {
  Modal,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from "react-native";
import { X } from "lucide-react-native";
import { Text } from "./StyledText";
import { useLanguage } from "../lib/i18n";

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  confirmText?: string;
  cancelText?: string;
  confirmDisabled?: boolean;
  children?: React.ReactNode;
};

export default function CustomModal({
  visible,
  onClose,
  onConfirm,
  title,
  confirmText,
  cancelText,
  confirmDisabled,
  children,
}: Props) {
  const { t } = useLanguage();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.cardWrap}>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <X size={14} color="#7a5230" strokeWidth={2.5} />
          </TouchableOpacity>

          <Text style={styles.title}>{title}</Text>

          {children}

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelText}>
                {cancelText ?? t("cancelBtn")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, confirmDisabled && styles.btnDisabled]}
              onPress={() => {
                if (!confirmDisabled) onConfirm();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmText}>
                {confirmText ?? t("confirmUpgradeBtn")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  cardWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    pointerEvents: "box-none",
  },
  card: {
    backgroundColor: "#f5e9cc",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#c8a96e",
    padding: 24,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 20,
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e8d5a8",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#3a1e00",
    marginBottom: 16,
    paddingRight: 32,
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#e8d5a8",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    alignItems: "center",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7a5a30",
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#4a7c3f",
    borderWidth: 1.5,
    borderColor: "#2d5a24",
    alignItems: "center",
  },
  confirmText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
  btnDisabled: {
    opacity: 0.45,
  },
});
