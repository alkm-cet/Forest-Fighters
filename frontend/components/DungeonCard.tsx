import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
} from "react-native";
import { useState } from "react";
import { Text } from "./StyledText";
import {
  Gift,
  Star,
  Swords,
  Shield,
  Zap,
  HeartPulse,
} from "lucide-react-native";
import { Dungeon, DungeonRun } from "../types";
import { RESOURCE_META } from "../constants/resources";
import { useLanguage } from "../lib/i18n";
import CountdownTimer from "./CountdownTimer";
import CustomButton from "./CustomButton";

const COIN_IMG = require("../assets/icons/icon-coin.webp");

const CARD_BG = require("../assets/dungeon/dungeon-card-bg.webp");
const ENEMY_BOX_BG = require("../assets/dungeon/dungeon-enemy-info-box.webp");
const REWARD_BOX_BG = require("../assets/dungeon/dungeon-reward-box-bg.webp");
const ROCK_BG = require("../assets/dungeon/rock.webp");

const ENEMY_IMAGES: Record<string, ReturnType<typeof require>> = {
  skeleton: require("../assets/dungeon/skeleton.webp"),
  orc: require("../assets/dungeon/orc.webp"),
  troll: require("../assets/dungeon/troll.webp"),
  slime: require("../assets/dungeon/slime.webp"),
  goblin: require("../assets/dungeon/goblin.webp"),
  "dark mage": require("../assets/dungeon/dark-mage.webp"),
};

