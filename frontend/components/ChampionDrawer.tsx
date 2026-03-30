import { useRef, useEffect, useState } from "react";
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  PanResponder,
  ScrollView,
  Dimensions,
} from "react-native";

const SCREEN_HEIGHT = Dimensions.get("window").height;
import { Text } from "./StyledText";
import {
  X,
  Swords,
  Gift,
  MapPin,
  Heart,
  Sparkles,
  HeartPulse,
  Shield,
  Zap,
  History,
  Trophy,
  Clock,
  ChevronLeft,
} from "lucide-react-native";
import { Champion, DungeonRun, Resources, PvpBattle } from "../types";
import { CLASS_META, RESOURCE_META } from "../constants/resources";
import CustomModal from "./CustomModal";
import api from "../lib/api";

const PLUS_BTN = require("../assets/plus-button-image.png");
import { useLanguage } from "../lib/i18n";

import PvpBattleButton from "./PvpBattleButton";
import EnterDungeonButton from "./EnterDungeonButton";
import CountdownTimer from "./CountdownTimer";

const REVIVE_COST = 3;

type StatKey = "attack" | "defense" | "chance";

type BoostType = "hp" | "defense" | "chance";

type Props = {
  champion: Champion | null;
  resources?: Resources;
  onClose: () => void;
  onPvp: (champion: Champion) => void;
  onDungeon: (champion: Champion) => void;
  claimableRun?: DungeonRun;
  isOnMission?: boolean;
  activeRunEndsAt?: string;
  onClaim?: (run: DungeonRun) => void;
  onRevive?: (champion: Champion) => void;
  onHeal?: (champion: Champion) => void;
  onSpendStat?: (champion: Champion, stat: StatKey) => void;
  onBoost?: (champion: Champion, type: BoostType) => void;
  onMissionExpire?: () => void;
  onSetDefender?: (champion: Champion) => void;
  defenderChampionId?: string | null;
  pvpTrophies?: number;
  pvpLeague?: string;
  isPvpBattle?: boolean;
  pvpBattleEndsAt?: string;
  onViewPvpResult?: () => void;
};

const BOOST_META: Record<
  BoostType,
  {
    label: string;
    icon: React.ReactNode;
    cost: number;
    costImage: ReturnType<typeof require>;
    boostCol: keyof Champion;
  }
> = {
  hp: {
    label: "+10 HP",
    icon: null,
    cost: 4,
    costImage: require("../assets/resource-images/strawberry.webp"),
    boostCol: "boost_hp",
  },
  defense: {
    label: "+5 DEF",
    icon: null,
    cost: 4,
    costImage: require("../assets/resource-images/pinecone.webp"),
    boostCol: "boost_defense",
  },
  chance: {
    label: "+5 CHC",
    icon: null,
    cost: 3,
    costImage: require("../assets/resource-images/blueberry.webp"),
    boostCol: "boost_chance",
  },
};

const BOOST_RESOURCE: Record<BoostType, keyof Resources> = {
  hp: "strawberry",
  defense: "pinecone",
  chance: "blueberry",
};

const STAT_MAX = 100;
const DISMISS_THRESHOLD = 100;

