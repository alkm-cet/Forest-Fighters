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
import { Champion } from "../types";
import { CLASS_META } from "../constants/resources";
import Button from "./Button";

type Props = {
  champion: Champion | null;
  onClose: () => void;
  onPvp: (champion: Champion) => void;
  onDungeon: (champion: Champion) => void;
};

const STAT_MAX = 100;
const DISMISS_THRESHOLD = 100;

function StatRow({ label, value }: { label: string; value: number }) {
  const pct = Math.min(value / STAT_MAX, 1);
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.round(pct * 100)}%` as any }]} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function ChampionDrawer({ champion, onClose, onPvp, onDungeon }: Props) {
  const translateY = useRef(new Animated.Value(0)).current;

  // Reset position every time a new champion is opened
  useEffect(() => {
    if (champion) translateY.setValue(0);
  }, [champion]);

  const panResponder = useRef(
    PanResponder.create({
      // Only capture downward vertical swipes
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
    })
  ).current;

  if (!champion) return null;

  const meta = CLASS_META[champion.class] ?? { image: null, color: "#888", cost: 0 };

  return (
    <Modal
      visible={!!champion}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Transparent backdrop — tapping it closes the drawer */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.drawer, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        {/* Top bar: handle centered, close button on right — in the same row */}
        <View style={styles.topBar}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Class badge + level */}
        <View style={styles.headerRow}>
          <View style={styles.classBadge}>
            <Text style={styles.classBadgeText}>{champion.class.toUpperCase()}</Text>
          </View>
          <View style={styles.levelWrap}>
            <Text style={styles.levelSmall}>Level</Text>
            <Text style={styles.levelNum}>{champion.level}</Text>
          </View>
        </View>

        {/* Champion name */}
        <Text style={styles.champName}>{champion.name}</Text>

        {/* Champion image */}
        <View style={styles.imageFrame}>
          {meta.image && (
            <Image source={meta.image} style={styles.champImage} resizeMode="contain" />
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Stats */}
        <Text style={styles.sectionLabel}>⚔  BASE STATISTICS</Text>
        <StatRow label="Attack" value={champion.attack} />
        <StatRow label="Defense" value={champion.defense} />
        <StatRow label="Chance" value={champion.chance} />

        {/* Buttons */}
        <View style={styles.btnRow}>
          <Button
            label="PVP"
            subLabel="Arena Battle"
            icon="⚔️"
            variant="danger"
            onPress={() => onPvp(champion)}
            style={styles.btnFlex}
          />
          <Button
            label="DUNGEON"
            subLabel="Explore Ruins"
            icon="🏰"
            variant="info"
            onPress={() => onDungeon(champion)}
            style={styles.btnFlex}
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
    // offset to visually center the handle accounting for the close button width
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
  closeIcon: {
    fontSize: 12,
    color: "#7a5230",
    fontWeight: "700",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  classBadge: {
    backgroundColor: "#c8e6c9",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#4a7c3f",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  classBadgeText: {
    color: "#2d5a24",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  levelWrap: {
    alignItems: "flex-end",
  },
  levelSmall: {
    fontSize: 10,
    color: "#9a7040",
  },
  levelNum: {
    fontSize: 22,
    fontWeight: "800",
    color: "#c0392b",
    lineHeight: 24,
  },
  champName: {
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
  champImage: {
    width: 128,
    height: 128,
  },
  divider: {
    height: 1.5,
    backgroundColor: "#d4b896",
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9a7040",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  statLabel: {
    width: 56,
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
    backgroundColor: "#c0392b",
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
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  btnFlex: {
    flex: 1,
  },
});