type Props = {
  dungeon: Dungeon;
  activeRun?: DungeonRun;
  onEnter: (dungeon: Dungeon) => void;
  onClaim: (run: DungeonRun) => void;
  disabled?: boolean;
  // Harvest-specific optional props
  isOnCooldown?: boolean;
  remainingCooldownSeconds?: number;
  runsToday?: number;
  dailyRunLimit?: number | null;
  // Dungeon type display
  isBossStage?: boolean;
  rewardResource2?: string | null;
  rewardAmount2?: number;
  // In-card skip
  coins?: number;
  onSkipMission?: (run: DungeonRun) => void;
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
  isBossStage,
  rewardResource2,
  rewardAmount2,
  coins,
  onSkipMission,
}: Props) {
  const { t } = useLanguage();
  const [, forceUpdate] = useState(0);
  const rewardMeta = RESOURCE_META[dungeon.reward_resource];
  const reward2Meta = rewardResource2 ? RESOURCE_META[rewardResource2] : null;
  const enemyKey = dungeon.enemy_name?.toLowerCase() ?? "";
  const enemyImg = ENEMY_IMAGES[enemyKey] ?? null;

  const isActive = activeRun?.status === "active";
  const isExpired =
    isActive && activeRun && new Date(activeRun.ends_at) <= new Date();

  return (
    <ImageBackground
      source={CARD_BG}
      style={styles.cardBg}
      resizeMode="stretch"
    >
      <View style={styles.cardContent}>
        {/* Top: name + description + rock badge */}
        <View style={styles.topSection}>
          <View style={styles.nameBlock}>
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
            {dailyRunLimit != null && (
              <Text style={styles.dailyLimitText}>
                {runsToday ?? 0}/{dailyRunLimit} {t("dungeonCooldown")}
              </Text>
            )}
          </View>

          <ImageBackground
            source={ROCK_BG}
            style={styles.rockBadge}
            resizeMode="contain"
          >
            <Text style={styles.rockText}>
              ⏱ {formatDuration(dungeon.duration_minutes)}
            </Text>
          </ImageBackground>
        </View>

        {/* Middle: enemy box + reward box */}
        <View style={styles.boxRow}>
          <ImageBackground
            source={ENEMY_BOX_BG}
            style={styles.infoBox}
            resizeMode="stretch"
          >
            <View style={styles.infoBoxInner}>
              {enemyImg && (
                <Image
                  source={enemyImg}
                  style={styles.enemyImg}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.enemyName}>{dungeon.enemy_name}</Text>
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Swords size={10} color="#c0392b" strokeWidth={2.5} />
                  <Text style={styles.statText}>{dungeon.enemy_attack}</Text>
                </View>
                <View style={styles.statItem}>
                  <Shield size={10} color="#5d7f8a" strokeWidth={2.5} />
                  <Text style={styles.statText}>{dungeon.enemy_defense}</Text>
                </View>
                <View style={styles.statItem}>
                  <Zap size={10} color="#8a6c2a" strokeWidth={2.5} />
                  <Text style={styles.statText}>{dungeon.enemy_chance}%</Text>
                </View>
              </View>
              <View style={styles.hpRow}>
                <HeartPulse size={10} color="#c0392b" strokeWidth={2.5} />
                <Text style={styles.hpText}>{dungeon.enemy_hp} HP</Text>
              </View>
            </View>
          </ImageBackground>

          <ImageBackground
            source={REWARD_BOX_BG}
            style={styles.infoBox}
            resizeMode="stretch"
          >
            <View style={styles.infoBoxInner}>
              <Image
                source={require("../assets/icons/gift.webp")}
                style={styles.rewardImage}
                resizeMode="contain"
              />
              <Text style={styles.rewardLabel}>{t("reward")}</Text>
              <View style={styles.rewardRow}>
                {rewardMeta && (
                  <Image
                    source={rewardMeta.image}
                    style={styles.rewardImage}
                    resizeMode="contain"
                  />
                )}
                <Text style={styles.rewardAmount}>
                  ×{dungeon.reward_amount}
                </Text>
              </View>
              {reward2Meta && (rewardAmount2 ?? 0) > 0 && (
                <View style={styles.rewardRow}>
                  <Image
                    source={reward2Meta.image}
                    style={styles.rewardImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.rewardAmount}>×{rewardAmount2}</Text>
                </View>
              )}
              {(dungeon.xp_reward ?? 0) > 0 && (
                <View style={styles.xpRow}>
                  <Star
                    size={11}
                    color="#c8900a"
                    strokeWidth={2}
                    fill="#c8900a"
                  />
                  <Text style={styles.xpText}>+{dungeon.xp_reward} XP</Text>
                </View>
              )}
            </View>
          </ImageBackground>
        </View>

        {/* Bottom: action */}
        {isActive && !isExpired ? (
          <View style={styles.missionRow}>
            {/* Left: on-mission badge */}
            <View style={[styles.missionBlock, styles.missionFlex]}>
              <Text style={styles.onMissionLabel}>{t("onMission")}</Text>
              <CountdownTimer
                endsAt={activeRun!.ends_at}
                style={styles.countdownText}
                onExpire={() => forceUpdate(n => n + 1)}
              />
            </View>
            {/* Right: skip button (only when callback provided) */}
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
          <TouchableOpacity
            style={styles.claimBtn}
            onPress={() => onClaim(activeRun!)}
          >
            <Image
              source={require("../assets/icons/gift.webp")}
              style={styles.rewardImage}
              resizeMode="contain"
            />
            <Text style={styles.claimBtnText}>{t("claimReward")}</Text>
          </TouchableOpacity>
        ) : isOnCooldown && remainingCooldownSeconds != null ? (
          <View style={styles.cooldownBlock}>
            <Text style={styles.cooldownLabel}>{t("dungeonCooldown")}</Text>
            <CountdownTimer
              endsAt={new Date(Date.now() + remainingCooldownSeconds * 1000).toISOString()}
              style={styles.countdownText}
              onExpire={() => {}}
            />
          </View>
        ) : (
          <CustomButton
            btnImage={require("../assets/dungeon.png")}
            text={t("enterDungeon")}
            onClick={() => onEnter(dungeon)}
            bgColor="#6D7579"
            borderColor="#4a5f72"
            disabled={disabled}
            style={{ width: "95%" }}
          />
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  cardBg: {
    width: "100%",
  },
  cardContent: {
    gap: 15,
    paddingHorizontal: 30,
    paddingBottom: 70,
    paddingTop: 40,
    alignItems: "center",
  },
  topSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  nameBlock: {
    flex: 1,
    marginRight: 8,
  },
  dungeonName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2d2010",
    letterSpacing: 0.3,
  },
  dungeonDesc: {
    fontSize: 14,
    color: "#5a4020",
    marginTop: 3,
    lineHeight: 15,
    fontWeight: "500",
  },
  rockBadge: {
    width: 78,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  rockText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
    textShadowColor: "#00000066",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  boxRow: {
    flexDirection: "row",
    gap: 10,
  },
  infoBox: {
    flex: 1,
    aspectRatio: 1.05,
  },
  infoBoxInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  enemyImg: {
    width: 60,
    height: 60,
  },
  enemyName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#c0392b",
    letterSpacing: 0.3,
  },
  statRow: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  statText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3d2a10",
  },
  hpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  hpText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#c0392b",
  },
  rewardLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#f9ca24",
    letterSpacing: 0.3,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rewardImage: {
    width: 28,
    height: 28,
  },
  rewardAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2d2010",
  },
  xpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  xpText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#8a6010",
  },
  nameBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
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
  dailyLimitText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7a5a30",
    marginTop: 2,
  },
  cooldownBlock: {
    backgroundColor: "#5d3b8a",
    borderRadius: 10,
    alignItems: "center",
    width: "90%",
    gap: 3,
    paddingVertical: 10,
  },
  cooldownLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ce93d8",
    letterSpacing: 1.5,
  },
  missionRow: {
    flexDirection: "row",
    gap: 10,
    width: "95%",
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
    borderRadius: 12,
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
    width: "95%",
  },
  claimBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
});
