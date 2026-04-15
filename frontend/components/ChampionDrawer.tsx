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
  HeartPulse,
  Shield,
  Zap,
  History,
  Trophy,
  Clock,
  ChevronLeft,
  Plus,
  Lock,
} from "lucide-react-native";
import {
  Champion,
  DungeonRun,
  Resources,
  PvpBattle,
  PlayerFood,
} from "../types";
import { CLASS_META, RESOURCE_META } from "../constants/resources";
import CustomModal from "./CustomModal";
import api from "../lib/api";
import FoodInventoryDrawer from "./FoodInventoryDrawer";
import { FOOD_EMOJIS, describeEffect } from "./FoodCard";

const PLUS_BTN = require("../assets/plus-button-image.png");
import { useLanguage } from "../lib/i18n";

import PvpBattleButton from "./PvpBattleButton";
import EnterDungeonButton from "./EnterDungeonButton";
import CustomButton from "./CustomButton";
import CountdownTimer from "./CountdownTimer";
import { useCoinConfirm } from "../lib/coin-confirm-context";
import InGameCoinConfirmModal from "./InGameCoinConfirmModal";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/query/queryKeys";

const REVIVE_MILK_COST = 4;
const REVIVE_WOOL_COST = 4;
const COIN_REVIVE_COST = 15;
const HEAL_MILK_COST = 2;
const HEAL_EGG_COST = 2;
const COIN_HEAL_PER_20HP = 4;

const MILK_IMG = require("../assets/resource-images/milk.png");
const WOOL_IMG = require("../assets/resource-images/wool.png");
const EGG_IMG = require("../assets/resource-images/egg.png");
const HEALTH_POTION_IMG = require("../assets/icons/icon-health-potion.webp");
const SHIELD_IMG = require("../assets/icons/shield.webp");
const COIN_IMG = require("../assets/icons/icon-coin.webp");

