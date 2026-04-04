import { View, Image, StyleSheet, TouchableOpacity } from "react-native";
import { Text } from "./StyledText";
import { Sprout } from "lucide-react-native";
import { Farmer } from "../types";
import { RESOURCE_META } from "../constants/resources";
import { useLanguage } from "../lib/i18n";

type Props = {
  farmer: Farmer;
  onPress?: (farmer: Farmer) => void;
};

const getMaxCapacity = (level: number) => 4 + level;

function calcLivePending(farmer: Farmer): number {
  const maxCap = getMaxCapacity(farmer.level);
  if (!farmer._fetched_at_ms || !farmer.interval_minutes || farmer.next_ready_in_seconds == null) {
    return Math.min(farmer.pending ?? 0, maxCap);
  }
  const elapsedSec = (Date.now() - farmer._fetched_at_ms) / 1000;
  const cycleSec = farmer.interval_minutes * 60;
  const rawTimeLeft = Math.max(0, farmer.next_ready_in_seconds - elapsedSec);
  const burned = farmer.next_ready_in_seconds - rawTimeLeft;
  const extraCycles = cycleSec > 0 ? Math.floor((cycleSec - farmer.next_ready_in_seconds + burned) / cycleSec) : 0;
  return Math.min(farmer.pending + extraCycles, maxCap);
}

export default function FarmerCard({ farmer, onPress }: Props) {
  const { t } = useLanguage();
  const meta = RESOURCE_META[farmer.resource_type] ?? {
    image: null,
    color: "#888",
    label: farmer.resource_type,
  };

  const livePending = calcLivePending(farmer);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress?.(farmer)}
    >
      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCell label={t("lvl")} value={String(farmer.level)} />
        <View style={styles.statDivider} />
        <StatCell label="ÜRT" value={`1/${Number(farmer.interval_minutes).toFixed(1)}m`} />
      </View>

      {/* Farmer cat image */}
      <View style={styles.imageWrapper}>
        {meta.catImage ? (
          <Image
            source={meta.catImage}
            style={styles.resourceImage}
            resizeMode="contain"
          />
        ) : null}
      </View>

      {/* Farmer name */}
      <Text style={styles.name}>{farmer.name}</Text>

      {/* Production bar footer */}
      <View style={styles.prodRow}>
        <Sprout size={11} color="#4a8c3f" strokeWidth={2} />
        <View style={styles.prodTrack}>
          <View
            style={[
              styles.prodFill,
              {
                width:
                  `${Math.min((livePending / getMaxCapacity(farmer.level)) * 100, 100)}%` as any,
                backgroundColor: meta.color,
              },
            ]}
          />
        </View>
        <Text style={styles.prodValue}>{livePending}/{getMaxCapacity(farmer.level)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function StatCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  statCell: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#c8aa82",
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#8a6a40",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#3a2a10",
  },

  imageWrapper: {
    width: "100%",
    height: 90,
    justifyContent: "center",
    alignItems: "center",
  },
  resourceImage: {
    width: 70,
    height: 70,
  },

  name: {
    fontSize: 13,
    fontWeight: "800",
    color: "#3a2a10",
    marginBottom: 4,
  },

  prodRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ede0c4",
    width: "100%",
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
    borderTopWidth: 1.5,
    borderTopColor: "#d4b896",
  },
  prodTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "#d4b896",
    borderRadius: 3,
    overflow: "hidden",
  },
  prodFill: {
    height: "100%",
    borderRadius: 3,
  },
  prodValue: {
    fontSize: 10,
    fontWeight: "700",
    color: "#3a2a10",
    minWidth: 28,
    textAlign: "right",
  },
});
