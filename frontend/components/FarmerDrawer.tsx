import { useRef, useEffect } from "react";
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  PanResponder,
} from "react-native";
import { Text } from "./StyledText";
import { X, Sprout } from "lucide-react-native";
import { Farmer } from "../types";
import { RESOURCE_META } from "../constants/resources";
import UpgradeFarmerButton from "./UpgradeFarmerButton";

type Props = {
  farmer: Farmer | null;
  onClose: () => void;
  onUpgrade: (farmer: Farmer) => void;
};

const DISMISS_THRESHOLD = 100;

function StatRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
}) {
  const pct = Math.min(value / max, 1);
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.round(pct * 100)}%` as any,
              backgroundColor: color ?? "#4a8c3f",
            },
          ]}
        />
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function FarmerDrawer({ farmer, onClose, onUpgrade }: Props) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (farmer) translateY.setValue(0);
  }, [farmer]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > DISMISS_THRESHOLD || gs.vy > 0.6) {
          Animated.timing(translateY, {
            toValue: 800,
            duration: 180,
            useNativeDriver: true,
          }).start(() => onClose());
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 10,
          }).start();
        }
      },
    }),
  ).current;

  if (!farmer) return null;

  const meta = RESOURCE_META[farmer.resource_type] ?? {
    image: null,
    color: "#4a8c3f",
    label: farmer.resource_type,
  };

  return (
    <Modal
      visible={!!farmer}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.drawer, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <X size={14} color="#7a5230" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Resource type badge + level */}
        <View style={styles.headerRow}>
          <View
            style={[
              styles.typeBadge,
              {
                borderColor: meta.color,
                backgroundColor: meta.color + "22",
              },
            ]}
          >
            <Text style={[styles.typeBadgeText, { color: meta.color }]}>
              {meta.label.toUpperCase()}
            </Text>
          </View>
          <View style={styles.levelWrap}>
            <Text style={styles.levelSmall}>Level</Text>
            <Text style={styles.levelNum}>{farmer.level}</Text>
          </View>
        </View>

        {/* Farmer name */}
        <Text style={styles.farmerName}>{farmer.name}</Text>

        {/* Resource image */}
        <View style={styles.imageFrame}>
          {meta.image && (
            <Image
              source={meta.image}
              style={styles.resourceImage}
              resizeMode="contain"
            />
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Stats */}
        <View style={styles.sectionLabelRow}>
          <Sprout size={12} color="#9a7040" strokeWidth={2} />
          <Text style={styles.sectionLabel}>PRODUCTION STATS</Text>
        </View>
        <StatRow
          label="Production"
          value={farmer.production_rate}
          max={30}
          color={meta.color}
        />
        <StatRow label="Level" value={farmer.level} max={10} color="#8e6c3a" />

        {/* Upgrade button */}
        <View style={styles.btnRow}>
          <UpgradeFarmerButton
            onPress={() => onUpgrade(farmer)}
            style={styles.btnFull}
          />
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  drawer: {
    backgroundColor: "#f5e9cc",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: "#c8a96e",
    paddingHorizontal: 22,
    paddingBottom: 36,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  handleWrap: {
    flex: 1,
    alignItems: "center",
    paddingLeft: 38,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#c8a96e",
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#e8d5a8",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  typeBadge: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  levelWrap: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  levelSmall: {
    fontSize: 10,
    color: "#9a7040",
  },
  levelNum: {
    fontSize: 22,
    fontWeight: "800",
    color: "#4a8c3f",
    lineHeight: 24,
  },
  farmerName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#3a1e00",
    marginBottom: 12,
  },
  imageFrame: {
    alignSelf: "center",
    width: 148,
    height: 148,
    backgroundColor: "#ede0c4",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#c8a96e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#b8893a",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  resourceImage: {
    width: 110,
    height: 110,
  },
  divider: {
    height: 1.5,
    backgroundColor: "#d4b896",
    marginBottom: 12,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9a7040",
    letterSpacing: 1.2,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  statLabel: {
    width: 72,
    fontSize: 13,
    fontWeight: "600",
    color: "#4a2e0a",
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#e8d5a8",
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#c8a96e",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  statValue: {
    width: 30,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "700",
    color: "#3a1e00",
  },
  btnRow: {
    marginTop: 20,
  },
  btnFull: {
    width: "100%",
  },
});
