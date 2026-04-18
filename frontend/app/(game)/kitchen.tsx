import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/queryKeys";
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/StyledText";
import { ChevronLeft, ChevronRight, Timer, Zap } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../lib/api";
import { Recipe, Resources, PlayerFood } from "../../types";
import FoodCard, {
  FOOD_EMOJIS,
  describeEffect,
} from "../../components/FoodCard";
import CustomButton from "../../components/CustomButton";
import { useCoinConfirm } from "../../lib/coin-confirm-context";
import InGameCoinConfirmModal from "../../components/InGameCoinConfirmModal";
import { useLanguage } from "../../lib/i18n";

const COIN_IMG = require("../../assets/icons/icon-coin.webp");
const FORGE_IMG = require("../../assets/forge.webp");
const KITCHEN_IMG = require("../../assets/kitchen.webp");
const FIRE_GIF = require("../../assets/fire.gif");
const ICON_FIGHTERS = require("../../assets/icons/icon-fighters.webp");
const ICON_FARMERS = require("../../assets/icons/icon-farmers.webp");
const ICON_ANIMALS = require("../../assets/icons/icon-animals.webp");

type MainTab = "forge" | "kitchen";
type KitchenSub = "all" | "fighters" | "farmers" | "animals";
type StatFilter = "all" | "attack" | "defense" | "hp" | "chance";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ─── Cooking Row ─────────────────────────────────────────────────────────────

