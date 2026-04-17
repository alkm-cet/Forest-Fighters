import { View, Image, StyleSheet, TouchableOpacity } from "react-native";
import { useState, useEffect } from "react";
import { Text } from "./StyledText";
import { Heart, Shield, Zap, X } from "lucide-react-native";
import { Champion } from "../types";
import { CLASS_META } from "../constants/resources";
import { useLanguage } from "../lib/i18n";
import CountdownTimer from "./CountdownTimer";

type Props = {
  champion: Champion;
  activeRunEndsAt?: string;
  pvpBattleEndsAt?: string;
  onPress?: (champion: Champion) => void;
  isDefender?: boolean;
};

export default function ChampionCard({
  champion,
  activeRunEndsAt,
  pvpBattleEndsAt,
  onPress,
  isDefender,
}: Props) {
  const { t } = useLanguage();
  const meta = CLASS_META[champion.class] ?? {
    image: null,
    color: "#888",
    cost: 0,
  };

  const [isExpired, setIsExpired] = useState(
    () => !!activeRunEndsAt && new Date(activeRunEndsAt) <= new Date(),
  );
  const isDead = champion.current_hp <= 0;

  const [pvpExpired, setPvpExpired] = useState(
    () => !!pvpBattleEndsAt && new Date(pvpBattleEndsAt) <= new Date(),
  );

  // Re-sync whenever a new mission starts (activeRunEndsAt changes)
  useEffect(() => {
    setIsExpired(!!activeRunEndsAt && new Date(activeRunEndsAt) <= new Date());
  }, [activeRunEndsAt]);

  useEffect(() => {
    setPvpExpired(!!pvpBattleEndsAt && new Date(pvpBattleEndsAt) <= new Date());
  }, [pvpBattleEndsAt]);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isDefender && styles.cardDefender,
        isDefender && { opacity: 0.8 },
        isDead && styles.cardDead,
      ]}
      activeOpacity={0.85}
      onPress={() => onPress?.(champion)}
    >
      {pvpBattleEndsAt && !pvpExpired && (
        <View style={[styles.deployedOverlay, styles.overlayPvp]}>
          <Text style={styles.deployedText}>Savaşta!</Text>
          <CountdownTimer
            endsAt={pvpBattleEndsAt}
            style={styles.deployedTimer}
            onExpire={() => setPvpExpired(true)}
          />
        </View>
      )}
      {pvpBattleEndsAt && pvpExpired && (
        <View style={[styles.deployedOverlay, styles.overlayPvpDone]}>
          <Text style={styles.deployedText}>Sonuç Hazır!</Text>
        </View>
      )}
      {!!activeRunEndsAt && !pvpBattleEndsAt && (
        <View
          style={[
            styles.deployedOverlay,
            isExpired ? styles.overlayDone : styles.overlayActive,
          ]}
        >
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
        <StatCell
          label={t("atk")}
          value={String(champion.attack + (champion.boost_attack ?? 0) + (champion.gear_attack ?? 0))}
          boosted={(champion.boost_attack ?? 0) > 0 || (champion.gear_attack ?? 0) > 0}
        />
        <View style={styles.statDivider} />
        <StatCell
          label={t("def")}
          value={String(champion.defense + (champion.boost_defense ?? 0) + (champion.gear_defense ?? 0))}
          boosted={(champion.boost_defense ?? 0) > 0 || (champion.gear_defense ?? 0) > 0}
        />
        <View style={styles.statDivider} />
        <StatCell
          label={t("chc")}
          value={`${champion.chance + (champion.boost_chance ?? 0) + (champion.gear_chance ?? 0)}%`}
          boosted={(champion.boost_chance ?? 0) > 0 || (champion.gear_chance ?? 0) > 0}
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
            <Image
              source={require("../assets/icons/heart.webp")}
              style={styles.boostImage}
              resizeMode="contain"
            />
          </View>
        )}
        {(champion.boost_defense ?? 0) > 0 && (
          <View style={[styles.boostBadge, styles.badgeBottomLeft]}>
            <Image
              source={require("../assets/icons/shield.webp")}
              style={styles.boostImage}
              resizeMode="contain"
            />
          </View>
        )}
        {(champion.boost_chance ?? 0) > 0 && (
          <View style={[styles.boostBadge, styles.badgeTopRight]}>
            <Image
              source={require("../assets/icons/lightning.webp")}
              style={styles.boostImage}
              resizeMode="contain"
            />
          </View>
        )}
        {isDefender && (
          <View style={styles.defenderShieldCenter}>
            <Image
              source={require("../assets/icons/shield.webp")}
              style={styles.shieldImage}
              resizeMode="contain"
            />
          </View>
        )}
        {isDead && (
          <View style={styles.deadBadge}>
            <X size={28} color="#fff" strokeWidth={3} />
          </View>
        )}
      </View>

      {/* Class name with level */}
      <Text style={styles.name}>
        Lv {champion.level} - {champion.class}
      </Text>

      {/* HP bar footer */}
      <View style={styles.hpRow}>
        <Heart size={11} color="#e05050" strokeWidth={2} fill="#e05050" />
        <View style={styles.hpTrack}>
          <View
            style={[
              styles.hpFill,
              {
                width:
                  `${Math.round((champion.current_hp / champion.max_hp) * 100)}%` as any,
              },
            ]}
          />
        </View>
        <Text style={styles.hpValue}>
          {champion.current_hp}/{champion.max_hp}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function StatCell({
  label,
  value,
  boosted,
}: {
  label: string;
  value: string;
  boosted?: boolean;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, boosted && styles.statValueBoosted]}>
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
  cardDefender: {
    borderColor: "#4a7c3f",
    borderWidth: 2.5,
  },
  cardDead: {
    opacity: 0.45,
    borderColor: "#c0392b",
  },
  deadBadge: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#c0392b",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  defenderShieldCenter: {
    position: "absolute",
    alignSelf: "center",
    opacity: 1,
  },
  shieldImage: {
    width: 60,
    height: 60,
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
    borderWidth: 1,
    backgroundColor: "#b2bec3",
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  badgeTopLeft: {
    top: 2,
    left: 6,
  },
  badgeBottomLeft: {
    bottom: 2,
    left: 6,
  },
  badgeTopRight: {
    top: 2,
    right: 6,
  },
  badgeBottomRight: {
    bottom: 2,
    right: 6,
  },
  boostImage: {
    width: 10,
    height: 10,
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
  overlayPvp: {
    backgroundColor: "rgba(150,30,180,0.85)",
  },
  overlayPvpDone: {
    backgroundColor: "rgba(70,130,50,0.88)",
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
