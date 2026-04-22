import { useRef, useEffect, useState, useCallback } from "react";
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  PanResponder,
} from "react-native";
import { Text } from "./StyledText";
import { X, Sprout, Package, ArrowUp, Timer, Plus } from "lucide-react-native";
import { Farmer, Resources, PlayerFood } from "../types";
import { RESOURCE_META } from "../constants/resources";
const COIN_IMG = require("../assets/icons/icon-coin.webp");
import { useLanguage, TranslationKeys } from "../lib/i18n";
import CustomButton from "./CustomButton";
import CustomModal from "./CustomModal";
import { useCoinConfirm } from "../lib/coin-confirm-context";
import InGameCoinConfirmModal from "./InGameCoinConfirmModal";
import FoodInventoryDrawer from "./FoodInventoryDrawer";
import { FOOD_EMOJIS, describeEffect } from "./FoodCard";
import api from "../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/query/queryKeys";
import { useRouter } from "expo-router";

// Cross-resource upgrade costs
const UPGRADE_RESOURCES: Record<string, [string, string]> = {
  strawberry: ["strawberry", "pinecone"],
  pinecone: ["pinecone", "blueberry"],
  blueberry: ["blueberry", "strawberry"],
};

function getUpgradeCost(level: number) {
  return level * 2;
}