function CookingRow({
  food,
  coins,
  onInstantCook,
}: {
  food: PlayerFood;
  coins: number;
  onInstantCook: (foodId: string, coinCost: number) => void;
}) {
  const { t } = useLanguage();
  const readyAt = food.cooking_ready_at_ms;
  const startedAt = food.cooking_started_at_ms;
  const totalMs = Math.max(1, readyAt - startedAt);
  const emoji = FOOD_EMOJIS[food.recipe?.name ?? ""] ?? "🍴";

  const [msLeft, setMsLeft] = useState(() => Math.max(0, readyAt - Date.now()));
  useEffect(() => {
    setMsLeft(Math.max(0, readyAt - Date.now()));
    const iv = setInterval(
      () => setMsLeft(Math.max(0, readyAt - Date.now())),
      1000,
    );
    return () => clearInterval(iv);
  }, [readyAt]);

  const progress = Math.min(1 - msLeft / totalMs, 1);
  const isDone = msLeft <= 0;
  const coinCost = Math.max(1, Math.ceil(msLeft / 60000));
  const canAfford = coins >= coinCost;

  return (
    <View style={[cStyles.row, isDone && cStyles.rowDone]}>
      <View style={cStyles.emojiBg}>
        <Text style={cStyles.emoji}>{emoji}</Text>
      </View>
      <View style={cStyles.info}>
        <View style={cStyles.topLine}>
          <Text style={cStyles.name} numberOfLines={1}>
            {food.recipe?.name ?? ""}
          </Text>
          {isDone && (
            <View style={cStyles.readyBadge}>
              <Text style={cStyles.readyText}>{t("readyLabel")}</Text>
            </View>
          )}
        </View>
        <Text style={cStyles.effect} numberOfLines={1}>
          {describeEffect(food.recipe, t)}
        </Text>
        {!isDone && (
          <>
            <View style={cStyles.barTrack}>
              <View
                style={[
                  cStyles.barFill,
                  { width: `${progress * 100}%` as any },
                ]}
              />
              <View style={cStyles.barLabel}>
                <Timer size={10} color="#3a2a10" strokeWidth={2} />
                <Text style={cStyles.barText}>{formatTime(msLeft)}</Text>
              </View>
            </View>
            <CustomButton
              btnIcon={
                <Zap
                  size={18}
                  color={canAfford ? "#fff" : "rgba(255,255,255,0.45)"}
                  strokeWidth={2.5}
                />
              }
              text={t("instantCookBtn")}
              subContent={
                <View style={cStyles.costRow}>
                  <Image
                    source={COIN_IMG}
                    style={cStyles.coinIcon}
                    resizeMode="contain"
                  />
                  <Text style={cStyles.costText}>×{coinCost}</Text>
                </View>
              }
              onClick={() => canAfford && onInstantCook(food.id, coinCost)}
              bgColor={canAfford ? "#7a5a9a" : "#9a8060"}
              borderColor={canAfford ? "#5a3a7a" : "#7a6040"}
              disabled={!canAfford}
            />
          </>
        )}
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function KitchenScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { triggerCoinConfirm } = useCoinConfirm();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [coins, setCoins] = useState(0);
  const [resources, setResources] = useState<Resources>({
    strawberry: 0,
    pinecone: 0,
    blueberry: 0,
    strawberry_cap: 10,
    pinecone_cap: 10,
    blueberry_cap: 10,
    egg: 0,
    wool: 0,
    milk: 0,
    egg_cap: 10,
    wool_cap: 10,
    milk_cap: 10,
  });
  const [mainTab, setMainTab] = useState<MainTab>("kitchen");
  const [kitchenSub, setKitchenSub] = useState<KitchenSub>("all");
  const [statFilter, setStatFilter] = useState<StatFilter>("all");
  const [showCooking, setShowCooking] = useState(false);
  const [cookingMap, setCookingMap] = useState<Record<string, number>>({});
  const [cookingFoodIdMap, setCookingFoodIdMap] = useState<
    Record<string, string>
  >({});
  const [cookingItems, setCookingItems] = useState<PlayerFood[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, []),
  );

  async function fetchData() {
    try {
      const [recipesRes, resourcesRes, inventoryRes, playerRes] =
        await Promise.all([
          api.get("/api/kitchen/recipes"),
          api.get("/api/resources"),
          api.get("/api/kitchen/inventory"),
          api.get("/api/auth/me"),
        ]);
      setRecipes(recipesRes.data);
      setResources(resourcesRes.data);
      setCoins(playerRes.data.coins ?? 0);

      const inventory: PlayerFood[] = inventoryRes.data;
      const cooking = inventory.filter((f) => f.status === "cooking");
      setCookingItems(cooking);

      const map: Record<string, number> = {};
      const foodIdMap: Record<string, string> = {};
      cooking.forEach((f) => {
        map[f.recipe_id] = f.cooking_ready_at_ms;
        foodIdMap[f.recipe_id] = f.id;
      });
      setCookingMap(map);
      setCookingFoodIdMap(foodIdMap);
    } catch (err) {
      console.error("Kitchen fetch failed:", err);
    }
  }

  async function handleCook(recipe: Recipe) {
    try {
      const res = await api.post(`/api/kitchen/cook/${recipe.id}`);
      setResources(res.data.resources);
      const food: PlayerFood = res.data.food;
      setCookingMap((prev) => ({
        ...prev,
        [recipe.id]: food.cooking_ready_at_ms,
      }));
      setCookingFoodIdMap((prev) => ({ ...prev, [recipe.id]: food.id }));
      setCookingItems((prev) => [...prev, food]);
      queryClient.invalidateQueries({ queryKey: queryKeys.quests() });
    } catch (err: any) {
      alert(err.response?.data?.error ?? "Cook failed");
    }
  }

  async function handleInstantCook(foodId: string, coinCost: number) {
    triggerCoinConfirm({
      transactionCost: coinCost,
      transactionTitle: t("instantCookTitle"),
      transactionDesc: t("instantCookDesc"),
      onConfirm: async () => {
        try {
          const res = await api.post(`/api/kitchen/instant/${foodId}`);
          setCoins(res.data.coins);
          setCookingItems((prev) => {
            const removed = prev.find((f) => f.id === foodId);
            if (removed) {
              setCookingMap((m) => {
                const n = { ...m };
                delete n[removed.recipe_id];
                return n;
              });
              setCookingFoodIdMap((m) => {
                const n = { ...m };
                delete n[removed.recipe_id];
                return n;
              });
            }
            return prev.filter((f) => f.id !== foodId);
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.kitchenInventory(),
          });
          queryClient.invalidateQueries({ queryKey: queryKeys.player() });
        } catch (err: any) {
          alert(err.response?.data?.error ?? "Instant cook failed");
        }
      },
    });
  }

  // ── Filtering ─────────────────────────────────────────────────────────────

  const visibleRecipes = (() => {
    if (mainTab === "forge") return recipes.filter((r) => r.target === "gear");
    let base =
      kitchenSub === "all"
        ? recipes.filter((r) => r.target !== "gear")
        : kitchenSub === "fighters"
          ? recipes.filter((r) => r.target === "fighters")
          : kitchenSub === "farmers"
            ? recipes.filter(
                (r) => r.target === "farmers" || r.target === "farm_animals",
              )
            : recipes.filter(
                (r) => r.target === "animals" || r.target === "farm_animals",
              );

    if (kitchenSub === "fighters" && statFilter !== "all") {
      const effectMap: Record<Exclude<StatFilter, "all">, string> = {
        attack: "boost_attack",
        defense: "boost_defense",
        hp: "boost_hp",
        chance: "boost_chance",
      };
      base = base.filter(
        (r) =>
          r.effect_type === effectMap[statFilter as Exclude<StatFilter, "all">],
      );
    }
    return base;
  })();

  const activeCooking =
    mainTab === "forge"
      ? cookingItems.filter((f) => f.recipe?.target === "gear")
      : cookingItems.filter((f) => f.recipe?.target !== "gear");

  const STAT_META: {
    key: StatFilter;
    label: () => string;
    activeColor: string;
  }[] = [
    { key: "all", label: () => t("allFilter"), activeColor: "#4a7c3f" },
    { key: "attack", label: () => t("statAtk"), activeColor: "#c0392b" },
    { key: "defense", label: () => t("statDef"), activeColor: "#2980b9" },
    { key: "hp", label: () => t("statHp"), activeColor: "#27ae60" },
    { key: "chance", label: () => t("statCrit"), activeColor: "#8e44ad" },
  ];

  // Sub-filter tab icon/label config
  const SUB_TABS: { key: KitchenSub; icon?: any; label: () => string }[] = [
    { key: "fighters", icon: ICON_FIGHTERS, label: () => t("champions") },
    { key: "farmers", icon: ICON_FARMERS, label: () => t("farmers") },
    { key: "animals", icon: ICON_ANIMALS, label: () => t("animals") },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color="#7a5030" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🔥 {t("fireScreen")}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Main tab cards — image top, label bottom */}
      <View style={styles.mainTabRow}>
        {(["kitchen", "forge"] as MainTab[]).map((tab) => {
          const active = mainTab === tab;
          const img = tab === "forge" ? FORGE_IMG : KITCHEN_IMG;
          const label = tab === "forge" ? t("forgeTab") : t("kitchenTab");
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.mainTabCard, active && styles.mainTabCardActive]}
              onPress={() => {
                setMainTab(tab);
                setShowCooking(false);
                setStatFilter("all");
              }}
              activeOpacity={0.8}
            >
              <View style={styles.mainTabImageWrap}>
                <Image
                  source={img}
                  style={styles.mainTabImage}
                  resizeMode="contain"
                />
                {/* Dark overlay — visible on inactive, fades on active */}
                {!active && <View style={styles.mainTabImageOverlay} />}
              </View>
              <View
                style={[
                  styles.mainTabLabelWrap,
                  active && styles.mainTabLabelWrapActive,
                ]}
              >
                <Text
                  style={[
                    styles.mainTabLabel,
                    active && styles.mainTabLabelActive,
                  ]}
                >
                  {label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Divider */}
      <View style={styles.tabDivider} />

      {/* Kitchen sub-filters */}
      {mainTab === "kitchen" && !showCooking && (
        <View style={styles.subFilterWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subFilterRow}
          >
            {SUB_TABS.map(({ key, icon, label }) => {
              const active = kitchenSub === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.subBtn, active && styles.subBtnActive]}
                  onPress={() => {
                    setKitchenSub(key);
                    setStatFilter("all");
                  }}
                  activeOpacity={0.75}
                >
                  {icon && (
                    <Image
                      source={icon}
                      style={[
                        styles.subBtnIcon,
                        !active && styles.subBtnIconInactive,
                      ]}
                      resizeMode="contain"
                    />
                  )}
                  <Text
                    style={[
                      styles.subBtnText,
                      active && styles.subBtnTextActive,
                    ]}
                  >
                    {label()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Stat sub-filter — only when Champions selected */}
          {kitchenSub === "fighters" && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statFilterRow}
            >
              {STAT_META.map((s) => {
                const active = statFilter === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[
                      styles.statBtn,
                      active && {
                        backgroundColor: s.activeColor,
                        borderColor: s.activeColor,
                      },
                    ]}
                    onPress={() => setStatFilter(s.key)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.statBtnText,
                        active && styles.statBtnTextActive,
                      ]}
                    >
                      {s.label()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* Content: Cooking view or Recipe grid */}
      {showCooking ? (
        <ScrollView
          style={styles.cookScroll}
          contentContainerStyle={styles.cookScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backToRecipesBtn}
            onPress={() => setShowCooking(false)}
            activeOpacity={0.75}
          >
            <ChevronLeft size={14} color="#c87820" strokeWidth={2.5} />
            <Text style={styles.backToRecipesText}>{t("cookingBack")}</Text>
          </TouchableOpacity>

          {activeCooking.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🍳</Text>
              <Text style={styles.emptyText}>{t("noRecipesFound")}</Text>
            </View>
          ) : (
            activeCooking.map((f) => (
              <CookingRow
                key={f.id}
                food={f}
                coins={coins}
                onInstantCook={handleInstantCook}
              />
            ))
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={visibleRecipes}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[
            styles.grid,
            activeCooking.length > 0 && styles.gridWithFooter,
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <FoodCard
              recipe={item}
              resources={resources}
              onCook={handleCook}
              cookingReadyAtMs={cookingMap[item.id] ?? null}
              cookingFoodId={cookingFoodIdMap[item.id] ?? null}
              coins={coins}
              onInstantCook={handleInstantCook}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>
                {mainTab === "forge" ? "⚒️" : "🍳"}
              </Text>
              <Text style={styles.emptyText}>{t("noRecipesFound")}</Text>
            </View>
          }
        />
      )}

      {/* Floating cooking button — CustomButton style, black bg so fire.gif blends */}
      {!showCooking && activeCooking.length > 0 && (
        <TouchableOpacity
          style={styles.cookingFooterOuter}
          onPress={() => setShowCooking(true)}
          activeOpacity={0.75}
        >
          <View style={styles.cookingFooterInner}>
            <Image
              source={FIRE_GIF}
              style={styles.fireGif}
              resizeMode="contain"
            />
            <Text style={styles.cookingFooterText}>{t("cookingNow")}</Text>
            <View style={styles.cookingCountBadge}>
              <Text style={styles.cookingCountText}>
                {activeCooking.length}
              </Text>
            </View>
            <ChevronRight size={20} color="#fff" strokeWidth={2.5} />
          </View>
        </TouchableOpacity>
      )}

      <InGameCoinConfirmModal coins={coins} />
    </SafeAreaView>
  );
}

// ─── Cooking row styles ───────────────────────────────────────────────────────

const cStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f5edd8",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#c87820",
    padding: 12,
    gap: 12,
  },
  rowDone: { borderColor: "#4a7c3f" },
  emojiBg: {
    width: 52,
    height: 52,
    backgroundColor: "#ede0c4",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 30 },
  info: { flex: 1, gap: 6 },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  name: { flex: 1, fontSize: 13, fontWeight: "900", color: "#3a1e00" },
  readyBadge: {
    backgroundColor: "#4a7c3f",
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  readyText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.5,
  },
  effect: { fontSize: 11, fontWeight: "700", color: "#7a5a30" },
  barTrack: {
    height: 22,
    backgroundColor: "#ede0c4",
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
  },
  barFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#c87820",
    borderRadius: 8,
  },
  barLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    zIndex: 1,
  },
  barText: { fontSize: 10, fontWeight: "800", color: "#3a2a10" },
  costRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  coinIcon: { width: 14, height: 14 },
  costText: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.85)",
  },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5e9cc" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ede0c4",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "900",
    color: "#3a1e00",
  },
  headerRight: { width: 36 },

  // Main tab cards — image fills top, label strip at bottom
  mainTabRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  mainTabCard: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2.5,
    borderColor: "#b8956a",
    backgroundColor: "#d8c9a8",
  },
  mainTabCardActive: {
    borderColor: "#1a1a1a",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  mainTabImageWrap: {
    position: "relative",
  },
  mainTabImage: {
    width: "100%",
    height: 150,
  },
  mainTabImageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  mainTabLabelWrap: {
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#d8c9a8",
    marginHorizontal: -1,
    marginBottom: -1,
  },
  mainTabLabelWrapActive: {
    backgroundColor: "#1a1a1a",
  },
  mainTabLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#8a6a30",
  },
  mainTabLabelActive: {
    color: "#fff",
    fontSize: 15,
  },

  tabDivider: {
    height: 2,
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 1,
    backgroundColor: "#d4b896",
  },

  // Kitchen sub-filters
  subFilterWrap: {
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 8,
  },
  subFilterRow: {
    flexDirection: "row",
    gap: 6,
    paddingRight: 14,
  },
  subBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#ede0c4",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
  },
  subBtnActive: {
    backgroundColor: "#4a7c3f",
    borderColor: "#2d5a24",
  },
  subBtnIcon: {
    width: 20,
    height: 20,
  },
  subBtnIconInactive: {
    opacity: 0.55,
  },
  subBtnText: { fontSize: 12, fontWeight: "800", color: "#7a5030" },
  subBtnTextActive: { color: "#fff" },

  // Stat filter
  statFilterRow: {
    flexDirection: "row",
    gap: 6,
    paddingRight: 14,
  },
  statBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "#ede0c4",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
  },
  statBtnText: { fontSize: 11, fontWeight: "800", color: "#7a5030" },
  statBtnTextActive: { color: "#fff" },

  // Recipe grid
  grid: {
    paddingHorizontal: 10,
    paddingBottom: 24,
    gap: 10,
  },
  gridWithFooter: {
    paddingBottom: 100,
  },
  columnWrapper: { gap: 10 },

  // Cooking scroll view
  cookScroll: { flex: 1 },
  cookScrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 30,
    gap: 10,
  },
  backToRecipesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#fff8ec",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#c87820",
    marginBottom: 4,
  },
  backToRecipesText: { fontSize: 13, fontWeight: "800", color: "#c87820" },

  // Floating cooking button — mirrors CustomButton outer/inner structure
  cookingFooterOuter: {
    position: "absolute",
    bottom: 44,
    left: 16,
    right: 16,
    height: 71,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: "#333",
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 0,
    elevation: 8,
  },
  cookingFooterInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
    borderRadius: 16,
    borderTopWidth: 2,
    borderTopColor: "#555",
    borderLeftWidth: 1.5,
    borderLeftColor: "#555",
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderBottomColor: "transparent",
    borderRightColor: "transparent",
  },
  fireGif: {
    width: 44,
    height: 44,
  },
  cookingFooterText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.5,
    fontFamily: "Fredoka-Bold",
    textShadowColor: "#555",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cookingCountBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  cookingCountText: { fontSize: 14, fontWeight: "900", color: "#fff" },

  // Empty state
  emptyWrap: {
    paddingTop: 60,
    alignItems: "center",
    gap: 10,
  },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 14, fontWeight: "700", color: "#b09060" },
});
