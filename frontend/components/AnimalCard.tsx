import { View, Image, StyleSheet, TouchableOpacity } from "react-native";
import { Text } from "./StyledText";
import { Animal } from "../types";
import { ANIMAL_META, RESOURCE_META } from "../constants/resources";
import { useLanguage } from "../lib/i18n";

type Props = {
  animal: Animal;
  onPress?: (animal: Animal) => void;
};

export default function AnimalCard({ animal, onPress }: Props) {
  const { t } = useLanguage();
  const meta = ANIMAL_META[animal.animal_type] ?? {
    image: null,
    color: "#888",
    label: animal.animal_type,
    produceEmoji: "?",
  };
  const consumeMeta = RESOURCE_META[animal.consume_resource];
  const feedPct = animal.max_feed > 0 ? Math.min(animal.current_feed / animal.max_feed, 1) : 0;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress?.(animal)}
    >
      {/* Pending badge */}
      {animal.pending > 0 && (
        <View style={[styles.pendingBadge, { backgroundColor: meta.color }]}>
          <Text style={styles.pendingText}>{meta.produceEmoji} {animal.pending}</Text>
        </View>
      )}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCell label={t("lvl")} value={String(animal.level)} />
        <View style={styles.statDivider} />
        <StatCell label="FEED" value={`${animal.current_feed}/${animal.max_feed}`} />
      </View>

      {/* Animal image */}
      <View style={styles.imageWrapper}>
        {meta.image ? (
          <Image
            source={meta.image}
            style={styles.animalImage}
            resizeMode="contain"
          />
        ) : null}
      </View>

      {/* Animal name */}
      <Text style={styles.name}>{meta.label}</Text>

      {/* Feed bar footer */}
      <View style={styles.feedRow}>
        {consumeMeta?.image ? (
          <Image source={consumeMeta.image} style={styles.feedIcon} resizeMode="contain" />
        ) : null}
        <View style={styles.feedTrack}>
          <View
            style={[
              styles.feedFill,
              {
                width: `${feedPct * 100}%` as any,
                backgroundColor: consumeMeta?.color ?? meta.color,
              },
            ]}
          />
        </View>
        <Text style={styles.feedValue}>{animal.current_feed}/{animal.max_feed}</Text>
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
  pendingBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 10,
  },
  pendingText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
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
    fontSize: 11,
    fontWeight: "800",
    color: "#3a2a10",
  },
  imageWrapper: {
    width: "100%",
    height: 90,
    justifyContent: "center",
    alignItems: "center",
  },
  animalImage: {
    width: 72,
    height: 72,
  },
  name: {
    fontSize: 13,
    fontWeight: "800",
    color: "#3a2a10",
    marginBottom: 4,
  },
  feedRow: {
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
  feedIcon: {
    width: 14,
    height: 14,
  },
  feedTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "#d4b896",
    borderRadius: 3,
    overflow: "hidden",
  },
  feedFill: {
    height: "100%",
    borderRadius: 3,
  },
  feedValue: {
    fontSize: 10,
    fontWeight: "700",
    color: "#3a2a10",
    minWidth: 32,
    textAlign: "right",
  },
});