function getMaxCapacity(level: number) {
  return 4 + level;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

type Props = {
  farmer: Farmer | null;
  resources?: Resources;
  coins?: number;
  onClose: () => void;
  onCollect: (farmer: Farmer) => void;
  onUpgrade: (farmer: Farmer) => void;
  onFillStorage?: (farmer: Farmer) => void;
  onFarmerUpdated?: (farmer: Farmer) => void;
};

const DISMISS_THRESHOLD = 100;

export default function FarmerDrawer({
  farmer,
  resources,
  coins = 0,
  onClose,
  onCollect,
  onUpgrade,
  onFillStorage,
  onFarmerUpdated,
}: Props) {
  const { t } = useLanguage();
  const { triggerCoinConfirm } = useCoinConfirm();
  const queryClient = useQueryClient();
  const router = useRouter();
  const translateY = useRef(new Animated.Value(0)).current;

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Food slots state
  const [foodInventoryOpen, setFoodInventoryOpen] = useState(false);
  const [playerFoods, setPlayerFoods] = useState<PlayerFood[]>([]);
  const [slotFoods, setSlotFoods] = useState<[PlayerFood | null, PlayerFood | null]>([null, null]);
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const [tick, setTick] = useState(0);
  const [removeSlot, setRemoveSlot] = useState<0 | 1 | null>(null);

  // Live pending + countdown managed locally
  const [livePending, setLivePending] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerRowWidth, setTimerRowWidth] = useState(0);
  const livePendingRef = useRef(0);

  // Interpolate farmer snapshot forward to "now" using _fetched_at_ms.
  function interpolate(f: Farmer) {
    if (!f) return { timeLeft: 0, pending: 0 };
    const elapsedSec = f._fetched_at_ms
      ? (Date.now() - f._fetched_at_ms) / 1000
      : 0;
    const cycleSec = (f.interval_minutes ?? 0) * 60;
    const maxCap = getMaxCapacity(f.level);
    const rawTimeLeft = Math.max(0, (f.next_ready_in_seconds ?? 0) - elapsedSec);
    const burned = f.next_ready_in_seconds - rawTimeLeft; // seconds consumed since fetch
    const extraCycles =
      cycleSec > 0
        ? Math.max(0, Math.floor((cycleSec - f.next_ready_in_seconds + burned) / cycleSec))
        : 0;
    const pending = Math.min((f.pending ?? 0) + extraCycles, maxCap);
    const timeLeft =
      rawTimeLeft <= 0 ? cycleSec - (-rawTimeLeft % cycleSec) : rawTimeLeft;
    return { timeLeft: Math.round(timeLeft), pending };
  }

  // Slide animation reset + food slot reload — only when the drawer opens (new farmer)
  useEffect(() => {
    if (farmer) {
      translateY.setValue(0);
      setFoodInventoryOpen(false);
      setPlayerFoods([]);
      loadActiveSlots(farmer.id);
    }
  }, [farmer?.id]);

  function boostTypeLabel(type: string): string {
    if (type === 'boost_production') return 'Production Boost';
    if (type === 'boost_capacity')   return 'Capacity Boost';
    return 'Boost';
  }

  async function loadActiveSlots(farmerId: string) {
    try {
      const res = await api.get(`/api/kitchen/boosts?entity_id=${farmerId}`);
      const boosts: any[] = res.data;
      const slots: [PlayerFood | null, PlayerFood | null] = [null, null];
      let slotIdx = 0;
      for (const b of boosts) {
        if (slotIdx >= 2) break;
        const recipeName = b.recipe_name ?? boostTypeLabel(b.boost_type);
        slots[slotIdx as 0 | 1] = {
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
          status: 'ready',
          cooking_started_at: '',
          cooking_ready_at: '',
          cooking_ready_at_ms: 0,
          cooking_started_at_ms: 0,
          _fetched_at_ms: Date.now(),
          used_at: null,
          expires_at_ms: b.expires_at_ms ? Number(b.expires_at_ms) : undefined,
        } as PlayerFood;
        slotIdx++;
      }
      setSlotFoods(slots);
    } catch {
      setSlotFoods([null, null]);
    }
  }

  // Re-interpolate whenever farmer data changes (open or after fill/collect)
  useEffect(() => {
    if (farmer) {
      const { timeLeft, pending } = interpolate(farmer);
      livePendingRef.current = pending;
      setLivePending(pending);
      setTimeLeft(timeLeft);
    }
  }, [farmer?.id, farmer?.last_collected_at]);

  // Keep ref in sync so interval can read latest value without recreating
  useEffect(() => {
    livePendingRef.current = livePending;
  }, [livePending]);

  // Tick every second; pause when farmer storage is full
  useEffect(() => {
    if (!farmer) return;
    const maxCap = getMaxCapacity(farmer.level);
    const interval = setInterval(() => {
      // Storage full — freeze the timer, don't produce
      if (livePendingRef.current >= maxCap) return;

      setTimeLeft((prev) => {
        if (prev <= 1) {
          setLivePending((p) => Math.min(p + 1, maxCap));
          return farmer.interval_minutes * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [farmer?.id]);

  // Tick every second so food slot countdowns update live
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  function formatCountdown(expiresAtMs: number): string {
    const remaining = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
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
    if (!farmer) return;
    try {
      const res = await api.post(`/api/kitchen/use/${food.id}`, { entity_id: farmer.id });
      const expiresAtMs: number | undefined = res.data.boost?.expires_at_ms
        ? Number(res.data.boost.expires_at_ms)
        : undefined;
      setSlotFoods((prev) => {
        const next: [PlayerFood | null, PlayerFood | null] = [...prev] as any;
        next[activeSlot] = { ...food, expires_at_ms: expiresAtMs };
        return next;
      });
      // Refresh farmer so interval_minutes updates immediately in the drawer
      try {
        const farmersRes = await api.get('/api/farmers');
        const updated = farmersRes.data.find((f: Farmer) => f.id === farmer.id);
        if (updated && onFarmerUpdated) onFarmerUpdated(updated);
      } catch { /* non-critical */ }
      setFoodInventoryOpen(false);
      api.get("/api/kitchen/inventory").then((res) => setPlayerFoods(res.data)).catch(() => {});
      queryClient.invalidateQueries({ queryKey: queryKeys.quests() });
    } catch (err: any) {
      alert(err.response?.data?.error ?? t("foodCouldNotUse"));
    }
  }

  async function handleRemoveFood(slot: 0 | 1) {
    const food = slotFoods[slot];
    if (!food) return;
    try {
      await api.delete(`/api/kitchen/boosts/${food.id}`);
      setSlotFoods((prev) => {
        const next: [PlayerFood | null, PlayerFood | null] = [...prev] as any;
        next[slot] = null;
        return next;
      });
      setRemoveSlot(null);
      // Refresh farmer interval after boost removed
      try {
        if (farmer) {
          const farmersRes = await api.get('/api/farmers');
          const updated = farmersRes.data.find((f: Farmer) => f.id === farmer.id);
          if (updated && onFarmerUpdated) onFarmerUpdated(updated);
        }
      } catch { /* non-critical */ }
    } catch (err: any) {
      alert(err.response?.data?.error ?? t("foodCouldNotRemove"));
    }
  }

  if (!farmer) return null;

  const meta = RESOURCE_META[farmer.resource_type] ?? {
    catImage: null,
    image: null,
    color: "#4a8c3f",
    label: farmer.resource_type,
  };

  const [res1, res2] = UPGRADE_RESOURCES[farmer.resource_type] ?? ["?", "?"];
  const upgradeCost = getUpgradeCost(farmer.level);
  const res1Meta = RESOURCE_META[res1];
  const res2Meta = RESOURCE_META[res2];
  const isMaxLevel = farmer.level >= 50;
  const canUpgrade =
    !isMaxLevel &&
    (resources?.[res1 as keyof Resources] ?? 0) >= upgradeCost &&
    (resources?.[res2 as keyof Resources] ?? 0) >= upgradeCost;

  const currentStored =
    (resources?.[farmer.resource_type as keyof Resources] as number) ?? 0;
  const storageCap =
    (resources?.[
      (farmer.resource_type + "_cap") as keyof Resources
    ] as number) ?? 15;
  const freeSpace = Math.max(0, storageCap - currentStored);
  const collectible = Math.min(livePending, freeSpace);
  const capacityFull = freeSpace === 0 && livePending > 0;

  return (
    <Modal
      visible={!!farmer}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Wrapper for absolute-positioned FoodInventoryDrawer */}
      <View style={styles.modalRoot}>
        <TouchableWithoutFeedback onPress={foodInventoryOpen ? () => setFoodInventoryOpen(false) : onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.drawer, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        {/* Top bar */}
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

        {/* Upgrade cost (left) + level badge (right) */}
        <View style={styles.headerRow}>
          <View style={styles.upgradeMini}>
            {res1Meta?.image && (
              <Image
                source={res1Meta.image}
                style={styles.upgradeMiniIcon}
                resizeMode="contain"
              />
            )}
            <Text
              style={[
                styles.upgradeMiniCost,
                (resources?.[res1 as keyof Resources] ?? 0) < upgradeCost &&
                  styles.costShort,
              ]}
            >
              ×{upgradeCost}
            </Text>
            <Text style={styles.upgradeMiniPlus}>+</Text>
            {res2Meta?.image && (
              <Image
                source={res2Meta.image}
                style={styles.upgradeMiniIcon}
                resizeMode="contain"
              />
            )}
            <Text
              style={[
                styles.upgradeMiniCost,
                (resources?.[res2 as keyof Resources] ?? 0) < upgradeCost &&
                  styles.costShort,
              ]}
            >
              ×{upgradeCost}
            </Text>
            <Text style={styles.upgradeMiniArrow}>→</Text>
            <Text style={styles.upgradeMiniLevel}>LV {farmer.level + 1}</Text>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeLabel}>LV</Text>
            <Text style={styles.levelBadgeNum}>{farmer.level}</Text>
          </View>
        </View>

        {/* Farmer name */}
        <Text style={styles.farmerName}>{farmer.name}</Text>

        {/* Cat image + food slots */}
        <View style={styles.imageAndSlotsRow}>
          <View style={styles.imageFrame}>
            {meta.catImage && (
              <Image
                source={meta.catImage}
                style={styles.catImage}
                resizeMode="contain"
              />
            )}
          </View>
          {/* Food slot buttons — right of image */}
          <View style={styles.foodSlotsCol}>
            {([0, 1] as const).map((slot) => {
              const filled = slotFoods[slot];
              const emoji = filled ? (FOOD_EMOJIS[filled.recipe.name] ?? "🍴") : null;
              const countdown =
                filled &&
                filled.expires_at_ms &&
                filled.recipe.effect_duration_minutes != null
                  ? formatCountdown(filled.expires_at_ms)
                  : null;
              // tick referenced to ensure re-render each second
              void tick;
              return (
                <TouchableOpacity
                  key={slot}
                  style={[styles.foodSlotBtn, filled && styles.foodSlotBtnFilled]}
                  activeOpacity={0.75}
                  onPress={() => filled ? setRemoveSlot(slot) : openFoodInventory(slot)}
                >
                  <View style={[styles.foodSlotIconBg, filled && styles.foodSlotIconBgFilled]}>
                    {filled ? (
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
                          <Text style={styles.foodSlotCountdown}>{countdown}</Text>
                        ) : (
                          <Text style={styles.foodSlotOneShotLabel}>{t("foodOneShotLabel")}</Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.addFoodText}>{t("addFood")}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Production stats */}
        <View style={styles.sectionLabelRow}>
          <Sprout size={12} color="#9a7040" strokeWidth={2} />
          <Text style={styles.sectionLabel}>{t("productionStats")}</Text>
        </View>

        <View style={styles.productionRow}>
          <View style={styles.productionBlock}>
            <Text style={styles.productionValue}>1</Text>
            <Text style={styles.productionSep}>/</Text>
            <Text style={styles.productionInterval}>
              {Number(farmer.interval_minutes).toFixed(1)}{" "}
              {t("perMin").replace("/ ", "")}
            </Text>
          </View>
          {livePending > 0 && (
            <View
              style={[styles.pendingBadge, { backgroundColor: meta.color }]}
            >
              <Package size={12} color="#fff" strokeWidth={2} />
              <Text style={styles.pendingText}>
                {livePending} / {getMaxCapacity(farmer.level)}{" "}
                {t("pendingReady")}
              </Text>
            </View>
          )}
        </View>

        {/* Next production countdown */}
        {(() => {
          const maxCap = getMaxCapacity(farmer.level);
          const isFarmerFull = livePending >= maxCap;
          const totalSeconds = farmer.interval_minutes * 60;
          const progress = isFarmerFull
            ? 0
            : totalSeconds > 0
              ? Math.max(0, Math.min(1, 1 - (timeLeft - 1) / totalSeconds))
              : 1;
          return (
            <View
              style={styles.nextReadyRow}
              onLayout={(e) => setTimerRowWidth(e.nativeEvent.layout.width)}
            >
              {/* Progress fill behind the content */}
              {!isFarmerFull && (
                <View
                  style={[
                    styles.nextReadyFill,
                    {
                      width: timerRowWidth * progress,
                      backgroundColor: meta.color,
                      opacity: isFarmerFull ? 0.5 : 1,
                    },
                  ]}
                />
              )}
              <Timer
                size={12}
                color={isFarmerFull ? "#c0392b" : "black"}
                strokeWidth={2}
              />
              <Text style={styles.nextReadyLabel}>
                {isFarmerFull ? t("farmerStorageFull") : t("nextIn")}
              </Text>
              {!isFarmerFull && (
                <Text style={styles.nextReadyTimer}>
                  {formatTime(timeLeft)}
                </Text>
              )}
            </View>
          );
        })()}

        {/* Collect button */}
        <CustomButton
          btnImage={meta.image ?? undefined}
          text={
            capacityFull
              ? `${t("collect")} — ${t("farmerStorageFull")}`
              : collectible > 0
                ? `${t("collect")} (+${collectible}${collectible < livePending ? `/${livePending}` : ""})`
                : t("nothingToCollect")
          }
          onClick={() => onCollect(farmer)}
          bgColor={capacityFull ? "#9a7040" : meta.color}
          borderColor={capacityFull ? "#7a5030" : meta.color}
          disabled={collectible === 0}
          style={styles.actionBtn}
        />

        <View style={styles.divider} />

        {/* Upgrade + Fill Storage buttons row */}
        <View style={styles.bottomBtnRow}>
          <CustomButton
            btnIcon={<ArrowUp size={20} color="#fff" strokeWidth={2.5} />}
            text={
              isMaxLevel
                ? `${t("maxLevel")} ${farmer.level}`
                : `${t("upgrade")} → ${t("lv")} ${farmer.level + 1}`
            }
            subContent={
              !isMaxLevel ? (
                <View style={styles.costRow}>
                  {res1Meta?.image && (
                    <Image source={res1Meta.image} style={styles.costIcon} resizeMode="contain" />
                  )}
                  <Text style={styles.costText}>×{upgradeCost}</Text>
                  <Text style={styles.costText}> + </Text>
                  {res2Meta?.image && (
                    <Image source={res2Meta.image} style={styles.costIcon} resizeMode="contain" />
                  )}
                  <Text style={styles.costText}>×{upgradeCost}</Text>
                </View>
              ) : undefined
            }
            onClick={() => !isMaxLevel && canUpgrade && setShowUpgradeModal(true)}
            bgColor={isMaxLevel ? "#9a7040" : "#4a7c3f"}
            borderColor={isMaxLevel ? "#7a5030" : "#2d5a24"}
            disabled={!canUpgrade}
            style={styles.bottomBtnFlex}
          />
          {(() => {
            const maxCap = getMaxCapacity(farmer.level);
            const fillCost = maxCap - livePending;
            const isFull = fillCost <= 0;
            const canFill = !isFull && coins >= fillCost;
            return (
              <CustomButton
                btnIcon={<Package size={20} color="#fff" strokeWidth={2.5} />}
                text={isFull ? t("storageFull") : t("fillStorage")}
                subContent={
                  !isFull ? (
                    <View style={styles.costRow}>
                      <Image source={COIN_IMG} style={styles.costIcon} resizeMode="contain" />
                      <Text style={styles.costText}>×{fillCost}</Text>
                    </View>
                  ) : undefined
                }
                onClick={() => !isFull && onFillStorage && triggerCoinConfirm({
                  transactionCost: fillCost,
                  transactionTitle: t("fillStorage"),
                  transactionDesc: t("fillStorageDesc"),
                  onConfirm: () => onFillStorage(farmer),
                })}
                bgColor={isFull ? "#9a7040" : "#b8860b"}
                borderColor={isFull ? "#7a5030" : "#8b6508"}
                disabled={isFull || !canFill}
                style={styles.bottomBtnFlex}
              />
            );
          })()}
        </View>
        <InGameCoinConfirmModal coins={coins} />
      </Animated.View>

        {/* Food inventory panel — absolutely positioned inside modalRoot */}
        <FoodInventoryDrawer
          visible={foodInventoryOpen}
          inventory={playerFoods}
          onClose={() => setFoodInventoryOpen(false)}
          onUseFood={handleUseFood}
          context="farmer"
          onGoToKitchen={() => {
            setFoodInventoryOpen(false);
            onClose();
            router.push("/(game)/kitchen");
          }}
        />

        {/* Remove food popup */}
        {removeSlot !== null && slotFoods[removeSlot] && (() => {
          const food = slotFoods[removeSlot]!;
          const emoji = FOOD_EMOJIS[food.recipe.name] ?? "🍴";
          const hasCountdown = food.expires_at_ms && food.recipe.effect_duration_minutes != null;
          void tick;
          return (
            <View style={styles.removeFoodOverlay}>
              <View style={styles.removeFoodCard}>
                <Text style={styles.removeFoodEmoji}>{emoji}</Text>
                <Text style={styles.removeFoodName}>{food.recipe.name}</Text>
                <Text style={styles.removeFoodEffect}>{describeEffect(food.recipe)}</Text>
                {hasCountdown && (
                  <View style={styles.removeFoodTimerRow}>
                    <Text style={styles.removeFoodTimerLabel}>{t("foodRemainingLabel")}</Text>
                    <Text style={styles.removeFoodTimer}>{formatCountdown(food.expires_at_ms!)}</Text>
                  </View>
                )}
                <View style={styles.removeFoodBtnRow}>
                  <TouchableOpacity
                    style={styles.removeFoodKeepBtn}
                    activeOpacity={0.75}
                    onPress={() => setRemoveSlot(null)}
                  >
                    <Text style={styles.removeFoodKeepText}>{t("foodKeepBtn")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeFoodRemoveBtn}
                    activeOpacity={0.75}
                    onPress={() => handleRemoveFood(removeSlot)}
                  >
                    <Text style={styles.removeFoodRemoveText}>{t("foodDiscardBtn")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })()}
      </View>

      <CustomModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onConfirm={() => {
          setShowUpgradeModal(false);
          onUpgrade(farmer);
        }}
        title={t("farmerUpgradeTitle")}
        confirmText={t("upgradeBtn")}
      >
        <View style={styles.modalBody}>
          <Text style={styles.modalText}>
            {t("farmerUpgradeConfirmPre")} LV {farmer.level} → LV {farmer.level + 1} {t("farmerUpgradeConfirmPost")}
          </Text>
          <View style={styles.modalCostRow}>
            {res1Meta?.image && <Image source={res1Meta.image} style={styles.modalCostIcon} resizeMode="contain" />}
            <Text style={styles.modalCostText}>×{upgradeCost}</Text>
            {res2Meta?.image && <Image source={res2Meta.image} style={styles.modalCostIcon} resizeMode="contain" />}
            <Text style={styles.modalCostText}>×{upgradeCost}</Text>
          </View>
        </View>
      </CustomModal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: { flex: 1 },
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
  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  handleWrap: { flex: 1, alignItems: "center", paddingLeft: 38 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#c8a96e" },
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
  upgradeMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ede0c4",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: "#c8a96e",
  },
  upgradeMiniIcon: { width: 20, height: 20 },
  upgradeMiniCost: { fontSize: 13, fontWeight: "800", color: "#3a1e00" },
  upgradeMiniPlus: { fontSize: 13, fontWeight: "700", color: "#9a7040" },
  upgradeMiniArrow: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9a7040",
    marginLeft: 2,
  },
  upgradeMiniLevel: { fontSize: 12, fontWeight: "800", color: "#4a7c3f" },
  costShort: { color: "#c0392b" },
  modalBody: { gap: 10 },
  modalText: { fontSize: 14, fontWeight: "600", color: "#5a3a10" },
  modalCostRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  modalCostIcon: { width: 22, height: 22 },
  modalCostText: { fontSize: 15, fontWeight: "800", color: "#3a1e00" },
  levelBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: "#e8c87a",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderColor: "#c8a040",
    gap: 3,
    justifyContent: "flex-end",
  },
  levelBadgeLabel: { fontSize: 10, fontWeight: "700", color: "#7a5020" },
  levelBadgeNum: { fontSize: 18, fontWeight: "900", color: "#3a1e00" },
  farmerName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#3a1e00",
    marginBottom: 12,
  },
  imageAndSlotsRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 12,
    marginBottom: 16,
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
    overflow: "hidden",
    shadowColor: "#b8893a",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  catImage: { width: 128, height: 128 },
  foodSlotsCol: {
    flex: 1,
    gap: 8,
    justifyContent: "center",
  },
  foodSlotBtn: {
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
  foodSlotIconBg: {
    width: 36,
    height: 36,
    backgroundColor: "#f5e9cc",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  foodSlotIconBgFilled: {
    backgroundColor: "#daefd4",
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
    color: "#c87820",
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
  foodSlotEmoji: { fontSize: 22 },
  foodSlotCountdown: {
    fontSize: 9,
    fontWeight: "700",
    color: "#4a7c3f",
    letterSpacing: 0.2,
  },
  divider: {
    height: 1.5,
    backgroundColor: "#d4b896",
    marginBottom: 12,
    marginTop: 4,
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
  productionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  productionBlock: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  productionValue: { fontSize: 28, fontWeight: "800", color: "#3a1e00" },
  productionSep: { fontSize: 20, color: "#9a7040" },
  productionInterval: { fontSize: 16, fontWeight: "700", color: "#7a5a30" },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pendingText: { fontSize: 13, fontWeight: "800", color: "#fff" },
  nextReadyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ede0c4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 12,
    overflow: "hidden",
  },
  nextReadyFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 10,
  },
  nextReadyLabel: { fontSize: 12, fontWeight: "700", color: "black" },
  nextReadyTimer: {
    fontSize: 14,
    fontWeight: "800",
    color: "#4a2e0a",
    letterSpacing: 1,
  },
  actionBtn: {
    marginBottom: 4,
  },
  btnDisabled: { opacity: 0.4 },
  bottomBtnRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  bottomBtnFlex: {
    flex: 1,
  },

  // ── Cost row (inside CustomButton subContent) ──
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  costIcon: {
    width: 16,
    height: 16,
  },
  costText: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
  },
});
