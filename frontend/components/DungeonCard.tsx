import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
} from "react-native";
import { Text } from "./StyledText";
import { Gift, Star, Swords, Shield, Zap } from "lucide-react-native";
import { Dungeon, DungeonRun } from "../types";
import { RESOURCE_META } from "../constants/resources";
import { useLanguage } from "../lib/i18n";
import CountdownTimer from "./CountdownTimer";
import CustomButton from "./CustomButton";

const CARD_BG = require("../assets/icons/dungeon-card-bg.png");
const ENEMY_BOX_BG = require("../assets/icons/dungeon-enemy-info-box.png");
const REWARD_BOX_BG = require("../assets/icons/dungeon-reward-box-bg.png");
const ROCK_BG = require("../assets/icons/rock.png");

const ENEMY_IMAGES: Record<string, ReturnType<typeof require>> = {
  skeleton: require("../assets/icons/skeleton.png"),
  orc: require("../assets/icons/orc.png"),
  troll: require("../assets/icons/troll.png"),
  slime: require("../assets/icons/slime.png"),
  goblin: require("../assets/icons/goblin.png"),
  "dark mage": require("../assets/icons/dark-mage.png"),
};

type Props = {
  dungeon: Dungeon;
  activeRun?: DungeonRun;
  onEnter: (dungeon: Dungeon) => void;
  onClaim: (run: DungeonRun) => void;
  disabled?: boolean;
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
}: Props) {
  const { t } = useLanguage();
  const rewardMeta = RESOURCE_META[dungeon.reward_resource];
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
            <Text style={styles.dungeonName}>{dungeon.name}</Text>
            {dungeon.description ? (
              <Text style={styles.dungeonDesc} numberOfLines={2}>
                {dungeon.description}
              </Text>
            ) : null}
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
            </View>
          </ImageBackground>

          <ImageBackground
            source={REWARD_BOX_BG}
            style={styles.infoBox}
            resizeMode="stretch"
          >
            <View style={styles.infoBoxInner}>
              <Image
                source={require("../assets/icons/gift.png")}
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
              <View style={styles.xpRow}>
                <Star
                  size={11}
                  color="#c8900a"
                  strokeWidth={2}
                  fill="#c8900a"
                />
                <Text style={styles.xpText}>+{dungeon.xp_reward} XP</Text>
              </View>
            </View>
          </ImageBackground>
        </View>

        {/* Bottom: action */}
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
          <TouchableOpacity
            style={styles.claimBtn}
            onPress={() => onClaim(activeRun!)}
          >
            <Image
              source={require("../assets/icons/gift.png")}
              style={styles.rewardImage}
              resizeMode="contain"
            />
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
    width: 70,
    height: 70,
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
  missionBlock: {
    backgroundColor: "#30336b",
    borderRadius: 10,
    alignItems: "center",
    width: "90%",
    gap: 3,
    paddingVertical: 10,
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
