import { useRef, useEffect } from "react";
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Text } from "./StyledText";
import { Farm } from "../types";
import { FARM_META, RESOURCE_META } from "../constants/resources";

type Props = {
  farm: Farm;
  onPress?: (farm: Farm) => void;
};

const MAX_FARM_SLOTS = 20;

export default function FarmCard({ farm, onPress }: Props) {
  const meta = FARM_META[farm.farm_type] ?? {
    image: null,
    color: "#888",
    farmLabel: farm.farm_type,
  };
  const produceMeta = RESOURCE_META[farm.produce_resource];

  const totalMaxCapacity = farm.animals.reduce(
    (sum, a) => sum + a.max_capacity,
    0,
  );
  const isFull = totalMaxCapacity > 0 && farm.total_pending >= totalMaxCapacity;
  const runningCount = farm.animals.filter((a) => a.is_running).length;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isFull) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulseAnim.setValue(1);
    };
  }, [isFull]);

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => onPress?.(farm)}
      >
        {/* Pending badge */}
        {farm.total_pending > 0 && (
          <View style={[styles.pendingBadge, { backgroundColor: meta.color }]}>
            {produceMeta?.image && (
              <Image
                source={produceMeta.image}
                style={styles.pendingIcon}
                resizeMode="contain"
              />
            )}
            <Text style={styles.pendingText}>{farm.total_pending}</Text>
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCell label="LV" value={String(farm.level)} />
          <View style={styles.statDivider} />
          <StatCell
            label="SLOT"
            value={`${farm.animals.length}/${farm.slot_count}`}
          />
        </View>

        {/* Farm image */}
        <View style={styles.imageWrapper}>
          {meta.image ? (
            <Image
              source={meta.image}
              style={styles.animalImage}
              resizeMode="contain"
            />
          ) : null}
        </View>

        {/* Farm name */}
        <Text style={styles.name}>{meta.farmLabel}</Text>

        {/* Running indicator footer */}
        <View style={styles.feedRow}>
          <View
            style={[
              styles.runDot,
              { backgroundColor: runningCount > 0 ? "#4a7c3f" : "#b0a080" },
            ]}
          />
          <Text style={styles.feedValue}>
            {runningCount}/{farm.animals.length} active
          </Text>
        </View>
      </TouchableOpacity>

      {isFull && (
        <Animated.View
          style={[styles.fullBadge, { transform: [{ scale: pulseAnim }] }]}
        >
          <Text style={styles.fullBadgeText}>FULL</Text>
        </Animated.View>
      )}
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: "relative",
  },
  card: {
    flex: 1,
    backgroundColor: "#f5edd8",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#d4b896",
    alignItems: "center",
    overflow: "hidden",
    paddingTop: 8,
  },
  pendingBadge: {
    position: "absolute",
    top: 48,
    left: 6,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#baadad",
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  pendingIcon: { width: 14, height: 14 },
  pendingText: { fontSize: 10, fontWeight: "800", color: "#fff" },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ede0c4",
    borderRadius: 8,
    marginHorizontal: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
    gap: 2,
  },
  statCell: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 20, backgroundColor: "#c8aa82" },
  statLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#8a6a40",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  statValue: { fontSize: 11, fontWeight: "800", color: "#3a2a10" },
  imageWrapper: {
    width: "100%",
    height: 90,
    justifyContent: "center",
    alignItems: "center",
  },
  animalImage: { width: 62, height: 62 },
  name: {
    fontSize: 11,
    fontWeight: "800",
    color: "#3a2a10",
    marginBottom: 10,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  feedRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ede0c4",
    width: "100%",
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 6,
    borderTopWidth: 1.5,
    borderTopColor: "#d4b896",
    justifyContent: "center",
  },
  runDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  feedValue: {
    fontSize: 10,
    fontWeight: "700",
    color: "#3a2a10",
  },
  fullBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#e67e22",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: "#fff",
    zIndex: 10,
  },
  fullBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.5,
  },
});