type StatKey = "attack" | "defense" | "chance";

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
  onMissionExpire?: () => void;
  onSetDefender?: (champion: Champion) => void;
  defenderChampionId?: string | null;
  pvpUnlocked?: boolean;
  pvpTrophies?: number;
  pvpLeague?: string;
  isPvpBattle?: boolean;
  pvpBattleEndsAt?: string;
  onViewPvpResult?: () => void;
  /** True when ANY of the player's champions has a pending PvP battle (player-level lock) */
  playerHasPendingBattle?: boolean;
  coins?: number;
  onCoinRevive?: (champion: Champion) => void;
  onCoinHeal?: (champion: Champion) => void;
  onSkipMission?: (champion: Champion) => void;
  onSkipPvp?: () => void;
  /** Called after a food boost is applied; receives the updated champion from server */
  onFoodUsed?: (updatedChampion: Champion) => void;
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
      <View style={styles.statBarLine}>
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
  onMissionExpire,
  onSetDefender,
  defenderChampionId,
  pvpUnlocked,
  pvpTrophies,
  pvpLeague,
  isPvpBattle,
  pvpBattleEndsAt,
  onViewPvpResult,
  coins = 0,
  onCoinRevive,
  onCoinHeal,
  onSkipMission,
  onSkipPvp,
  onFoodUsed,
  playerHasPendingBattle,
}: Props) {
  const { t } = useLanguage();
  const { triggerCoinConfirm } = useCoinConfirm();
  const queryClient = useQueryClient();
  const translateY = useRef(new Animated.Value(0)).current;
  const contentScrollY = useRef(0);
  const [pendingStat, setPendingStat] = useState<StatKey | null>(null);
  const [foodInventoryOpen, setFoodInventoryOpen] = useState(false);
  const [playerFoods, setPlayerFoods] = useState<PlayerFood[]>([]);
  const [slotFoods, setSlotFoods] = useState<
    [PlayerFood | null, PlayerFood | null]
  >([null, null]);
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const [tick, setTick] = useState(0);
  const [removeSlot, setRemoveSlot] = useState<0 | 1 | null>(null);
  const [historyTab, setHistoryTab] = useState(false);
  const [history, setHistory] = useState<PvpBattle[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedBattle, setSelectedBattle] = useState<PvpBattle | null>(null);
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
      setFoodInventoryOpen(false);
      setPlayerFoods([]);
      // Reload active food slots from server so they persist across open/close
      loadActiveSlots(champion.id);
    }
  }, [champion?.id]);

  // Tick every second so food slot countdowns update live
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  function formatCountdown(expiresAtMs: number): string {
    const remaining = Math.max(
      0,
      Math.floor((expiresAtMs - Date.now()) / 1000),
    );
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    if (h > 0)
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function boostTypeLabel(type: string): string {
    if (type === "boost_hp") return "HP Boost";
    if (type === "boost_defense") return "DEF Boost";
    if (type === "boost_chance") return "CRIT Boost";
    if (type === "boost_production") return "Production Boost";
    return "Boost";
  }

  function makeSlotFood(b: any, recipeName: string): PlayerFood {
    return {
      id: b.id,
      recipe_id: b.recipe_id ?? b.id,
      recipe: {
        id: b.recipe_id ?? b.id,
        name: recipeName,
        target: b.recipe_target ?? b.target,
        effect_type: b.recipe_effect_type ?? b.boost_type,
        effect_value: b.recipe_effect_value ?? b.boost_value,
        effect_duration_minutes: b.recipe_duration ?? null,
        cook_duration_minutes: b.recipe_cook_duration ?? 0,
        ingredients: b.recipe_ingredients ?? {},
        tier: (b.recipe_tier ?? 1) as 1 | 2 | 3,
      },
      status: "ready",
      cooking_started_at: "",
      cooking_ready_at: "",
      cooking_ready_at_ms: 0,
      cooking_started_at_ms: 0,
      _fetched_at_ms: Date.now(),
      used_at: null,
      expires_at_ms: b.expires_at_ms ? Number(b.expires_at_ms) : undefined,
    };
  }

  async function loadActiveSlots(championId: string) {
    try {
      const res = await api.get(`/api/kitchen/boosts?entity_id=${championId}`);
      const boosts: any[] = res.data;
      const slots: [PlayerFood | null, PlayerFood | null] = [null, null];
      let slotIdx = 0;
      for (const b of boosts) {
        if (slotIdx >= 2) break;
        // Fallback name when recipe_id was not stored (legacy rows)
        const recipeName = b.recipe_name ?? boostTypeLabel(b.boost_type);
        slots[slotIdx as 0 | 1] = makeSlotFood(b, recipeName);
        slotIdx++;
      }
      setSlotFoods(slots);
    } catch {
      setSlotFoods([null, null]);
    }
  }

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

  async function openFoodInventory(slot: 0 | 1) {
    setActiveSlot(slot);
    try {
      const res = await api.get("/api/kitchen/inventory");
      setPlayerFoods(res.data);
    } catch {
      setPlayerFoods([]);
    }
    setFoodInventoryOpen(true);
  }

  async function handleUseFood(food: PlayerFood) {
    try {
      const res = await api.post(`/api/kitchen/use/${food.id}`, {
        entity_id: champion?.id,
      });
      // Fill the active slot with server-accurate expires_at_ms so countdown is correct immediately
      const expiresAtMs: number | undefined = res.data.boost?.expires_at_ms
        ? Number(res.data.boost.expires_at_ms)
        : undefined;
      setSlotFoods((prev) => {
        const next: [PlayerFood | null, PlayerFood | null] = [...prev] as any;
        next[activeSlot] = { ...food, expires_at_ms: expiresAtMs };
        return next;
      });
      setFoodInventoryOpen(false);
      // If backend returned an updated champion (fighter food), propagate upward
      if (res.data.champion && onFoodUsed) {
        onFoodUsed(res.data.champion);
      }
      // Refresh inventory in background
      api
        .get("/api/kitchen/inventory")
        .then((r) => setPlayerFoods(r.data))
        .catch(() => {});
      queryClient.invalidateQueries({ queryKey: queryKeys.quests() });
    } catch (err: any) {
      alert(err.response?.data?.error ?? "Could not use food");
    }
  }

  async function handleRemoveFood(slot: 0 | 1) {
    const food = slotFoods[slot];
    if (!food) return;
    try {
      const res = await api.delete(`/api/kitchen/boosts/${food.id}`);
      setSlotFoods((prev) => {
        const next: [PlayerFood | null, PlayerFood | null] = [...prev] as any;
        next[slot] = null;
        return next;
      });
      setRemoveSlot(null);
      if (res.data.champion && onFoodUsed) {
        onFoodUsed(res.data.champion);
      }
    } catch (err: any) {
      alert(err.response?.data?.error ?? "Could not remove food");
    }
  }

  return (
    <Modal
      visible={!!champion}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Wrapper needed for absolute-positioned food panel */}
      <View style={styles.modalRoot}>
        {/* Transparent backdrop — closes food panel first, then drawer */}
        <TouchableWithoutFeedback
          onPress={
            foodInventoryOpen ? () => setFoodInventoryOpen(false) : onClose
          }
        >
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
                {historyTab ? t("historyBack") : t("history")}
              </Text>
            </TouchableOpacity>
            <View style={styles.bannerLeftWrapper}>
              {isDefenderChamp && (
                <View style={styles.defenderBannerStrip}>
                  <Shield size={14} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.defenderBannerText}>
                    {t("defenderBanner")}
                  </Text>
                </View>
              )}
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeLabel}>LV</Text>
                <Text style={styles.levelBadgeNum}>{champion.level}</Text>
              </View>
            </View>
          </View>

          {/* XP progress bar — fixed, always visible */}
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
                    <TouchableOpacity
                      key={battle.id}
                      activeOpacity={0.75}
                      onPress={() => setSelectedBattle(battle)}
                      style={[
                        styles.historyItem,
                        won ? styles.historyItemWin : styles.historyItemLose,
                      ]}
                    >
                      <View style={styles.historyItemTop}>
                        <Text
                          style={[
                            styles.historyItemResult,
                            won
                              ? styles.historyWinText
                              : styles.historyLoseText,
                          ]}
                        >
                          {won
                            ? "⚔️ " + t("pvpVictory")
                            : "💀 " + t("pvpDefeat")}
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
                            const amt =
                              (battle as any)[`transferred_${r}`] ?? 0;
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
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          )}

          {!historyTab && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              style={{ maxHeight: SCREEN_HEIGHT * 0.65 }}
              contentContainerStyle={{ paddingBottom: 24 }}
              onScroll={(e) => {
                contentScrollY.current = e.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              {/* Champion name */}
              <Text style={styles.champName}>{champion.name}</Text>

              {/* Champion image + food slots (overflow) + stats */}
              <View style={styles.imageAndBoostRow}>
                {/* Wrapper allows absolute children to overflow */}
                <View style={styles.imageWrapper}>
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
                      <View
                        style={[styles.boostBadge, styles.boostBadgeTopLeft]}
                      >
                        <Image
                          source={require("../assets/icons/heart.webp")}
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
                          source={require("../assets/icons/shield.webp")}
                          style={styles.boostBtnCostIcon}
                          resizeMode="contain"
                        />
                      </View>
                    )}
                    {(champion.boost_chance ?? 0) > 0 && (
                      <View
                        style={[styles.boostBadge, styles.boostBadgeTopRight]}
                      >
                        <Image
                          source={require("../assets/icons/lightning.webp")}
                          style={styles.boostBtnCostIcon}
                          resizeMode="contain"
                        />
                      </View>
                    )}
                  </View>
                </View>

                {/* Right col — basic stats */}
                <View style={styles.statSideCol}>
                  <View style={styles.sectionLabelRow}>
                    <Swords size={12} color="#9a7040" strokeWidth={2} />
                    <Text style={styles.sectionLabel}>
                      {t("baseStatistics")}
                    </Text>
                    {champion.stat_points > 0 && (
                      <View style={styles.statPointsBadge}>
                        <Text style={styles.statPointsText}>
                          +{champion.stat_points}
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
                </View>
              </View>

              {/* HP Bar */}
              {(() => {
                const boostHp = champion.boost_hp ?? 0;
                const effectiveMaxHp = champion.max_hp + boostHp;
                const hpPct =
                  effectiveMaxHp > 0 ? champion.current_hp / effectiveMaxHp : 0;
                const hpColor =
                  hpPct > 0.6 ? "#2d8a3e" : hpPct > 0.3 ? "#d4a017" : "#c0392b";
                return (
                  <View
                    style={[
                      styles.hpSection,
                      {
                        backgroundColor: `${hpColor}18`,
                        borderRadius: 12,
                        padding: 10,
                        borderWidth: 1.5,
                        borderColor: `${hpColor}55`,
                      },
                    ]}
                  >
                    <View style={styles.hpLabelRow}>
                      <HeartPulse size={16} color={hpColor} strokeWidth={2.5} />
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

              {/* Food slots row — below HP bar */}
              {(() => {
                const foodLocked = !!(isOnMission || isPvpBattle);
                return (
                  <View style={styles.foodSlotsRow}>
                    {([0, 1] as const).map((slot) => {
                      const filled = slotFoods[slot];
                      const emoji = filled
                        ? (FOOD_EMOJIS[filled.recipe.name] ?? "🍴")
                        : null;
                      const countdown =
                        filled &&
                        filled.expires_at_ms &&
                        filled.recipe.effect_duration_minutes != null
                          ? formatCountdown(filled.expires_at_ms)
                          : null;
                      void tick;
                      return (
                        <TouchableOpacity
                          key={slot}
                          style={[
                            styles.foodSlotBtn,
                            filled && styles.foodSlotBtnFilled,
                            foodLocked && styles.foodSlotBtnLocked,
                          ]}
                          activeOpacity={foodLocked ? 1 : 0.75}
                          disabled={foodLocked}
                          onPress={() =>
                            filled ? setRemoveSlot(slot) : openFoodInventory(slot)
                          }
                        >
                          <View
                            style={[
                              styles.foodSlotIconBg,
                              filled && styles.foodSlotIconBgFilled,
                            ]}
                          >
                            {foodLocked && !filled ? (
                              <Lock size={14} color="#b8a070" strokeWidth={2.5} />
                            ) : filled ? (
                              <Text style={styles.foodSlotEmoji}>{emoji}</Text>
                            ) : (
                              <Plus size={16} color="#9a7040" strokeWidth={2.5} />
                            )}
                          </View>
                          <View style={styles.foodSlotInfo}>
                            {filled ? (
                              <>
                                <Text style={styles.foodSlotName} numberOfLines={1}>
                                  {filled.recipe.name}
                                </Text>
                                {countdown ? (
                                  <Text style={styles.foodSlotCountdown}>
                                    {countdown}
                                  </Text>
                                ) : (
                                  <Text style={styles.foodSlotOneShotLabel}>
                                    one-shot
                                  </Text>
                                )}
                              </>
                            ) : (
                              <Text style={[styles.addFoodText, foodLocked && styles.addFoodTextLocked]}>
                                {foodLocked
                                  ? (isOnMission ? t("foodLockedOnMission") : t("foodLockedInBattle"))
                                  : t("addFood")}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })()}

              {/* Divider */}
              <View style={styles.divider} />

              {/* Stat upgrade confirmation modal */}
              {pendingStat && (
                <Modal
                  visible
                  transparent
                  animationType="fade"
                  onRequestClose={() => setPendingStat(null)}
                >
                  <TouchableWithoutFeedback
                    onPress={() => setPendingStat(null)}
                  >
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
                // Dead champion — show both revive options
                <View style={styles.btnRow}>
                  <CustomButton
                    btnImage={HEALTH_POTION_IMG}
                    text={t("revive")}
                    subContent={
                      <View style={styles.costRow}>
                        <Image
                          source={MILK_IMG}
                          style={styles.costIcon}
                          resizeMode="contain"
                        />
                        <Text style={styles.costText}>×{REVIVE_MILK_COST}</Text>
                        <Image
                          source={WOOL_IMG}
                          style={styles.costIcon}
                          resizeMode="contain"
                        />
                        <Text style={styles.costText}>×{REVIVE_WOOL_COST}</Text>
                      </View>
                    }
                    onClick={() => onRevive?.(champion)}
                    bgColor="#7a3a9a"
                    borderColor="#5a2d78"
                    disabled={
                      (resources?.milk ?? 0) < REVIVE_MILK_COST ||
                      (resources?.wool ?? 0) < REVIVE_WOOL_COST
                    }
                    style={styles.btnFlex}
                  />
                  <CustomButton
                    btnImage={HEALTH_POTION_IMG}
                    text={t("coinRevive")}
                    subContent={
                      <View style={styles.costRow}>
                        <Image
                          source={COIN_IMG}
                          style={styles.costCoinImg}
                          resizeMode="contain"
                        />
                        <Text style={styles.costText}>×{COIN_REVIVE_COST}</Text>
                      </View>
                    }
                    onClick={() =>
                      triggerCoinConfirm({
                        transactionCost: COIN_REVIVE_COST,
                        transactionTitle: t("coinRevive"),
                        transactionDesc: `${champion.name} anında canlandırılsın mı?`,
                        onConfirm: () => onCoinRevive?.(champion),
                      })
                    }
                    bgColor="#b8860b"
                    borderColor="#8b6508"
                    disabled={coins < COIN_REVIVE_COST}
                    style={styles.btnFlex}
                  />
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
                      // Battle in progress — countdown + skip button
                      <View style={[styles.btnRow, { marginTop: 20 }]}>
                        <View style={[styles.onMissionBtn, styles.btnFlex, styles.pvpBattleBtn]}>
                          <Swords size={16} color="#8a5cc7" strokeWidth={2} />
                          <View style={styles.onMissionInner}>
                            <Text style={[styles.onMissionText, { color: "#8a5cc7" }]}>
                              Savaşta!
                            </Text>
                            {pvpBattleEndsAt && (
                              <CountdownTimer
                                endsAt={pvpBattleEndsAt}
                                style={[styles.onMissionTimer, { color: "#6a3ca7" }]}
                                onExpire={() => setPvpBattleExpired(true)}
                              />
                            )}
                          </View>
                        </View>
                        {pvpBattleEndsAt &&
                          (() => {
                            const secsLeft = Math.max(0, (new Date(pvpBattleEndsAt).getTime() - Date.now()) / 1000);
                            const skipCost = Math.max(1, Math.ceil(secsLeft / 60));
                            const canSkip = coins >= skipCost;
                            return (
                              <TouchableOpacity
                                style={[styles.missionSkipBtn, styles.btnFlex, !canSkip && styles.btnDisabled]}
                                onPress={() =>
                                  canSkip &&
                                  triggerCoinConfirm({
                                    transactionCost: skipCost,
                                    transactionTitle: t("skipCooldown"),
                                    transactionDesc: `${champion.name} savaşı anında tamamlansın mı?`,
                                    onConfirm: () => onSkipPvp?.(),
                                  })
                                }
                                activeOpacity={0.8}
                              >
                                <Text style={styles.missionSkipLabel}>{t("skipBattleNow")}</Text>
                                <View style={styles.missionSkipRow}>
                                  <Image source={COIN_IMG} style={styles.skipCoinImg} resizeMode="contain" />
                                  <Text style={styles.missionSkipCost}>×{skipCost}</Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })()}
                      </View>
                    )
                  ) : (
                    <>
                      {/* === Normal button row === */}
                      <View style={styles.btnRow}>
                        {!isOnMission && !claimableRun && (
                          playerHasPendingBattle && !isPvpBattle ? (
                            <View style={[styles.btnFlex, styles.pvpLockedBtn]}>
                              <Swords size={14} color="#b8a070" strokeWidth={2} />
                              <Text style={styles.pvpLockedText}>{t("pvpLockedWaiting")}</Text>
                            </View>
                          ) : (
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
                          )
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
                          <>
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
                            {activeRunEndsAt &&
                              (() => {
                                const secsLeft = Math.max(0, (new Date(activeRunEndsAt).getTime() - Date.now()) / 1000);
                                const skipCost = Math.max(1, Math.ceil(secsLeft / 60));
                                const canSkip = coins >= skipCost;
                                return (
                                  <TouchableOpacity
                                    style={[styles.missionSkipBtn, styles.btnFlex, !canSkip && styles.btnDisabled]}
                                    onPress={() =>
                                      canSkip &&
                                      triggerCoinConfirm({
                                        transactionCost: skipCost,
                                        transactionTitle: t("skipCooldown"),
                                        transactionDesc: `${champion.name} görevi anında tamamlansın mı?`,
                                        onConfirm: () => onSkipMission?.(champion),
                                      })
                                    }
                                    activeOpacity={0.8}
                                  >
                                    <Text style={styles.missionSkipLabel}>{t("skipMissionNow")}</Text>
                                    <View style={styles.missionSkipRow}>
                                      <Image source={COIN_IMG} style={styles.skipCoinImg} resizeMode="contain" />
                                      <Text style={styles.missionSkipCost}>×{skipCost}</Text>
                                    </View>
                                  </TouchableOpacity>
                                );
                              })()}
                          </>
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

                      {/* Heal buttons — only when injured and not on mission */}
                      {!isOnMission &&
                        champion.current_hp <
                          champion.max_hp + (champion.boost_hp ?? 0) &&
                        (() => {
                          const effectiveMax =
                            champion.max_hp + (champion.boost_hp ?? 0);
                          const missingHp = effectiveMax - champion.current_hp;
                          const canHeal =
                            (resources?.milk ?? 0) >= HEAL_MILK_COST &&
                            (resources?.egg ?? 0) >= HEAL_EGG_COST;
                          const coinHealCost =
                            Math.ceil(missingHp / 20) * COIN_HEAL_PER_20HP;
                          return (
                            <View style={[styles.btnRow, { marginTop: 0 }]}>
                              <CustomButton
                                btnImage={HEALTH_POTION_IMG}
                                text="+20 HP"
                                subContent={
                                  <View style={styles.costRow}>
                                    <Image
                                      source={MILK_IMG}
                                      style={styles.costIcon}
                                      resizeMode="contain"
                                    />
                                    <Text style={styles.costText}>
                                      ×{HEAL_MILK_COST}
                                    </Text>
                                    <Image
                                      source={EGG_IMG}
                                      style={styles.costIcon}
                                      resizeMode="contain"
                                    />
                                    <Text style={styles.costText}>
                                      ×{HEAL_EGG_COST}
                                    </Text>
                                  </View>
                                }
                                onClick={() => onHeal?.(champion)}
                                bgColor="#c0392b"
                                borderColor="#922b21"
                                disabled={!canHeal}
                                style={styles.btnFlex}
                              />
                              <CustomButton
                                btnImage={HEALTH_POTION_IMG}
                                text={t("heal")}
                                subContent={
                                  <View style={styles.costRow}>
                                    <Image
                                      source={COIN_IMG}
                                      style={styles.costCoinImg}
                                      resizeMode="contain"
                                    />
                                    <Text style={styles.costText}>
                                      ×{coinHealCost}
                                    </Text>
                                    <Text style={styles.costTextDim}>
                                      +{missingHp} HP
                                    </Text>
                                  </View>
                                }
                                onClick={() =>
                                  triggerCoinConfirm({
                                    transactionCost: coinHealCost,
                                    transactionTitle: t("heal"),
                                    transactionDesc: `${champion.name} tam olarak iyileştirilsin mi?`,
                                    onConfirm: () => onCoinHeal?.(champion),
                                  })
                                }
                                bgColor="#b8860b"
                                borderColor="#8b6508"
                                disabled={coins < coinHealCost}
                                style={styles.btnFlex}
                              />
                            </View>
                          );
                        })()}
                    </>
                  )}

                  {/* Defender button */}
                  {onSetDefender &&
                    !isDefenderChamp &&
                    (() => {
                      const pvpLocked = !pvpUnlocked;
                      const isDisabled =
                        pvpLocked ||
                        champion.last_defender ||
                        champion.is_deployed ||
                        champion.current_hp <= 0;
                      const label = pvpLocked
                        ? t("pvpLevelRequired")
                        : champion.last_defender
                          ? t("defenderCooldown")
                          : t("setDefender");
                      return (
                        <CustomButton
                          btnImage={SHIELD_IMG}
                          text={label}
                          onClick={() => !isDisabled && onSetDefender(champion)}
                          bgColor={isDisabled ? "#2e3e2e" : "#1e2d1e"}
                          borderColor={isDisabled ? "#3a4e3a" : "#4a7c3f"}
                          disabled={isDisabled}
                          style={{ marginTop: 8 }}
                        />
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
          <InGameCoinConfirmModal coins={coins} />
        </Animated.View>

        {/* Battle log modal */}
        <CustomModal
          visible={selectedBattle !== null}
          onClose={() => setSelectedBattle(null)}
          onConfirm={() => setSelectedBattle(null)}
          title={
            selectedBattle
              ? selectedBattle.winner_id === selectedBattle.attacker_id
                ? "⚔️ Zafer!"
                : "💀 Yenilgi"
              : ""
          }
          confirmText="Kapat"
          hideCancel
        >
          {selectedBattle &&
            (() => {
              const won =
                selectedBattle.winner_id === selectedBattle.attacker_id;
              const tDelta = selectedBattle.attacker_trophies_delta;
              return (
                <>
                  {/* Summary header */}
                  <View style={styles.logSummary}>
                    <Text style={styles.logSummaryVs}>
                      <Text style={styles.logSummaryAtk}>
                        {selectedBattle.attacker_name}
                      </Text>
                      {"  vs  "}
                      <Text style={styles.logSummaryDef}>
                        {selectedBattle.defender_name}
                      </Text>
                    </Text>
                    <View style={styles.logSummaryRow}>
                      <Trophy
                        size={11}
                        color={tDelta >= 0 ? "#d4a017" : "#c0392b"}
                        strokeWidth={2}
                      />
                      <Text
                        style={[
                          styles.logSummaryVal,
                          { color: tDelta >= 0 ? "#4a7c3f" : "#c0392b" },
                        ]}
                      >
                        {tDelta >= 0 ? "+" : ""}
                        {tDelta} kupa
                      </Text>
                      {(["strawberry", "pinecone", "blueberry"] as const).map(
                        (r) => {
                          const amt =
                            (selectedBattle as any)[`transferred_${r}`] ?? 0;
                          if (amt === 0) return null;
                          return (
                            <View key={r} style={styles.logSummaryRes}>
                              <Image
                                source={RESOURCE_META[r].image}
                                style={styles.logSummaryResIcon}
                                resizeMode="contain"
                              />
                              <Text
                                style={[
                                  styles.logSummaryVal,
                                  { color: won ? "#4a7c3f" : "#c0392b" },
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
                  </View>

                  {/* Log entries */}
                  <ScrollView
                    style={styles.logScroll}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    {(selectedBattle.combat_log?.length ?? 0) === 0 ? (
                      <Text style={styles.historyEmpty}>
                        Savaş günlüğü bulunamadı.
                      </Text>
                    ) : (
                      selectedBattle.combat_log.map((entry: any, i: number) => {
                        const isAtk = entry.actor === "attacker";
                        const newRound =
                          i === 0 ||
                          selectedBattle.combat_log[i - 1]?.round !==
                            entry.round;
                        return (
                          <View key={i}>
                            {newRound && (
                              <Text style={styles.logRound}>
                                — Tur {entry.round + 1} —
                              </Text>
                            )}
                            <View style={styles.logRow}>
                              <Text
                                style={[
                                  styles.logActor,
                                  isAtk ? styles.logChamp : styles.logEnemy,
                                ]}
                              >
                                {isAtk
                                  ? `⚔️ ${selectedBattle.attacker_name}`
                                  : `🛡️ ${selectedBattle.defender_name}`}
                              </Text>
                              <Text style={styles.logDmg}>
                                {entry.damage === 0
                                  ? "BLOK"
                                  : `−${entry.damage}`}
                                {entry.isCrit ? " 💥" : ""}
                              </Text>
                              <Text style={styles.logHp}>
                                {isAtk
                                  ? entry.defenderHpAfter
                                  : entry.attackerHpAfter}{" "}
                                HP
                              </Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </ScrollView>
                </>
              );
            })()}
        </CustomModal>

        {/* Food inventory panel — inside this Modal, no second Modal needed */}
        <FoodInventoryDrawer
          visible={foodInventoryOpen}
          inventory={playerFoods}
          onClose={() => setFoodInventoryOpen(false)}
          onUseFood={handleUseFood}
          context="fighter"
        />

        {/* Remove food popup */}
        {removeSlot !== null &&
          slotFoods[removeSlot] &&
          (() => {
            const food = slotFoods[removeSlot]!;
            const emoji = FOOD_EMOJIS[food.recipe.name] ?? "🍴";
            const hasCountdown =
              food.expires_at_ms && food.recipe.effect_duration_minutes != null;
            void tick;
            return (
              <View style={styles.removeFoodOverlay}>
                <View style={styles.removeFoodCard}>
                  <Text style={styles.removeFoodEmoji}>{emoji}</Text>
                  <Text style={styles.removeFoodName}>{food.recipe.name}</Text>
                  <Text style={styles.removeFoodEffect}>
                    {describeEffect(food.recipe)}
                  </Text>
                  {hasCountdown && (
                    <View style={styles.removeFoodTimerRow}>
                      <Text style={styles.removeFoodTimerLabel}>Remaining</Text>
                      <Text style={styles.removeFoodTimer}>
                        {formatCountdown(food.expires_at_ms!)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.removeFoodBtnRow}>
                    <TouchableOpacity
                      style={styles.removeFoodKeepBtn}
                      activeOpacity={0.75}
                      onPress={() => setRemoveSlot(null)}
                    >
                      <Text style={styles.removeFoodKeepText}>Keep</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeFoodRemoveBtn}
                      activeOpacity={0.75}
                      onPress={() => handleRemoveFood(removeSlot)}
                    >
                      <Text style={styles.removeFoodRemoveText}>
                        Discard Food
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
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
  imageWrapper: {
    overflow: "visible",
  },
  imageFrame: {
    width: 140,
    height: 140,
    backgroundColor: "#ede0c4",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#c8a96e",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#b8893a",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    overflow: "hidden",
  },
  champImage: {
    width: 120,
    height: 120,
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
    top: 1,
    left: 1,
  },
  boostBadgeBottomLeft: {
    bottom: 1,
    left: 1,
  },
  boostBadgeTopRight: {
    top: 1,
    right: 1,
  },
  boostBtnCostIcon: {
    width: 13,
    height: 13,
  },
  foodSlotsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  foodSlotBtn: {
    flex: 1,
    height: 58,
    backgroundColor: "#ede0c4",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 10,
  },
  foodSlotBtnFilled: {
    backgroundColor: "#eef5eb",
    borderStyle: "solid",
    borderColor: "#4a7c3f",
  },
  foodSlotBtnLocked: {
    opacity: 0.5,
    borderStyle: "solid",
    borderColor: "#b8a070",
  },
  foodSlotIconBg: {
    width: 38,
    height: 38,
    backgroundColor: "#f5e9cc",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  foodSlotIconBgFilled: {
    backgroundColor: "#daefd4",
  },
  foodSlotEmoji: {
    fontSize: 24,
  },
  foodSlotInfo: {
    flex: 1,
    gap: 3,
  },
  foodSlotName: {
    fontSize: 11,
    fontWeight: "800",
    color: "#3a1e00",
  },
  foodSlotCountdown: {
    fontSize: 9,
    fontWeight: "700",
    color: "#4a7c3f",
    letterSpacing: 0.2,
  },
  foodSlotOneShotLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#9a7040",
    fontStyle: "italic",
  },
  addFoodText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9a7040",
  },
  addFoodTextLocked: {
    color: "#b8a070",
    fontStyle: "italic",
  },
  // ── Remove food popup ──
  removeFoodOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  removeFoodCard: {
    backgroundColor: "#f5edd8",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#c8a96e",
    padding: 22,
    width: "80%",
    alignItems: "center",
    gap: 10,
  },
  removeFoodEmoji: { fontSize: 44 },
  removeFoodName: {
    fontSize: 15,
    fontWeight: "900",
    color: "#3a1e00",
    textAlign: "center",
  },
  removeFoodEffect: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7a5a30",
    textAlign: "center",
    backgroundColor: "#ede0c4",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  removeFoodTimerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  removeFoodTimerLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9a7040",
  },
  removeFoodTimer: {
    fontSize: 15,
    fontWeight: "900",
    color: "#4a7c3f",
    letterSpacing: 1,
  },
  removeFoodBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  removeFoodKeepBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ede0c4",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    paddingVertical: 10,
  },
  removeFoodKeepText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7a5030",
  },
  removeFoodRemoveBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#c0392b",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#922b21",
    paddingVertical: 10,
  },
  removeFoodRemoveText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#fff",
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
    flexDirection: "column",
    marginBottom: 8,
    gap: 3,
  },
  statBarLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#9a7040",
    letterSpacing: 0.8,
    textTransform: "uppercase",
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
    marginTop: 4,
    paddingBottom: 12,
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
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  costCoinImg: {
    width: 14,
    height: 14,
  },
  missionSkipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  costText: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
  },
  costTextDim: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.55)",
  },
  missionSkipBtn: {
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
  missionSkipLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#c8f5c8",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  missionSkipText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fff",
  },
  skipCoinImg: {
    width: 20,
    height: 20,
  },
  missionSkipCost: {
    fontSize: 16,
    fontWeight: "900",
    color: "#fff",
  },
  costIcon: {
    width: 16,
    height: 16,
  },
  btnDisabled: {
    opacity: 0.45,
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
  pvpLockedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 71,
    backgroundColor: "rgba(58,30,0,0.06)",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(184,160,112,0.4)",
    borderStyle: "dashed",
  },
  pvpLockedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b8a070",
    fontStyle: "italic",
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
  logSummary: {
    backgroundColor: "#ede0c4",
    borderRadius: 10,
    padding: 10,
    gap: 6,
    marginBottom: 8,
  },
  logSummaryVs: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3a2a10",
    textAlign: "center",
  },
  logSummaryAtk: { color: "#2d5a24", fontWeight: "800" },
  logSummaryDef: { color: "#c0392b", fontWeight: "800" },
  logSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  logSummaryVal: { fontSize: 12, fontWeight: "800" },
  logSummaryRes: { flexDirection: "row", alignItems: "center", gap: 3 },
  logSummaryResIcon: { width: 16, height: 16 },
  logScroll: { maxHeight: 220, marginTop: 10, width: "100%" },
  logRound: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9a7040",
    textAlign: "center",
    marginVertical: 4,
    letterSpacing: 1,
  },
  logRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: "#f0e4c8",
    borderRadius: 6,
    marginBottom: 2,
  },
  logActor: { fontSize: 12, fontWeight: "700", flex: 1 },
  logChamp: { color: "#2d5a24" },
  logEnemy: { color: "#c0392b" },
  logDmg: {
    fontSize: 12,
    fontWeight: "800",
    color: "#3a2a10",
    minWidth: 50,
    textAlign: "center",
  },
  logHp: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7a5a30",
    minWidth: 45,
    textAlign: "right",
  },

  // ── Mini stat cards (left col next to image) ──
  statSideCol: {
    flex: 1,
    justifyContent: "center",
  },
  miniStatCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ede0c4",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    paddingVertical: 6,
    marginBottom: 6,
  },
  miniStatValue: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  miniStatLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#9a7040",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  // ── Stat upgrade row (replaces old StatRow bars) ──
  statUpgradeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  statUpgradeCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#ede0c4",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    paddingVertical: 8,
    gap: 2,
  },
  statUpgradeCardActive: {
    borderColor: "#f5c842",
    backgroundColor: "#3a1e00",
  },
  statUpgradeValue: {
    fontSize: 18,
    fontWeight: "900",
  },
  statUpgradeBoost: {
    fontSize: 13,
    fontWeight: "800",
    color: "#8a5cc7",
  },
  statUpgradeLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#9a7040",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statUpgradeHint: {
    fontSize: 9,
    color: "#f5c842",
    fontWeight: "900",
  },

  // ── Defender pill in header ──
  defenderPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2a4a2a",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#4a9a4a",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  defenderPillDisabled: {
    backgroundColor: "#2a3a2a",
    borderColor: "#3a5a3a",
  },
  defenderPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#a8e0a0",
    letterSpacing: 0.5,
  },
  defenderPillTextDisabled: {
    color: "#5a7a5a",
  },
});
