import { View, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Text } from "./StyledText";
import { Skull, Clock, Gift, Star } from "lucide-react-native";
import CustomButton from "./CustomButton";
import { Dungeon, DungeonRun } from "../types";
import { RESOURCE_META } from "../constants/resources";
import { useLanguage } from "../lib/i18n";
import CountdownTimer from "./CountdownTimer";

type Props = {
  dungeon: Dungeon;
  activeRun?: DungeonRun;
  onEnter: (dungeon: Dungeon) => void;
  onClaim: (run: DungeonRun) => void;
  disabled?: boolean;
};

export default function DungeonCard({ dungeon, activeRun, onEnter, onClaim, disabled }: Props) {
  const { t } = useLanguage();
  const rewardMeta = RESOURCE_META[dungeon.reward_resource];

  const isActive = activeRun?.status === "active";
  const isExpired =
    isActive && activeRun && new Date(activeRun.ends_at) <= new Date();

  function formatDuration(minutes: number) {
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60 > 0 ? `${minutes % 60}m` : ""}`.trim();
  }

  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.name}>{dungeon.name}</Text>
          <Text style={styles.description}>{dungeon.description}</Text>
        </View>
        <View style={styles.durationBadge}>
          <Clock size={10} color="#8a6a40" strokeWidth={2} />
          <Text style={styles.durationText}>{formatDuration(dungeon.duration_minutes)}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {/* Enemy */}
        <View style={styles.enemyBlock}>
          <Skull size={14} color="#c0392b" strokeWidth={2} />
          <Text style={styles.enemyName}>{dungeon.enemy_name}</Text>
          <View style={styles.enemyStats}>
            <Text style={styles.enemyStat}>⚔ {dungeon.enemy_attack}</Text>
            <Text style={styles.enemyStat}>🛡 {dungeon.enemy_defense}</Text>
            <Text style={styles.enemyStat}>✨ {dungeon.enemy_chance}%</Text>
          </View>
        </View>

        {/* Reward */}
        <View style={styles.rewardBlock}>
          <Gift size={14} color="#4a7c3f" strokeWidth={2} />
          <Text style={styles.rewardLabel}>{t("reward")}</Text>
          <View style={styles.rewardRow}>
            {rewardMeta && (
              <Image source={rewardMeta.image} style={styles.rewardIcon} resizeMode="contain" />
            )}
            <Text style={styles.rewardAmount}>×{dungeon.reward_amount}</Text>
          </View>
          <View style={styles.xpRow}>
            <Star size={11} color="#b8860b" strokeWidth={2} fill="#b8860b" />
            <Text style={styles.xpText}>+{dungeon.xp_reward} XP</Text>
          </View>
        </View>
      </View>

      {/* Action area */}
      <View style={styles.actionRow}>
        {isActive && !isExpired ? (
          // Countdown in progress
          <View style={styles.countdownBlock}>
            <Text style={styles.onMissionLabel}>{t("onMission")}</Text>
            <CountdownTimer
              endsAt={activeRun!.ends_at}
              onExpire={() => {/* parent will re-check on focus */}}
            />
          </View>
        ) : isExpired ? (
          // Ready to claim
          <TouchableOpacity style={styles.claimBtn} onPress={() => onClaim(activeRun!)}>
            <Text style={styles.claimBtnText}>{t("claimReward")}</Text>
          </TouchableOpacity>
        ) : (
          // Default — enter dungeon
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
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f5edd8",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#d4b896",
    marginBottom: 12,
    overflow: "hidden",
  },
  cardActive: {
    borderColor: "#4a7c3f",
    backgroundColor: "#edf5e9",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 14,
    paddingBottom: 8,
  },
  headerLeft: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: "#3a2a10",
  },
  description: {
    fontSize: 12,
    color: "#7a6040",
    marginTop: 2,
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ede0c4",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  durationText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8a6a40",
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 12,
  },
  enemyBlock: {
    flex: 1,
    backgroundColor: "#f9e8e8",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#e8c8c8",
  },
  enemyName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#c0392b",
  },
  enemyStats: {
    flexDirection: "row",
    gap: 6,
  },
  enemyStat: {
    fontSize: 11,
    color: "#7a3030",
    fontWeight: "600",
  },
  rewardBlock: {
    flex: 1,
    backgroundColor: "#eaf5e9",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#c8e0c8",
  },
  rewardLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4a7c3f",
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rewardIcon: {
    width: 20,
    height: 20,
  },
  rewardAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#3a2a10",
  },
  xpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  xpText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b8860b",
  },
  actionRow: {
    borderTopWidth: 1.5,
    borderTopColor: "#d4b896",
    padding: 12,
    alignItems: "center",
  },
  countdownBlock: {
    alignItems: "center",
    gap: 2,
  },
  onMissionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4a7c3f",
    letterSpacing: 1,
  },
  claimBtn: {
    backgroundColor: "#f0a030",
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 10,
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
  _placeholder: {
    color: "#e8e8e8",
  },
});
