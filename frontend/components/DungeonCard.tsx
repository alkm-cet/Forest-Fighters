import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { useState } from "react";
import { Text } from "./StyledText";
import {
  Swords,
  Shield,
  Zap,
  HeartPulse,
  Lock,
} from "lucide-react-native";
import { Dungeon, DungeonRun } from "../types";
import { RESOURCE_META } from "../constants/resources";
import { useLanguage } from "../lib/i18n";
import CountdownTimer from "./CountdownTimer";
import CustomButton from "./CustomButton";

const COIN_IMG = require("../assets/icons/icon-coin.webp");

const ENEMY_IMAGES: Record<string, ReturnType<typeof require>> = {
  skeleton: require("../assets/dungeon/skeleton.webp"),
  orc: require("../assets/dungeon/orc.webp"),
  troll: require("../assets/dungeon/troll.webp"),
  slime: require("../assets/dungeon/slime.webp"),
  goblin: require("../assets/dungeon/goblin.webp"),
  "dark mage": require("../assets/dungeon/dark-mage.webp"),
  chipmunk: require("../assets/dungeon/goblin.webp"),
  squirrel: require("../assets/dungeon/goblin.webp"),
  rabbit: require("../assets/dungeon/slime.webp"),
  fox: require("../assets/dungeon/goblin.webp"),
  wolf: require("../assets/dungeon/orc.webp"),
  bear: require("../assets/dungeon/troll.webp"),
  bandit: require("../assets/dungeon/goblin.webp"),
  "bandit chief": require("../assets/dungeon/goblin.webp"),
};

