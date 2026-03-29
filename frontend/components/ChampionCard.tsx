import { View, Image, StyleSheet, TouchableOpacity } from "react-native";
import { useState, useEffect } from "react";
import { Text } from "./StyledText";
import { Heart, Shield, Zap } from "lucide-react-native";
import { Champion } from "../types";
import { CLASS_META } from "../constants/resources";
import { useLanguage } from "../lib/i18n";
import CountdownTimer from "./CountdownTimer";

type Props = {
  champion: Champion;
  activeRunEndsAt?: string;
  onPress?: (champion: Champion) => void;
};

export default function ChampionCard({ champion, activeRunEndsAt, onPress }: Props) {
  const { t } = useLanguage();
  const meta = CLASS_META[champion.class] ?? {
    image: null,
    color: "#888",
    cost: 0,
  };

  const [isExpired, setIsExpired] = useState(
    () => !!activeRunEndsAt && new Date(activeRunEndsAt) <= new Date()
  );

  // Re-sync whenever a new mission starts (activeRunEndsAt changes)
  useEffect(() => {
    setIsExpired(!!activeRunEndsAt && new Date(activeRunEndsAt) <= new Date());
  }, [activeRunEndsAt]);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress?.(champion)}
    >
      {champion.is_deployed && (
        <View style={[styles.deployedOverlay, isExpired ? styles.overlayDone : styles.overlayActive]}>
          {isExpired ? (
            <Text style={styles.deployedText}>{t("missionDone")}</Text>
          ) : (
            <>
              <Text style={styles.deployedText}>{t("onMission")}</Text>
              {activeRunEndsAt && (
                <CountdownTimer
                  endsAt={activeRunEndsAt}
                  style={styles.deployedTimer}
                  onExpire={() => setIsExpired(true)}
                />
              )}
            </>
          )}
        </View>
      )}
      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCell label={t("atk")} value={String(champion.attack)} />
        <View style={styles.statDivider} />
        <StatCell
          label={t("def")}
          value={String(champion.defense + (champion.boost_defense ?? 0))}
          boosted={(champion.boost_defense ?? 0) > 0}
        />
        <View style={styles.statDivider} />
        <StatCell
          label={t("chc")}
          value={`${champion.chance + (champion.boost_chance ?? 0)}%`}
          boosted={(champion.boost_chance ?? 0) > 0}
        />
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
        {(champion.boost_hp ?? 0) > 0 && (
          <View style={[styles.boostBadge, styles.badgeTopLeft]}>
            <Heart size={9} color="#fff" strokeWidth={2} fill="#fff" />
          </View>
        )}
        {(champion.boost_defense ?? 0) > 0 && (
          <View style={[styles.boostBadge, styles.badgeBottomLeft]}>
            <Shield size={9} color="#fff" strokeWidth={2} />
          </View>
        )}
        {(champion.boost_chance ?? 0) > 0 && (
          <View style={[styles.boostBadge, styles.badgeTopRight]}>
            <Zap size={9} color="#fff" strokeWidth={2} fill="#fff" />
          </View>
        )}
      </View>

      {/* Class name */}
      <Text style={styles.name}>{champion.class}</Text>

      {/* HP bar footer */}
      <View style={styles.hpRow}>
        <Heart size={11} color="#e05050" strokeWidth={2} fill="#e05050" />
        <View style={styles.hpTrack}>
          <View style={[styles.hpFill, { width: `${Math.round((champion.current_hp / champion.max_hp) * 100)}%` as any }]} />
        </View>
        <Text style={styles.hpValue}>{champion.current_hp}/{champion.max_hp}</Text>
      </View>
    </TouchableOpacity>
  );
}

function StatCell({ label, value, boosted }: { label: string; value: string; boosted?: boolean }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, boosted && styles.statValueBoosted]}>{value}</Text>
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
  statValueBoosted: {
    color: "#8a5cc7",
  },

  imageWrapper: {
    width: "100%",
    height: 90,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  boostBadge: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#f5edd8",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  badgeTopLeft: {
    top: 2,
    left: 6,
    backgroundColor: "#c0392b",
  },
  badgeBottomLeft: {
    bottom: 2,
    left: 6,
    backgroundColor: "#4a7c3f",
  },
  badgeTopRight: {
    top: 2,
    right: 6,
    backgroundColor: "#8a5cc7",
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
  deployedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  overlayActive: {
    backgroundColor: "rgba(200,100,20,0.82)",
  },
  overlayDone: {
    backgroundColor: "rgba(210,170,0,0.88)",
  },
  deployedText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
    textAlign: "center",
  },
  deployedTimer: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1.5,
    marginTop: 2,
  },
});
