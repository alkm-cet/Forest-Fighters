import { View, Image, StyleSheet, TouchableOpacity } from "react-native";
import { Text } from "./StyledText";
import { Heart } from "lucide-react-native";
import { Champion } from "../types";
import { CLASS_META } from "../constants/resources";

type Props = {
  champion: Champion;
  onPress?: (champion: Champion) => void;
};

export default function ChampionCard({ champion, onPress }: Props) {
  const meta = CLASS_META[champion.class] ?? {
    image: null,
    color: "#888",
    cost: 0,
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress?.(champion)}
    >
      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCell label="ATK" value={String(champion.attack)} />
        <View style={styles.statDivider} />
        <StatCell label="DEF" value={String(champion.defense)} />
        <View style={styles.statDivider} />
        <StatCell label="CHC" value={`${champion.chance}%`} />
      </View>

      {/* Cat image */}
      <View style={styles.imageWrapper}>
        {meta.image ? (
          <Image
            source={meta.image}
            style={styles.catImage}
            resizeMode="contain"
          />
        ) : null}
      </View>

      {/* Class name */}
      <Text style={styles.name}>{champion.class}</Text>

      {/* HP bar footer */}
      <View style={styles.hpRow}>
        <Heart size={11} color="#e05050" strokeWidth={2} fill="#e05050" />
        <View style={styles.hpTrack}>
          <View style={[styles.hpFill, { width: `${Math.min((champion.defense * 5 + champion.level * 10) / 150 * 100, 100)}%` as any }]} />
        </View>
        <Text style={styles.hpValue}>{champion.defense * 5 + champion.level * 10}</Text>
      </View>
    </TouchableOpacity>
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
  catImage: {
    width: 80,
    height: 90,
  },

  name: {
    fontSize: 13,
    fontWeight: "800",
    color: "#3a2a10",
    marginBottom: 4,
  },

  hpRow: {
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
  hpTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "#d4b896",
    borderRadius: 3,
    overflow: "hidden",
  },
  hpFill: {
    height: "100%",
    backgroundColor: "#e05050",
    borderRadius: 3,
  },
  hpValue: {
    fontSize: 10,
    fontWeight: "700",
    color: "#3a2a10",
    minWidth: 24,
    textAlign: "right",
  },
});