function StatRow({
  label,
  value,
  boost,
  canUpgrade,
  onUpgrade,
}: {
  label: string;
  value: number;
  boost?: number;
  canUpgrade?: boolean;
  onUpgrade?: () => void;
}) {
  const pct = Math.min((value + (boost ?? 0)) / STAT_MAX, 1);
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${Math.round(pct * 100)}%` as any },
          ]}
        />
      </View>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {(boost ?? 0) > 0 && <Text style={styles.statBoost}> +{boost}</Text>}
      </View>
      {canUpgrade && (
        <TouchableOpacity
          onPress={onUpgrade}
          activeOpacity={0.75}
          style={styles.statPlusWrap}
        >
          <Image
            source={PLUS_BTN}
            style={styles.statPlusBtn}
            resizeMode="contain"
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ChampionDrawer({
  champion,
  resources,
  onClose,
  onPvp,
  onDungeon,
  claimableRun,
  isOnMission,
  activeRunEndsAt,
  onClaim,
  onRevive,
  onHeal,
  onSpendStat,
  onBoost,
  onMissionExpire,
  onSetDefender,
  defenderChampionId,
  pvpTrophies,
  pvpLeague,
  isPvpBattle,
  pvpBattleEndsAt,
  onViewPvpResult,
}: Props) {
  const { t } = useLanguage();
  const translateY = useRef(new Animated.Value(0)).current;
  const contentScrollY = useRef(0);
  const [pendingStat, setPendingStat] = useState<StatKey | null>(null);
  const [pendingBoost, setPendingBoost] = useState<BoostType | null>(null);
  const [historyTab, setHistoryTab] = useState(false);
  const [history, setHistory] = useState<PvpBattle[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showDefenderWarning, setShowDefenderWarning] = useState(false);
  const [pvpBattleExpired, setPvpBattleExpired] = useState(
    () => !!pvpBattleEndsAt && new Date(pvpBattleEndsAt) <= new Date(),
  );

  useEffect(() => {
    setPvpBattleExpired(
      !!pvpBattleEndsAt && new Date(pvpBattleEndsAt) <= new Date(),
    );
  }, [pvpBattleEndsAt]);

  useEffect(() => {
    if (champion) {
      translateY.setValue(0);
      setHistoryTab(false);
      setHistory([]);
      setShowDefenderWarning(false);
    }
  }, [champion?.id]);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await api.get("/api/pvp/history");
      setHistory(res.data);
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        contentScrollY.current === 0 &&
        gs.dy > 8 &&
        Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > DISMISS_THRESHOLD || gs.vy > 0.6) {
          Animated.timing(translateY, {
            toValue: 800,
            duration: 180,
            useNativeDriver: true,
          }).start(() => onClose());
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 10,
          }).start();
        }
      },
    }),
  ).current;

  if (!champion) return null;

  const meta = CLASS_META[champion.class] ?? {
    image: null,
    color: "#888",
    cost: 0,
  };
  const isDefenderChamp = defenderChampionId === champion.id;

  return (
    <Modal
      visible={!!champion}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Transparent backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.drawer, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        {/* Top bar: handle centered, close button on right */}
        <View style={styles.topBar}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <X size={14} color="#7a5230" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* History toggle + level */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.classBadge, historyTab && styles.classBadgeActive]}
            onPress={() => {
              const next = !historyTab;
              setHistoryTab(next);
              if (next && history.length === 0) loadHistory();
            }}
            activeOpacity={0.75}
          >
            {historyTab ? (
              <ChevronLeft size={12} color="#fff" strokeWidth={2.5} />
            ) : (
              <History size={12} color="#2d5a24" strokeWidth={2.5} />
            )}
            <Text
              style={[
                styles.classBadgeText,
                historyTab && styles.classBadgeTextActive,
              ]}
            >
              {historyTab ? "GERİ DÖN" : "HISTORY"}
            </Text>
          </TouchableOpacity>
          <View style={styles.bannerLeftWrapper}>
            {/* Defender banner — always visible */}
            {isDefenderChamp && (
              <View style={styles.defenderBannerStrip}>
                <Shield size={14} color="#fff" strokeWidth={2.5} />
                <Text style={styles.defenderBannerText}>SAVUNUCU</Text>
              </View>
            )}
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeLabel}>LV</Text>
              <Text style={styles.levelBadgeNum}>{champion.level}</Text>
            </View>
          </View>
        </View>

        {/* History tab content */}
        {historyTab && (
          <ScrollView
            style={styles.historyScroll}
            showsVerticalScrollIndicator={false}
          >
            {historyLoading ? (
              <Text style={styles.historyEmpty}>Yükleniyor...</Text>
            ) : history.length === 0 ? (
              <Text style={styles.historyEmpty}>{t("noHistory")}</Text>
            ) : (
              history.map((battle) => {
                const won = battle.winner_id === battle.attacker_id;
                const trophyDelta = battle.attacker_trophies_delta;
                return (
                  <View
                    key={battle.id}
                    style={[
                      styles.historyItem,
                      won ? styles.historyItemWin : styles.historyItemLose,
                    ]}
                  >
                    <View style={styles.historyItemTop}>
                      <Text
                        style={[
                          styles.historyItemResult,
                          won ? styles.historyWinText : styles.historyLoseText,
                        ]}
                      >
                        {won ? "⚔️ " + t("pvpVictory") : "💀 " + t("pvpDefeat")}
                      </Text>
                      <View style={styles.historyTrophyRow}>
                        <Trophy
                          size={11}
                          color={trophyDelta >= 0 ? "#d4a017" : "#c0392b"}
                          strokeWidth={2}
                        />
                        <Text
                          style={[
                            styles.historyTrophyDelta,
                            trophyDelta >= 0
                              ? styles.historyWinText
                              : styles.historyLoseText,
                          ]}
                        >
                          {trophyDelta >= 0 ? "+" : ""}
                          {trophyDelta}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.historyOpponent}>
                      vs {battle.defender_name}
                    </Text>
                    <View style={styles.historyResRow}>
                      {(["strawberry", "pinecone", "blueberry"] as const).map(
                        (r) => {
                          const amt = (battle as any)[`transferred_${r}`] ?? 0;
                          if (amt === 0) return null;
                          const meta = RESOURCE_META[r];
                          return (
                            <View key={r} style={styles.historyResItem}>
                              <Image
                                source={meta.image}
                                style={styles.historyResIcon}
                                resizeMode="contain"
                              />
                              <Text
                                style={[
                                  styles.historyResAmt,
                                  won
                                    ? styles.historyWinText
                                    : styles.historyLoseText,
                                ]}
                              >
                                {won ? "+" : "-"}
                                {amt}
                              </Text>
                            </View>
                          );
                        },
                      )}
                    </View>
                    <Text style={styles.historyDate}>
                      {new Date(battle.fought_at).toLocaleDateString()}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {!historyTab && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            onScroll={(e) => {
              contentScrollY.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            {/* XP progress bar */}
            <View style={styles.xpRow}>
              <View style={styles.xpBarTrack}>
                <View
                  style={[
                    styles.xpBarFill,
                    {
                      width: `${Math.min(
                        100,
                        Math.round(
                          (champion.xp / champion.xp_to_next_level) * 100,
                        ),
                      )}%` as any,
                    },
                  ]}
                />
              </View>
              <Text style={styles.xpLabel}>
                {champion.xp} / {champion.xp_to_next_level} XP
              </Text>
            </View>

            {/* Champion name */}
            <Text style={styles.champName}>{champion.name}</Text>

            {/* Champion image + boost buttons */}
            <View style={styles.imageAndBoostRow}>
              <View style={styles.imageFrame}>
                {meta.image && (
                  <Image
                    source={meta.image}
                    style={styles.champImage}
                    resizeMode="contain"
                  />
                )}
                {/* Active boost badges on image corners */}
                {(champion.boost_hp ?? 0) > 0 && (
                  <View style={[styles.boostBadge, styles.boostBadgeTopLeft]}>
                    <Image
                      source={require("../assets/icons/heart.png")}
                      style={styles.boostBtnCostIcon}
                      resizeMode="contain"
                    />
                  </View>
                )}
                {(champion.boost_defense ?? 0) > 0 && (
                  <View
                    style={[styles.boostBadge, styles.boostBadgeBottomLeft]}
                  >
                    <Image
                      source={require("../assets/icons/shield.png")}
                      style={styles.boostBtnCostIcon}
                      resizeMode="contain"
                    />
                  </View>
                )}
                {(champion.boost_chance ?? 0) > 0 && (
                  <View style={[styles.boostBadge, styles.boostBadgeTopRight]}>
                    <Image
                      source={require("../assets/icons/lightning.png")}
                      style={styles.boostBtnCostIcon}
                      resizeMode="contain"
                    />
                  </View>
                )}
              </View>

              {/* Boost buttons */}
              <View style={styles.boostBtns}>
                {(Object.keys(BOOST_META) as BoostType[]).map((type) => {
                  const bm = BOOST_META[type];
                  const resKey = BOOST_RESOURCE[type];
                  const isActive = ((champion[bm.boostCol] as number) ?? 0) > 0;
                  const canAfford = (resources?.[resKey] ?? 0) >= bm.cost;
                  const disabled = isActive || !canAfford || !!isPvpBattle;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.boostBtn,
                        isActive && styles.boostBtnActive,
                        disabled && !isActive && styles.boostBtnDisabled,
                      ]}
                      onPress={() => !disabled && setPendingBoost(type)}
                      activeOpacity={0.75}
                    >
                      {type === "hp" && (
                        <Heart
                          size={11}
                          color={isActive ? "#fff" : "#c0392b"}
                          strokeWidth={2}
                          fill={isActive ? "#fff" : "#c0392b"}
                        />
                      )}
                      {type === "defense" && (
                        <Shield
                          size={11}
                          color={isActive ? "#fff" : "#4a7c3f"}
                          strokeWidth={2}
                        />
                      )}
                      {type === "chance" && (
                        <Zap
                          size={11}
                          color={isActive ? "#fff" : "#8a5cc7"}
                          strokeWidth={2}
                          fill={isActive ? "#fff" : "#8a5cc7"}
                        />
                      )}
                      <Text
                        style={[
                          styles.boostBtnLabel,
                          isActive && styles.boostBtnLabelActive,
                        ]}
                      >
                        {bm.label}
                      </Text>
                      {!isActive && (
                        <View style={styles.boostBtnCostRow}>
                          <Image
                            source={bm.costImage}
                            style={styles.boostBtnCostIcon}
                            resizeMode="contain"
                          />
                          <Text
                            style={[
                              styles.boostBtnCost,
                              !canAfford && styles.boostBtnCostRed,
                            ]}
                          >
                            ×{bm.cost}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Boost confirmation modal */}
            {pendingBoost && champion && (
              <CustomModal
                visible={true}
                onClose={() => setPendingBoost(null)}
                onConfirm={() => {
                  onBoost?.(champion, pendingBoost);
                  setPendingBoost(null);
                }}
                title={t("boostConfirmTitle")}
                confirmDisabled={
                  (resources?.[BOOST_RESOURCE[pendingBoost]] ?? 0) <
                  BOOST_META[pendingBoost].cost
                }
              >
                <View style={styles.boostModalBody}>
                  <Text style={styles.boostModalEffect}>
                    {BOOST_META[pendingBoost].label}
                  </Text>
                  <View style={styles.boostModalCostRow}>
                    <Text style={styles.boostModalCost}>
                      {t("upgradeCost")}:{" "}
                    </Text>
                    <Image
                      source={BOOST_META[pendingBoost].costImage}
                      style={styles.boostModalCostIcon}
                      resizeMode="contain"
                    />
                    <Text style={styles.boostModalCost}>
                      ×{BOOST_META[pendingBoost].cost}
                    </Text>
                  </View>
                  <Text style={styles.boostModalNote}>
                    {t("boostActiveUntil")}
                  </Text>
                </View>
              </CustomModal>
            )}

            {/* HP Bar */}
            {(() => {
              const boostHp = champion.boost_hp ?? 0;
              const effectiveMaxHp = champion.max_hp + boostHp;
              const hpPct =
                effectiveMaxHp > 0 ? champion.current_hp / effectiveMaxHp : 0;
              const hpColor =
                hpPct > 0.6 ? "#2d8a3e" : hpPct > 0.3 ? "#d4a017" : "#c0392b";
              return (
                <View style={styles.hpSection}>
                  <View style={styles.hpLabelRow}>
                    <HeartPulse size={14} color={hpColor} strokeWidth={2.5} />
                    <Text style={[styles.hpTitle, { color: hpColor }]}>
                      {champion.current_hp} / {champion.max_hp}
                      {boostHp > 0 && (
                        <Text style={styles.hpBoost}> +{boostHp}</Text>
                      )}{" "}
                      HP
                    </Text>
                  </View>
                  <View style={styles.hpBarTrack}>
                    <View
                      style={[
                        styles.hpBarFill,
                        {
                          width:
                            `${Math.round(Math.max(0, hpPct) * 100)}%` as any,
                          backgroundColor: hpColor,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })()}

            {/* Divider */}
            <View style={styles.divider} />

            {/* Stats */}
            <View style={styles.sectionLabelRow}>
              <Swords size={12} color="#9a7040" strokeWidth={2} />
              <Text style={styles.sectionLabel}>{t("baseStatistics")}</Text>
              {champion.stat_points > 0 && (
                <View style={styles.statPointsBadge}>
                  <Text style={styles.statPointsText}>
                    +{champion.stat_points} {t("statPoints")}
                  </Text>
                </View>
              )}
            </View>
            <StatRow
              label={t("attack")}
              value={champion.attack}
              canUpgrade={champion.stat_points > 0 && !isPvpBattle}
              onUpgrade={() => setPendingStat("attack")}
            />
            <StatRow
              label={t("defense")}
              value={champion.defense}
              boost={champion.boost_defense || undefined}
              canUpgrade={champion.stat_points > 0 && !isPvpBattle}
              onUpgrade={() => setPendingStat("defense")}
            />
            <StatRow
              label={t("chance")}
              value={champion.chance}
              boost={champion.boost_chance || undefined}
              canUpgrade={champion.stat_points > 0 && !isPvpBattle}
              onUpgrade={() => setPendingStat("chance")}
            />

            {/* Stat upgrade confirmation modal */}
            {pendingStat && (
              <Modal
                visible
                transparent
                animationType="fade"
                onRequestClose={() => setPendingStat(null)}
              >
                <TouchableWithoutFeedback onPress={() => setPendingStat(null)}>
                  <View style={styles.confirmOverlay} />
                </TouchableWithoutFeedback>
                <View style={styles.confirmCard}>
                  <TouchableOpacity
                    style={styles.confirmClose}
                    onPress={() => setPendingStat(null)}
                    activeOpacity={0.7}
                  >
                    <X size={14} color="#7a5230" strokeWidth={2.5} />
                  </TouchableOpacity>
                  <Text style={styles.confirmTitle}>
                    {t("confirmUpgradeTitle")}
                  </Text>
                  <Text style={styles.confirmSubtitle}>
                    {t(
                      pendingStat === "attack"
                        ? "upgradeStatAttack"
                        : pendingStat === "defense"
                          ? "upgradeStatDefense"
                          : "upgradeStatChance",
                    )}
                  </Text>
                  <View style={styles.confirmValueRow}>
                    <Text style={styles.confirmValueCurrent}>
                      {champion[pendingStat]}
                    </Text>
                    <Text style={styles.confirmValueArrow}>→</Text>
                    <Text style={styles.confirmValueNext}>
                      {champion[pendingStat] + 1}
                    </Text>
                  </View>
                  <View style={styles.confirmBtnRow}>
                    <TouchableOpacity
                      style={styles.confirmRejectBtn}
                      onPress={() => setPendingStat(null)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.confirmRejectText}>
                        {t("cancelBtn")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmAcceptBtn}
                      onPress={() => {
                        onSpendStat?.(champion, pendingStat);
                        setPendingStat(null);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.confirmAcceptText}>
                        {t("confirmUpgradeBtn")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
            )}

            {/* Buttons */}
            {champion.current_hp <= 0 ? (
              // Dead champion — show revive button full width
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[
                    styles.reviveBtn,
                    styles.btnFlex,
                    (resources?.strawberry ?? 0) < REVIVE_COST &&
                      styles.btnDisabled,
                  ]}
                  onPress={() =>
                    (resources?.strawberry ?? 0) >= REVIVE_COST &&
                    onRevive?.(champion)
                  }
                  activeOpacity={0.8}
                >
                  <Sparkles size={16} color="#fff" strokeWidth={2} />
                  <Text style={styles.reviveBtnText}>{t("revive")}</Text>
                  <Text style={styles.reviveCost}>🍓 ×{REVIVE_COST}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* === PvP Battle state === */}
                {isPvpBattle ? (
                  pvpBattleExpired ? (
                    // Result ready — "Sonucu Gör" button
                    <View style={styles.btnRow}>
                      <TouchableOpacity
                        style={[styles.claimBtn, styles.btnFlex]}
                        onPress={onViewPvpResult}
                        activeOpacity={0.8}
                      >
                        <Swords size={16} color="#fff" strokeWidth={2} />
                        <Text style={styles.claimBtnText}>Sonucu Gör</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    // Battle in progress — countdown box
                    <View
                      style={[
                        styles.onMissionBtn,
                        styles.btnFlex,
                        styles.pvpBattleBtn,
                        { marginTop: 20 },
                      ]}
                    >
                      <Swords size={16} color="#8a5cc7" strokeWidth={2} />
                      <View style={styles.onMissionInner}>
                        <Text
                          style={[styles.onMissionText, { color: "#8a5cc7" }]}
                        >
                          Savaşta!
                        </Text>
                        {pvpBattleEndsAt && (
                          <CountdownTimer
                            endsAt={pvpBattleEndsAt}
                            style={[
                              styles.onMissionTimer,
                              { color: "#6a3ca7" },
                            ]}
                            onExpire={() => setPvpBattleExpired(true)}
                          />
                        )}
                      </View>
                    </View>
                  )
                ) : (
                  <>
                    {/* === Normal button row === */}
                    <View style={styles.btnRow}>
                      {!isOnMission && !claimableRun && (
                        <View
                          style={[
                            styles.btnFlex,
                            isDefenderChamp && styles.btnDefenderDim,
                          ]}
                        >
                          <PvpBattleButton
                            onPress={() =>
                              isDefenderChamp
                                ? setShowDefenderWarning(true)
                                : onPvp(champion)
                            }
                            style={styles.btnFlex}
                          />
                        </View>
                      )}
                      {claimableRun ? (
                        <TouchableOpacity
                          style={[styles.claimBtn, styles.btnFlex]}
                          onPress={() => onClaim?.(claimableRun)}
                          activeOpacity={0.8}
                        >
                          <Gift size={16} color="#fff" strokeWidth={2} />
                          <Text style={styles.claimBtnText}>
                            {t("claimReward")}
                          </Text>
                        </TouchableOpacity>
                      ) : isOnMission ? (
                        <View style={[styles.onMissionBtn, styles.btnFlex]}>
                          <MapPin size={16} color="#4a7c3f" strokeWidth={2} />
                          <View style={styles.onMissionInner}>
                            <Text style={styles.onMissionText}>
                              {t("onMission")}
                            </Text>
                            {activeRunEndsAt && (
                              <CountdownTimer
                                endsAt={activeRunEndsAt}
                                style={styles.onMissionTimer}
                                onExpire={onMissionExpire}
                              />
                            )}
                          </View>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.btnFlex,
                            isDefenderChamp && styles.btnDefenderDim,
                          ]}
                        >
                          <EnterDungeonButton
                            onPress={() =>
                              isDefenderChamp
                                ? setShowDefenderWarning(true)
                                : onDungeon(champion)
                            }
                            style={styles.btnFlex}
                          />
                        </View>
                      )}
                    </View>

                    {/* Heal button — only when injured and not on mission */}
                    {!isOnMission &&
                      champion.current_hp <
                        champion.max_hp + (champion.boost_hp ?? 0) &&
                      (() => {
                        const effectiveMax =
                          champion.max_hp + (champion.boost_hp ?? 0);
                        const healCost = Math.ceil(
                          (effectiveMax - champion.current_hp) / 35,
                        );
                        const canHeal =
                          (resources?.strawberry ?? 0) >= healCost;
                        return (
                          <TouchableOpacity
                            style={[
                              styles.healBtn,
                              !canHeal && styles.btnDisabled,
                            ]}
                            onPress={() => canHeal && onHeal?.(champion)}
                            activeOpacity={0.8}
                          >
                            <Heart
                              size={15}
                              color="#fff"
                              strokeWidth={2}
                              fill="#fff"
                            />
                            <Text style={styles.healBtnText}>{t("heal")}</Text>
                            <Text style={styles.healCost}>🍓 ×{healCost}</Text>
                          </TouchableOpacity>
                        );
                      })()}
                  </>
                )}

                {/* Defender button */}
                {onSetDefender &&
                  !isDefenderChamp &&
                  (() => {
                    const isDisabled =
                      champion.last_defender ||
                      champion.is_deployed ||
                      champion.current_hp <= 0;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.defenderBtn,
                          isDisabled && styles.btnDisabled,
                        ]}
                        onPress={() => !isDisabled && onSetDefender(champion)}
                        activeOpacity={isDisabled ? 1 : 0.8}
                      >
                        <Shield
                          size={14}
                          color={isDisabled ? "#7f8c9a" : "#4a7c3f"}
                          strokeWidth={2.5}
                        />
                        <Text
                          style={[
                            styles.defenderBtnText,
                            isDisabled && styles.defenderBtnTextDim,
                          ]}
                        >
                          {champion.last_defender
                            ? t("defenderCooldown")
                            : t("setDefender")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })()}
              </>
            )}
          </ScrollView>
        )}

        {/* Defender warning modal */}
        {showDefenderWarning && (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={() => setShowDefenderWarning(false)}
          >
            <TouchableWithoutFeedback
              onPress={() => setShowDefenderWarning(false)}
            >
              <View style={styles.confirmOverlay} />
            </TouchableWithoutFeedback>
            <View style={styles.confirmCard}>
              <TouchableOpacity
                style={styles.confirmClose}
                onPress={() => setShowDefenderWarning(false)}
                activeOpacity={0.7}
              >
                <X size={14} color="#7a5230" strokeWidth={2.5} />
              </TouchableOpacity>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <Shield size={20} color="#4a7c3f" strokeWidth={2.5} />
                <Text style={styles.confirmTitle}>Savunucu Şampiyon</Text>
              </View>
              <Text style={styles.confirmSubtitle}>
                Bu şampiyon savunucu olarak seçilmiş. Savaştırmak için önce
                başka bir şampiyonu savunucu olarak ata.
              </Text>
              <TouchableOpacity
                style={styles.confirmAcceptBtn}
                onPress={() => setShowDefenderWarning(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmAcceptText}>Tamam</Text>
              </TouchableOpacity>
            </View>
          </Modal>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  drawer: {
    backgroundColor: "#f5e9cc",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: "#c8a96e",
    paddingHorizontal: 22,
    paddingBottom: 36,
    paddingTop: 8,
    maxHeight: SCREEN_HEIGHT * 0.82,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  handleWrap: {
    flex: 1,
    alignItems: "center",
    paddingLeft: 38,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#c8a96e",
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#e8d5a8",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  classBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#c8e6c9",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#4a7c3f",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  classBadgeActive: {
    backgroundColor: "#4a7c3f",
    borderColor: "#2d5a24",
  },
  classBadgeText: {
    color: "#2d5a24",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  classBadgeTextActive: {
    color: "#fff",
  },
  bannerLeftWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    backgroundColor: "#3a1e00",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelBadgeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#d4a84b",
    letterSpacing: 1,
  },
  levelBadgeNum: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f5c842",
    lineHeight: 24,
  },
  xpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  xpBarTrack: {
    flex: 1,
    height: 7,
    backgroundColor: "#e0d0b0",
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#c8a96e",
  },
  xpBarFill: {
    height: "100%",
    backgroundColor: "#f5c842",
    borderRadius: 4,
  },
  xpLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9a7040",
    minWidth: 80,
    textAlign: "right",
  },
  champName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#3a1e00",
    marginBottom: 12,
  },
  imageAndBoostRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  imageFrame: {
    width: 148,
    height: 148,
    backgroundColor: "#ede0c4",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#c8a96e",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#b8893a",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  champImage: {
    width: 128,
    height: 128,
  },
  boostBadge: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#b2bec3",
    borderWidth: 2,
    borderColor: "#f5e9cc",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  boostBadgeTopLeft: {
    top: -7,
    left: -7,
  },
  boostBadgeBottomLeft: {
    bottom: -7,
    left: -7,
  },
  boostBadgeTopRight: {
    top: -7,
    right: -7,
  },
  boostBtns: {
    flex: 1,
    gap: 8,
  },
  boostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ede0c4",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  boostBtnActive: {
    backgroundColor: "#3a1e00",
    borderColor: "#6a3e00",
  },
  boostBtnDisabled: {
    opacity: 0.45,
  },
  boostBtnLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#3a1e00",
    flex: 1,
  },
  boostBtnLabelActive: {
    color: "#f5c842",
  },
  boostBtnCostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  boostBtnCostIcon: {
    width: 13,
    height: 13,
  },
  boostBtnCost: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6a4a20",
  },
  boostBtnCostRed: {
    color: "#c0392b",
  },
  boostModalBody: {
    gap: 8,
  },
  boostModalCostRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  boostModalCostIcon: {
    width: 20,
    height: 20,
  },
  boostModalEffect: {
    fontSize: 22,
    fontWeight: "800",
    color: "#3a1e00",
    textAlign: "center",
  },
  boostModalCost: {
    fontSize: 15,
    fontWeight: "700",
    color: "#7a5a30",
    textAlign: "center",
  },
  boostModalNote: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9a8060",
    textAlign: "center",
    fontStyle: "italic",
  },
  hpSection: {
    marginBottom: 12,
  },
  hpLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  hpTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  hpBoost: {
    fontSize: 15,
    fontWeight: "800",
    color: "#8a5cc7",
  },
  hpBarTrack: {
    height: 10,
    backgroundColor: "#e0d0b0",
    borderRadius: 5,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
  },
  hpBarFill: {
    height: "100%",
    borderRadius: 5,
  },
  divider: {
    height: 1.5,
    backgroundColor: "#d4b896",
    marginBottom: 12,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9a7040",
    letterSpacing: 1.2,
  },
  statPointsBadge: {
    marginLeft: "auto" as any,
    backgroundColor: "#3a1e00",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statPointsText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#f5c842",
    letterSpacing: 0.5,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  statLabel: {
    width: 56,
    fontSize: 13,
    fontWeight: "600",
    color: "#4a2e0a",
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#e8d5a8",
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#c8a96e",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#c0392b",
    borderRadius: 4,
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    minWidth: 44,
    justifyContent: "flex-end",
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3a1e00",
  },
  statBoost: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8a5cc7",
  },
  statPlusWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  statPlusBtn: {
    width: 28,
    height: 28,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  confirmCard: {
    position: "absolute",
    bottom: "30%" as any,
    left: 24,
    right: 24,
    backgroundColor: "#f5e9cc",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#c8a96e",
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 20,
  },
  confirmClose: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e8d5a8",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#3a1e00",
    marginBottom: 6,
    paddingRight: 32,
  },
  confirmSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7a5a30",
    marginBottom: 16,
  },
  confirmValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 20,
    backgroundColor: "#ede0c4",
    borderRadius: 12,
    paddingVertical: 12,
  },
  confirmValueCurrent: {
    fontSize: 28,
    fontWeight: "800",
    color: "#3a1e00",
  },
  confirmValueArrow: {
    fontSize: 22,
    fontWeight: "700",
    color: "#9a7040",
  },
  confirmValueNext: {
    fontSize: 28,
    fontWeight: "800",
    color: "#4a7c3f",
  },
  confirmBtnRow: {
    flexDirection: "row",
    gap: 12,
  },
  confirmRejectBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#e8d5a8",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    alignItems: "center",
  },
  confirmRejectText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7a5a30",
  },
  confirmAcceptBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#4a7c3f",
    borderWidth: 1.5,
    borderColor: "#2d5a24",
    alignItems: "center",
  },
  confirmAcceptText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  btnFlex: {
    flex: 1,
  },
  claimBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f0a030",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: "#c87820",
  },
  claimBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.4,
  },
  onMissionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#e8f5e9",
    borderRadius: 14,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: "#a5d6a7",
  },
  onMissionInner: {
    alignItems: "center",
    gap: 2,
  },
  onMissionText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#4a7c3f",
    letterSpacing: 0.8,
  },
  onMissionTimer: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2d5a24",
    letterSpacing: 1.2,
  },
  reviveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#7b3fa0",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: "#5a2d78",
  },
  reviveBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.4,
  },
  reviveCost: {
    fontSize: 13,
    fontWeight: "700",
    color: "#e8c8f8",
  },
  healBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#c0392b",
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 10,
    borderWidth: 2,
    borderColor: "#922b21",
  },
  healBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.4,
  },
  healCost: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f5c6c0",
  },
  btnDisabled: {
    opacity: 0.45,
  },
  defenderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1e2d1e",
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: "#4a7c3f",
  },
  defenderBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4a7c3f",
    letterSpacing: 0.5,
  },
  defenderBtnTextDim: {
    color: "#7f8c9a",
  },
  defenderActiveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1e2d1e",
    borderRadius: 14,
    paddingVertical: 10,
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: "#4a7c3f",
  },
  defenderActiveText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4a7c3f",
  },
  defenderTrophyText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7f8c9a",
  },

  // Defender banner strip (top of drawer)
  defenderBannerStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#4a7c3f",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  defenderBannerText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 1,
  },
  defenderTrophyPill: {
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  defenderTrophyPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },

  // PvP battle countdown box
  pvpBattleBtn: {
    backgroundColor: "#f0eaff",
    borderColor: "#8a5cc7",
  },

  // Defender-dimmed button overlay
  btnDefenderDim: {
    opacity: 0.5,
  },

  // History tab
  historyScroll: {
    maxHeight: 340,
    marginTop: 8,
  },
  historyEmpty: {
    fontSize: 13,
    color: "#9a7040",
    textAlign: "center",
    paddingVertical: 20,
  },
  historyItem: {
    backgroundColor: "#ede0c4",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#d4b896",
    padding: 12,
    marginBottom: 8,
    gap: 4,
  },
  historyItemWin: { borderColor: "#4a7c3f" },
  historyItemLose: { borderColor: "#c0392b" },
  historyItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyItemResult: { fontSize: 13, fontWeight: "800" },
  historyWinText: { color: "#2d5a24" },
  historyLoseText: { color: "#c0392b" },
  historyTrophyRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  historyTrophyDelta: { fontSize: 13, fontWeight: "800" },
  historyOpponent: { fontSize: 11, color: "#7a5a30", fontWeight: "600" },
  historyResRow: { flexDirection: "row", gap: 8, marginTop: 2 },
  historyResItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  historyResIcon: { width: 14, height: 14 },
  historyResAmt: { fontSize: 11, fontWeight: "700" },
  historyDate: { fontSize: 10, color: "#9a7040", marginTop: 2 },
});