type Props = {
  dungeon: Dungeon;
  activeRun?: DungeonRun;
  onEnter: (dungeon: Dungeon) => void;
  onClaim: (run: DungeonRun) => void;
  disabled?: boolean;
  isOnCooldown?: boolean;
  remainingCooldownSeconds?: number;
  runsToday?: number;
  dailyRunLimit?: number | null;
  isDailyLimitReached?: boolean;
  remainingDailyResetSeconds?: number;
  isBossStage?: boolean;
  rewardResource2?: string | null;
  rewardAmount2?: number;
  coins?: number;
  onSkipMission?: (run: DungeonRun) => void;
  championLevel?: number;
};

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${minutes % 60 > 0 ? ` ${minutes % 60}m` : ""}`;
}

export default function DungeonCard({
  dungeon,
  activeRun,
  onEnter,
  onClaim,
  disabled,
  isOnCooldown,
  remainingCooldownSeconds,
  runsToday,
  dailyRunLimit,
  isDailyLimitReached,
  remainingDailyResetSeconds,
  isBossStage,
  rewardResource2,
  rewardAmount2,
  coins,
  onSkipMission,
  championLevel = 1,
}: Props) {
  const { t } = useLanguage();
  const [, forceUpdate] = useState(0);

  const rewardMeta = RESOURCE_META[dungeon.reward_resource];
  const reward2Meta = rewardResource2 ? RESOURCE_META[rewardResource2] : null;
  const enemyKey = dungeon.enemy_name?.toLowerCase() ?? "";
  const enemyImg = ENEMY_IMAGES[enemyKey] ?? null;
  const extraRewards: Array<{ resource: string; amount: number }> = dungeon.extra_rewards ?? [];
  const minLv = dungeon.min_champion_level ?? null;
  const levelLocked = minLv !== null && championLevel < minLv;

  const isActive = activeRun?.status === "active";
  const isExpired = isActive && activeRun && new Date(activeRun.ends_at) <= new Date();

  return (
    <View style={styles.card}>
      {/* Header row: name + duration pill */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.nameBadgeRow}>
            <Text style={styles.dungeonName}>{dungeon.name}</Text>
            {isBossStage && (
              <View style={styles.bossBadge}>
                <Text style={styles.bossBadgeText}>👑 BOSS</Text>
              </View>
            )}
          </View>
          {dungeon.description ? (
            <Text style={styles.dungeonDesc} numberOfLines={2}>
              {dungeon.description}
            </Text>
          ) : null}
        </View>
        <View style={styles.durationPill}>
          <Text style={styles.durationText}>⏱ {formatDuration(dungeon.duration_minutes)}</Text>
        </View>
      </View>

      {/* Enemy block */}
      <View style={styles.enemyBlock}>
        {enemyImg && (
          <Image source={enemyImg} style={styles.enemyImg} resizeMode="contain" />
        )}
        <View style={styles.enemyInfo}>
          <Text style={styles.enemyName}>{dungeon.enemy_name}</Text>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Swords size={11} color="#c0392b" strokeWidth={2.5} />
              <Text style={styles.statText}>{dungeon.enemy_attack}</Text>
            </View>
            <View style={styles.statItem}>
              <Shield size={11} color="#1565c0" strokeWidth={2.5} />
              <Text style={styles.statText}>{dungeon.enemy_defense}</Text>
            </View>
            <View style={styles.statItem}>
              <Zap size={11} color="#2e7d32" strokeWidth={2.5} />
              <Text style={styles.statText}>{dungeon.enemy_chance}%</Text>
            </View>
          </View>
          <View style={styles.hpRow}>
            <HeartPulse size={11} color="#c0392b" strokeWidth={2.5} />
            <Text style={styles.hpText}>{dungeon.enemy_hp} HP</Text>
          </View>
        </View>
      </View>

      {/* Level requirement badge */}
      {minLv !== null && (
        <View style={[styles.levelBadge, levelLocked && styles.levelBadgeLocked]}>
          {levelLocked && <Lock size={11} color="#fff" strokeWidth={2.5} />}
          <Text style={styles.levelBadgeText}>
            {levelLocked
              ? `Lv ${minLv}+ gerekli (senin: ${championLevel})`
              : `✓ Lv ${minLv}+ açık`}
          </Text>
        </View>
      )}

      {/* Reward pills */}
      <View style={styles.rewardRowWrap}>
        {rewardMeta && (
          <View style={styles.rewardPill}>
            <Image source={rewardMeta.image} style={styles.rewardIcon} resizeMode="contain" />
            <Text style={styles.rewardPillText}>×{dungeon.reward_amount}</Text>
          </View>
        )}
        {reward2Meta && (rewardAmount2 ?? 0) > 0 && (
          <View style={styles.rewardPill}>
            <Image source={reward2Meta.image} style={styles.rewardIcon} resizeMode="contain" />
            <Text style={styles.rewardPillText}>×{rewardAmount2}</Text>
          </View>
        )}
        {extraRewards.map((er, i) => {
          const meta = RESOURCE_META[er.resource];
          if (!meta) return null;
          return (
            <View key={i} style={styles.rewardPill}>
              <Image source={meta.image} style={styles.rewardIcon} resizeMode="contain" />
              <Text style={styles.rewardPillText}>×{er.amount}</Text>
            </View>
          );
        })}
      </View>

      {/* Daily limit row */}
      {dailyRunLimit != null && (
        <View style={[styles.dailyRow, isDailyLimitReached && styles.dailyRowFull]}>
          <Text style={[styles.dailyText, isDailyLimitReached && styles.dailyTextFull]}>
            📅 Günlük: {runsToday ?? 0}/{dailyRunLimit} giriş
            {isDailyLimitReached ? " — Doldu" : ""}
          </Text>
        </View>
      )}

      {/* Action section */}
      {isActive && !isExpired ? (
        <View style={styles.missionRow}>
          <View style={[styles.missionBlock, styles.missionFlex]}>
            <Text style={styles.onMissionLabel}>{t("onMission")}</Text>
            <CountdownTimer
              endsAt={activeRun!.ends_at}
              style={styles.countdownText}
              onExpire={() => forceUpdate(n => n + 1)}
            />
          </View>
          {onSkipMission && (() => {
            const secsLeft = Math.max(0, Math.ceil((new Date(activeRun!.ends_at).getTime() - Date.now()) / 1000));
            const cost = Math.max(1, Math.ceil(secsLeft / 60));
            const canAfford = (coins ?? 0) >= cost;
            return (
              <TouchableOpacity
                style={[styles.skipBtn, styles.missionFlex, !canAfford && styles.skipBtnDisabled]}
                onPress={() => canAfford && onSkipMission(activeRun!)}
                activeOpacity={0.8}
              >
                <Text style={styles.skipLabel}>{t("skipMissionNow")}</Text>
                <View style={styles.skipCostRow}>
                  <Image source={COIN_IMG} style={styles.skipCoinImg} resizeMode="contain" />
                  <Text style={styles.skipCost}>×{cost}</Text>
                </View>
              </TouchableOpacity>
            );
          })()}
        </View>
      ) : isExpired ? (
        <TouchableOpacity style={styles.claimBtn} onPress={() => onClaim(activeRun!)}>
          <Image
            source={require("../assets/icons/gift.webp")}
            style={styles.rewardIcon}
            resizeMode="contain"
          />
          <Text style={styles.claimBtnText}>{t("claimReward")}</Text>
        </TouchableOpacity>
      ) : isOnCooldown && remainingCooldownSeconds != null ? (
        <View style={styles.cooldownBlock}>
          <Text style={styles.cooldownLabel}>⏳ Bekleme Süresi</Text>
          <CountdownTimer
            endsAt={new Date(Date.now() + remainingCooldownSeconds * 1000).toISOString()}
            style={styles.countdownText}
            onExpire={() => {}}
          />
        </View>
      ) : isDailyLimitReached && remainingDailyResetSeconds != null ? (
        <View style={styles.dailyLimitBlock}>
          <Text style={styles.dailyLimitLabel}>📅 Günlük Limit Doldu — Yarın Sıfırlanır</Text>
          <CountdownTimer
            endsAt={new Date(Date.now() + remainingDailyResetSeconds * 1000).toISOString()}
            style={styles.dailyCountdownText}
            onExpire={() => {}}
          />
        </View>
      ) : (
        <CustomButton
          btnImage={require("../assets/dungeon.png")}
          text={t("enterDungeon")}
          onClick={() => onEnter(dungeon)}
          bgColor={levelLocked ? "#8b0000" : "#6D7579"}
          borderColor={levelLocked ? "#5d0000" : "#4a5f72"}
          disabled={disabled || levelLocked}
          style={{ width: "100%" }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f5e9cc",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    gap: 3,
  },
  nameBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  dungeonName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2d2010",
    letterSpacing: 0.2,
  },
  bossBadge: {
    backgroundColor: "#f39c12",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  bossBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  dungeonDesc: {
    fontSize: 12,
    color: "#5a4020",
    lineHeight: 16,
    fontWeight: "500",
  },
  durationPill: {
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c8a96e",
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  durationText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5a3a10",
  },
  enemyBlock: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c8a96e",
    padding: 10,
    gap: 10,
  },
  enemyImg: {
    width: 56,
    height: 56,
  },
  enemyInfo: {
    flex: 1,
    gap: 4,
  },
  enemyName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#3d2a10",
    letterSpacing: 0.2,
  },
  statRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  statText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3d2a10",
  },
  hpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  hpText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#c0392b",
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#2e7d32",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  levelBadgeLocked: {
    backgroundColor: "#c62828",
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
  },
  rewardRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  rewardPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c8a96e",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  rewardIcon: {
    width: 22,
    height: 22,
  },
  rewardPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3d2a10",
  },
  dailyRow: {
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  dailyText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7a5a30",
  },
  cooldownBlock: {
    backgroundColor: "#5d3b8a",
    borderRadius: 10,
    alignItems: "center",
    gap: 3,
    paddingVertical: 10,
  },
  cooldownLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ce93d8",
    letterSpacing: 0.5,
  },
  dailyLimitBlock: {
    backgroundColor: "#b71c1c",
    borderRadius: 10,
    alignItems: "center",
    gap: 3,
    paddingVertical: 10,
  },
  dailyLimitLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffcdd2",
    letterSpacing: 0.3,
  },
  dailyCountdownText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1.2,
  },
  dailyRowFull: {
    backgroundColor: "rgba(183,28,28,0.1)",
  },
  dailyTextFull: {
    color: "#b71c1c",
  },
  missionRow: {
    flexDirection: "row",
    gap: 10,
  },
  missionFlex: {
    flex: 1,
  },
  missionBlock: {
    backgroundColor: "#e8f5e9",
    borderRadius: 12,
    alignItems: "center",
    gap: 2,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: "#a5d6a7",
  },
  onMissionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#4a7c3f",
    letterSpacing: 1.5,
  },
  skipBtn: {
    backgroundColor: "#2e7d32",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "#1b5e20",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  skipBtnDisabled: {
    opacity: 0.45,
  },
  skipLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#c8f5c8",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  skipCostRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  skipCoinImg: {
    width: 20,
    height: 20,
  },
  skipCost: {
    fontSize: 16,
    fontWeight: "900",
    color: "#fff",
  },
  countdownText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2d5a24",
    letterSpacing: 1.2,
  },
  claimBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#e67e22",
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: "#d35400",
  },
  claimBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
});
