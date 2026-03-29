import { View, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Text } from "./StyledText";
import { Skull, Clock, Gift, Star, Swords, Shield, Zap } from "lucide-react-native";
import { Dungeon, DungeonRun } from "../types";
import { RESOURCE_META } from "../constants/resources";
import { useLanguage } from "../lib/i18n";
import CountdownTimer from "./CountdownTimer";
import CustomButton from "./CustomButton";

type Props = {
  dungeon: Dungeon;
  activeRun?: DungeonRun;
  onEnter: (dungeon: Dungeon) => void;
  onClaim: (run: DungeonRun) => void;
  disabled?: boolean;
};

function getDifficultyColor(durationMinutes: number): string {
  if (durationMinutes <= 10) return "#2ecc71";
  if (durationMinutes <= 20) return "#f39c12";
  return "#e74c3c";
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${minutes % 60 > 0 ? ` ${minutes % 60}m` : ""}`;
}

export default function DungeonCard({ dungeon, activeRun, onEnter, onClaim, disabled }: Props) {
  const { t } = useLanguage();
  const rewardMeta = RESOURCE_META[dungeon.reward_resource];
  const diffColor = getDifficultyColor(dungeon.duration_minutes);

  const isActive = activeRun?.status === "active";
  const isExpired = isActive && activeRun && new Date(activeRun.ends_at) <= new Date();

  return (
    <View style={[styles.card, isActive && !isExpired && styles.cardOnMission, isExpired && styles.cardReady]}>
      {/* Left difficulty accent bar */}
      <View style={[styles.accentBar, { backgroundColor: diffColor }]} />

      <View style={styles.inner}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.dungeonName}>{dungeon.name}</Text>
            {dungeon.description ? (
              <Text style={styles.dungeonDesc}>{dungeon.description}</Text>
            ) : null}
          </View>
          <View style={styles.durationBadge}>
            <Clock size={10} color={diffColor} strokeWidth={2.5} />
            <Text style={[styles.durationText, { color: diffColor }]}>
              {formatDuration(dungeon.duration_minutes)}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Enemy + Reward row */}
        <View style={styles.infoRow}>
          {/* Enemy block */}
          <View style={styles.enemyBlock}>
            <View style={styles.blockHeader}>
              <Skull size={12} color="#e57373" strokeWidth={2} />
              <Text style={styles.enemyName}>{dungeon.enemy_name}</Text>
            </View>
            <View style={styles.statRow}>
              <View style={styles.statPill}>
                <Swords size={9} color="#e57373" strokeWidth={2.5} />
                <Text style={styles.statText}>{dungeon.enemy_attack}</Text>
              </View>
              <View style={styles.statPill}>
                <Shield size={9} color="#90a4ae" strokeWidth={2.5} />
                <Text style={styles.statText}>{dungeon.enemy_defense}</Text>
              </View>
              <View style={styles.statPill}>
                <Zap size={9} color="#ce93d8" strokeWidth={2.5} />
                <Text style={styles.statText}>{dungeon.enemy_chance}%</Text>
              </View>
            </View>
          </View>

          <View style={styles.blockDivider} />

          {/* Reward block */}
          <View style={styles.rewardBlock}>
            <View style={styles.blockHeader}>
              <Gift size={12} color="#81c784" strokeWidth={2} />
              <Text style={styles.rewardLabel}>{t("reward")}</Text>
            </View>
            <View style={styles.rewardRow}>
              {rewardMeta && (
                <Image source={rewardMeta.image} style={styles.rewardIcon} resizeMode="contain" />
              )}
              <Text style={styles.rewardAmount}>×{dungeon.reward_amount}</Text>
              <View style={styles.xpBadge}>
                <Star size={9} color="#ffd54f" strokeWidth={2} fill="#ffd54f" />
                <Text style={styles.xpText}>+{dungeon.xp_reward}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action footer */}
        <View style={styles.actionRow}>
          {isActive && !isExpired ? (
            <View style={styles.missionBlock}>
              <Text style={styles.onMissionLabel}>{t("onMission")}</Text>
              <CountdownTimer
                endsAt={activeRun!.ends_at}
                style={styles.countdownText}
                onExpire={() => {}}
              />
            </View>
          ) : isExpired ? (
            <TouchableOpacity style={styles.claimBtn} onPress={() => onClaim(activeRun!)}>
              <Gift size={15} color="#fff" strokeWidth={2.5} />
              <Text style={styles.claimBtnText}>{t("claimReward")}</Text>
            </TouchableOpacity>
          ) : (
            <CustomButton
              btnImage={require("../assets/dungeon.png")}
              text={t("enterDungeon")}
              onClick={() => onEnter(dungeon)}
              bgColor="#6D7579"
              borderColor="#4a5f72"
              disabled={disabled}
              style={styles.enterBtn}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#2c3347",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#3e4a62",
    marginBottom: 12,
    overflow: "hidden",
  },
  cardOnMission: {
    borderColor: "#4a9c5f",
  },
  cardReady: {
    borderColor: "#f0a030",
  },
  accentBar: {
    width: 4,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  inner: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
    marginRight: 10,
  },
  dungeonName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ecf0f1",
  },
  dungeonDesc: {
    fontSize: 11,
    color: "#7f8c9a",
    marginTop: 2,
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1e2433",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#3e4a62",
  },
  durationText: {
    fontSize: 12,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#3e4a62",
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  enemyBlock: {
    flex: 1,
    gap: 6,
  },
  rewardBlock: {
    flex: 1,
    gap: 6,
  },
  blockDivider: {
    width: 1,
    backgroundColor: "#3e4a62",
  },
  blockHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  enemyName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#e57373",
  },
  statRow: {
    flexDirection: "row",
    gap: 5,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#1e2433",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  statText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#b0bec5",
  },
  rewardLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#81c784",
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rewardIcon: {
    width: 20,
    height: 20,
  },
  rewardAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ecf0f1",
  },
  xpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#2a2215",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  xpText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffd54f",
  },
  actionRow: {
    borderTopWidth: 1,
    borderTopColor: "#3e4a62",
    paddingTop: 10,
  },
  missionBlock: {
    alignItems: "center",
    gap: 3,
  },
  onMissionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#81c784",
    letterSpacing: 1.5,
  },
  countdownText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#a8d8b0",
    letterSpacing: 1.5,
  },
  claimBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#e67e22",
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "#d35400",
  },
  claimBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  enterBtn: {
    width: "100%",
  },
});
