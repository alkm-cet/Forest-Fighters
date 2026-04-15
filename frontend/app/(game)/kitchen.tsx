import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/queryKeys";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/StyledText";
import { ChevronLeft, ChefHat, Timer } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../lib/api";
import { Recipe, Resources, PlayerFood } from "../../types";
import FoodCard, { FOOD_EMOJIS, describeEffect } from "../../components/FoodCard";

type TargetTab = "fighters" | "farmers" | "animals";
type ActiveTab = "all" | TargetTab | "cooking";

// ─── Cooking item row ────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function CookingRow({ food }: { food: PlayerFood }) {
  const readyAt   = food.cooking_ready_at_ms;
  const startedAt = food.cooking_started_at_ms;
  const totalMs   = Math.max(1, readyAt - startedAt);
  const emoji     = FOOD_EMOJIS[food.recipe?.name ?? ""] ?? "🍴";

  const [msLeft, setMsLeft] = useState(() => Math.max(0, readyAt - Date.now()));

  useEffect(() => {
    setMsLeft(Math.max(0, readyAt - Date.now()));
    const iv = setInterval(() => setMsLeft(Math.max(0, readyAt - Date.now())), 1000);
    return () => clearInterval(iv);
  }, [readyAt]);

  const progress = Math.min(1 - msLeft / totalMs, 1);
  const isDone   = msLeft <= 0;

  return (
    <View style={[styles.cookRow, isDone && styles.cookRowDone]}>
      <View style={styles.cookRowEmojiBg}>
        <Text style={styles.cookRowEmoji}>{emoji}</Text>
      </View>

      <View style={styles.cookRowInfo}>
        {/* Name + ready badge */}
        <View style={styles.cookRowTopLine}>
          <Text style={styles.cookRowName} numberOfLines={1}>
            {food.recipe?.name ?? ""}
          </Text>
          {isDone && (
            <View style={styles.readyBadge}>
              <Text style={styles.readyBadgeText}>READY</Text>
            </View>
          )}
        </View>

        {/* Effect */}
        <Text style={styles.cookRowEffect} numberOfLines={1}>
          {describeEffect(food.recipe)}
        </Text>

        {/* Combined progress bar + centered timer — same as FoodCard */}
        {!isDone && (
          <View style={styles.cookBarTrack}>
            <View style={[styles.cookBarFill, { width: `${progress * 100}%` as any }]} />
            <View style={styles.cookBarLabel}>
              <Timer size={10} color="#3a2a10" strokeWidth={2} />
              <Text style={styles.cookBarText}>{formatTime(msLeft)}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function KitchenScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [recipes, setRecipes]         = useState<Recipe[]>([]);
  const [resources, setResources]     = useState<Resources>({
    strawberry: 0, pinecone: 0, blueberry: 0,
    strawberry_cap: 10, pinecone_cap: 10, blueberry_cap: 10,
    egg: 0, wool: 0, milk: 0,
    egg_cap: 10, wool_cap: 10, milk_cap: 10,
  });
  const [activeTab, setActiveTab]     = useState<ActiveTab>("all");
  const [cookingMap, setCookingMap]   = useState<Record<string, number>>({});
  const [cookingItems, setCookingItems] = useState<PlayerFood[]>([]);

  // orange dot pulse
  const dotPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (cookingItems.length === 0) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, { toValue: 1.6, duration: 700, useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [cookingItems.length]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  async function fetchData() {
    try {
      const [recipesRes, resourcesRes, inventoryRes] = await Promise.all([
        api.get("/api/kitchen/recipes"),
        api.get("/api/resources"),
        api.get("/api/kitchen/inventory"),
      ]);
      setRecipes(recipesRes.data);
      setResources(resourcesRes.data);

      const inventory: PlayerFood[] = inventoryRes.data;
      const cooking = inventory.filter((f) => f.status === "cooking");
      setCookingItems(cooking);

      const map: Record<string, number> = {};
      cooking.forEach((f) => { map[f.recipe_id] = f.cooking_ready_at_ms; });
      setCookingMap(map);
    } catch (err) {
      console.error("Kitchen fetch failed:", err);
    }
  }

  async function handleCook(recipe: Recipe) {
    try {
      const res = await api.post(`/api/kitchen/cook/${recipe.id}`);
      setResources(res.data.resources);
      const food: PlayerFood = res.data.food;
      setCookingMap((prev) => ({ ...prev, [recipe.id]: food.cooking_ready_at_ms }));
      setCookingItems((prev) => [...prev, food]);
      queryClient.invalidateQueries({ queryKey: queryKeys.quests() });
    } catch (err: any) {
      alert(err.response?.data?.error ?? "Cook failed");
    }
  }

  const filteredRecipes =
    activeTab === "all" || activeTab === "cooking"
      ? recipes
      : activeTab === "fighters"
        ? recipes.filter((r) => r.target === "fighters")
        : activeTab === "farmers"
          ? recipes.filter((r) => r.target === "farmers" || r.target === "farm_animals")
          : recipes.filter((r) => r.target === "animals" || r.target === "farm_animals");

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={20} color="#7a5030" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <ChefHat size={18} color="#9a7040" strokeWidth={2} />
          <Text style={styles.headerTitle}>Kitchen</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.headerDivider} />

      {/* Tab row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tierScrollView}
        contentContainerStyle={styles.tierRow}
      >
        {/* All */}
        <TouchableOpacity
          style={[styles.tierBtn, activeTab === "all" && styles.tierBtnActive]}
          onPress={() => setActiveTab("all")}
          activeOpacity={0.75}
        >
          <Text style={[styles.tierBtnText, activeTab === "all" && styles.tierBtnTextActive]}>
            All
          </Text>
        </TouchableOpacity>

        {/* Target tabs */}
        {(["fighters", "farmers", "animals"] as const).map((tab) => {
          const label = tab === "fighters" ? "⚔️ Champions" : tab === "farmers" ? "🌾 Farmers" : "🐾 Animals";
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tierBtn, activeTab === tab && styles.tierBtnActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tierBtnText, activeTab === tab && styles.tierBtnTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Cooking tab with optional orange dot */}
        <TouchableOpacity
          style={[styles.tierBtn, styles.cookingTabBtn, activeTab === "cooking" && styles.cookingTabBtnActive]}
          onPress={() => setActiveTab("cooking")}
          activeOpacity={0.75}
        >
          <Timer size={12} color={activeTab === "cooking" ? "#fff" : "#c87820"} strokeWidth={2.5} />
          <Text style={[styles.tierBtnText, activeTab === "cooking" && styles.tierBtnTextActive]}>
            Cooking
          </Text>
          {cookingItems.length > 0 && (
            <Animated.View style={[styles.cookingDot, { transform: [{ scale: dotPulse }] }]} />
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Cooking view */}
      {activeTab === "cooking" ? (
        cookingItems.length === 0 ? (
          <View style={styles.emptyCenter}>
            <Text style={styles.emptyEmoji}>🍳</Text>
            <Text style={styles.emptyText}>Nothing cooking yet</Text>
            <Text style={styles.emptySubText}>Go to a recipe and tap Cook!</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.cookList}
            contentContainerStyle={styles.cookListContent}
            showsVerticalScrollIndicator={false}
          >
            {cookingItems.map((f) => (
              <CookingRow key={f.id} food={f} />
            ))}
          </ScrollView>
        )
      ) : (
        /* Recipe grid — 2 columns */
        <FlatList
          data={filteredRecipes}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <FoodCard
              recipe={item}
              resources={resources}
              onCook={handleCook}
              cookingReadyAtMs={cookingMap[item.id] ?? null}
            />
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No recipes found</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5e9cc",
  },
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
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#3a1e00",
  },
  headerRight: { width: 36 },
  headerDivider: {
    height: 1,
    backgroundColor: "#d4b896",
    marginHorizontal: 16,
    marginBottom: 10,
  },
  tierScrollView: {
    flexGrow: 0,
    flexShrink: 0,
  },
  tierRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  tierBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#ede0c4",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
  },
  tierBtnActive: {
    backgroundColor: "#4a7c3f",
    borderColor: "#2d5a24",
  },
  tierBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#7a5030",
  },
  tierBtnTextActive: { color: "#fff" },
  cookingTabBtn: {
    borderColor: "#c87820",
  },
  cookingTabBtnActive: {
    backgroundColor: "#c87820",
    borderColor: "#a05f10",
  },
  cookingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e85d00",
    marginLeft: 2,
  },

  // ── Cooking list ──
  cookList: { flex: 1 },
  cookListContent: {
    paddingHorizontal: 14,
    paddingBottom: 30,
    gap: 10,
  },
  cookRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5edd8",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#c87820",
    padding: 12,
    gap: 12,
  },
  cookRowDone: {
    borderColor: "#4a7c3f",
  },
  cookRowEmojiBg: {
    width: 52,
    height: 52,
    backgroundColor: "#ede0c4",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cookRowEmoji: { fontSize: 32 },
  cookRowInfo: { flex: 1, gap: 5 },
  cookRowTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  cookRowName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
    color: "#3a1e00",
  },
  readyBadge: {
    backgroundColor: "#4a7c3f",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  readyBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.5,
  },
  cookRowEffect: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7a5a30",
  },
  // Combined progress + timer bar — identical to FoodCard's cookBarTrack
  cookBarTrack: {
    height: 22,
    backgroundColor: "#ede0c4",
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
  },
  cookBarFill: {
    position: "absolute",
    left: 0, top: 0, bottom: 0,
    backgroundColor: "#c87820",
    borderRadius: 8,
  },
  cookBarLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    zIndex: 1,
  },
  cookBarText: { fontSize: 10, fontWeight: "800", color: "#3a2a10" },

  // ── Recipe grid ──
  grid: {
    paddingHorizontal: 10,
    paddingBottom: 30,
    gap: 10,
  },
  columnWrapper: {
    gap: 10,
  },

  // ── Empty state ──
  emptyCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyEmoji: { fontSize: 48 },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    color: "#b09060",
    fontWeight: "700",
  },
  emptySubText: {
    fontSize: 12,
    color: "#b09060",
    fontWeight: "600",
  },
});
