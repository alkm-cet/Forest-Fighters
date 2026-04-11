import { useRef, useEffect, useState } from "react";
import {
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Text } from "./StyledText";
import { X, Timer, ChefHat } from "lucide-react-native";
import { PlayerFood } from "../types";
import { describeEffect, FOOD_EMOJIS } from "./FoodCard";

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type FoodContext = "fighter" | "farmer" | "animal";

const CONTEXT_LABEL: Record<FoodContext, string> = {
  fighter: "Fighters",
  farmer:  "Farmers",
  animal:  "Animals",
};

function targetLabel(target: string): string {
  if (target === "fighters")    return "Fighters only";
  if (target === "farmers")     return "Farmers only";
  if (target === "animals")     return "Animals only";
  if (target === "farm_animals") return "Farmers & Animals";
  return "All";
}

function isCompatible(target: string, context: FoodContext): boolean {
  if (target === "all") return true;
  if (context === "fighter") return target === "fighters";
  if (context === "farmer")  return target === "farmers" || target === "farm_animals";
  if (context === "animal")  return target === "animals" || target === "farm_animals";
  return false;
}

type Props = {
  visible: boolean;
  inventory: PlayerFood[];
  onClose: () => void;
  onUseFood: (food: PlayerFood) => void;
  context?: FoodContext;
};

// NOT a Modal — renders as an absolutely-positioned Animated.View so it can
// live inside ChampionDrawer's Modal without causing double-Modal touch issues.
export default function FoodInventoryDrawer({ visible, inventory, onClose, onUseFood, context = "fighter" }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const panelWidth = screenWidth * 0.72;
  const translateX = useRef(new Animated.Value(panelWidth)).current;

  // Tracks recipe_ids that have finished cooking locally (without waiting for a server re-fetch)
  const [locallyReadyIds, setLocallyReadyIds] = useState<Set<string>>(new Set());

  // Reset local promotions whenever fresh inventory arrives
  useEffect(() => {
    setLocallyReadyIds(new Set());
  }, [inventory]);

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: visible ? 0 : panelWidth,
      useNativeDriver: true,
      tension: 100,
      friction: 12,
    }).start();
  }, [visible, panelWidth]);

  function handleItemReady(recipeId: string) {
    setLocallyReadyIds((prev) => new Set([...prev, recipeId]));
  }

  // Override status for items whose timer has hit 0 locally
  const effectiveInventory = inventory.map((f) =>
    f.status === "cooking" && locallyReadyIds.has(f.recipe_id)
      ? { ...f, status: "ready" as const }
      : f
  );

  // Group by recipe_id — one card per unique recipe
  const readyGroups   = groupByRecipe(effectiveInventory.filter((f) => f.status === "ready"));
  const cookingGroups = groupByRecipe(effectiveInventory.filter((f) => f.status === "cooking"));

  const totalReady   = effectiveInventory.filter((f) => f.status === "ready").length;
  const totalCooking = effectiveInventory.filter((f) => f.status === "cooking").length;

  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents={visible ? "auto" : "none"}
    >
      {/* Left overlay — tapping it closes the drawer */}
      {visible && (
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={[styles.leftOverlay, { width: screenWidth - panelWidth }]} />
        </TouchableWithoutFeedback>
      )}

    <Animated.View
      style={[styles.panel, { width: panelWidth, transform: [{ translateX }] }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <ChefHat size={16} color="#9a7040" strokeWidth={2} />
        <Text style={styles.headerTitle}>Kitchen Bag</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <X size={14} color="#7a5230" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <View style={styles.headerDivider} />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Ready section */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionPill, { backgroundColor: "#4a7c3f" }]}>
            <Text style={styles.sectionPillText}>READY</Text>
          </View>
          <Text style={styles.sectionCount}>{totalReady}</Text>
        </View>

        {readyGroups.length === 0 ? (
          <Text style={styles.emptyText}>Nothing ready yet</Text>
        ) : (
          <View style={styles.grid}>
            {readyGroups.map(({ representative, count }) => (
              <FoodItem
                key={representative.recipe_id}
                food={representative}
                count={count}
                context={context}
                onUse={onUseFood}
              />
            ))}
          </View>
        )}

        {/* Cooking section */}
        <View style={[styles.sectionHeader, { marginTop: 14 }]}>
          <View style={[styles.sectionPill, { backgroundColor: "#c87820" }]}>
            <Text style={styles.sectionPillText}>COOKING</Text>
          </View>
          <Text style={styles.sectionCount}>{totalCooking}</Text>
        </View>

        {cookingGroups.length === 0 ? (
          <Text style={styles.emptyText}>Nothing cooking</Text>
        ) : (
          <View style={styles.grid}>
            {cookingGroups.map(({ representative, count }) => (
              <CookingItem
                key={representative.recipe_id}
                food={representative}
                count={count}
                context={context}
                onReady={handleItemReady}
              />
            ))}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </Animated.View>
    </View>
  );
}

// Groups foods by recipe_id. Representative = soonest finishing (for cooking) or first item.
function groupByRecipe(foods: PlayerFood[]): { representative: PlayerFood; count: number }[] {
  const map = new Map<string, PlayerFood[]>();
  foods.forEach((f) => {
    const group = map.get(f.recipe_id) ?? [];
    group.push(f);
    map.set(f.recipe_id, group);
  });
  return Array.from(map.values()).map((group) => {
    // Pick the one that finishes soonest as the representative
    const representative = group.reduce((best, cur) =>
      (cur.cooking_ready_at_ms ?? Infinity) < (best.cooking_ready_at_ms ?? Infinity) ? cur : best
    );
    return { representative, count: group.length };
  });
}

function FoodItem({ food, count, context, onUse }: {
  food: PlayerFood;
  count: number;
  context: FoodContext;
  onUse: (f: PlayerFood) => void;
}) {
  const emoji    = FOOD_EMOJIS[food.recipe.name] ?? "🍴";
  const enabled  = isCompatible(food.recipe.target, context);

  return (
    <TouchableOpacity
      style={[styles.foodItem, !enabled && styles.foodItemDisabled]}
      activeOpacity={enabled ? 0.8 : 1}
      onPress={() => enabled && onUse(food)}
    >
      {count > 1 && (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{count}</Text>
        </View>
      )}
      <View style={[styles.foodEmojiBg, !enabled && styles.foodEmojiBgDisabled]}>
        <Text style={[styles.foodEmoji, !enabled && styles.foodEmojiDisabled]}>{emoji}</Text>
      </View>
      <Text style={[styles.foodName, !enabled && styles.textDisabled]} numberOfLines={2}>
        {food.recipe.name}
      </Text>
      <View style={styles.effectChip}>
        <Text style={[styles.effectText, !enabled && styles.textDisabled]} numberOfLines={3}>
          {describeEffect(food.recipe)}
        </Text>
      </View>
      {enabled ? (
        <View style={styles.readyBadge}>
          <Text style={styles.readyBadgeText}>USE</Text>
        </View>
      ) : (
        <View style={styles.disabledBadge}>
          <Text style={styles.disabledBadgeText}>{targetLabel(food.recipe.target)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function CookingItem({ food, count, context, onReady }: {
  food: PlayerFood;
  count: number;
  context: FoodContext;
  onReady: (recipeId: string) => void;
}) {
  const emoji   = FOOD_EMOJIS[food.recipe.name] ?? "🍴";
  const enabled = isCompatible(food.recipe.target, context);
  const readyAt   = food.cooking_ready_at_ms;
  const startedAt = food.cooking_started_at_ms;
  const totalMs   = readyAt - startedAt;

  const [msLeft, setMsLeft] = useState(() => Math.max(0, readyAt - Date.now()));
  const promotedRef = useRef(false);

  useEffect(() => {
    promotedRef.current = false; // reset when food changes
  }, [food.recipe_id]);

  useEffect(() => {
    const iv = setInterval(() => {
      const left = Math.max(0, readyAt - Date.now());
      setMsLeft(left);
      if (left === 0 && !promotedRef.current) {
        promotedRef.current = true;
        onReady(food.recipe_id);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [readyAt, food.recipe_id]);

  const progress = totalMs > 0 ? Math.min(1 - msLeft / totalMs, 1) : 1;

  return (
    <View style={[styles.foodItem, styles.cookingItem, !enabled && styles.foodItemDisabled]}>
      {count > 1 && (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{count}</Text>
        </View>
      )}
      <View style={[styles.foodEmojiBg, !enabled && styles.foodEmojiBgDisabled]}>
        <Text style={[styles.foodEmoji, !enabled && styles.foodEmojiDisabled]}>{emoji}</Text>
      </View>
      <Text style={[styles.foodName, !enabled && styles.textDisabled]} numberOfLines={2}>
        {food.recipe.name}
      </Text>
      <View style={styles.effectChip}>
        <Text style={[styles.effectText, !enabled && styles.textDisabled]} numberOfLines={3}>
          {describeEffect(food.recipe)}
        </Text>
      </View>
      {!enabled && (
        <View style={styles.disabledBadge}>
          <Text style={styles.disabledBadgeText}>{targetLabel(food.recipe.target)}</Text>
        </View>
      )}
      <View style={styles.cookProgressTrack}>
        <View style={[styles.cookProgressFill, { width: `${progress * 100}%` as any }]} />
      </View>
      <View style={styles.cookTimerRow}>
        <Timer size={9} color="#9a7040" strokeWidth={2} />
        <Text style={styles.cookTimerText}>{formatTime(msLeft)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  leftOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    // transparent — just captures touches
  },
  panel: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#f5e9cc",
    borderLeftWidth: 2,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    borderColor: "#c8a96e",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: -4, height: 0 },
    elevation: 16,
    paddingTop: 52,
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    color: "#3a1e00",
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e8d5a8",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    alignItems: "center",
    justifyContent: "center",
  },
  headerDivider: {
    height: 1,
    backgroundColor: "#d4b896",
    marginHorizontal: 12,
    marginBottom: 12,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sectionPillText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: "800",
    color: "#9a7040",
  },
  emptyText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#b09060",
    textAlign: "center",
    paddingVertical: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  foodItem: {
    width: "47%",
    backgroundColor: "#f5edd8",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#d4b896",
    padding: 8,
    alignItems: "center",
    gap: 4,
    position: "relative",
  },
  countBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#c87820",
    borderWidth: 1.5,
    borderColor: "#f5edd8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    zIndex: 2,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#fff",
    lineHeight: 13,
  },
  cookingItem: {
    borderColor: "#c87820",
    borderStyle: "dashed",
  },
  foodEmojiBg: {
    width: 44,
    height: 44,
    backgroundColor: "#ede0c4",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  foodEmoji: { fontSize: 26 },
  foodName: {
    fontSize: 10,
    fontWeight: "800",
    color: "#3a2a10",
    textAlign: "center",
    lineHeight: 13,
  },
  effectChip: {
    width: "100%",
    backgroundColor: "#ede0c4",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  effectText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#7a5a30",
    textAlign: "center",
    lineHeight: 12,
  },
  // ── Disabled state ──
  foodItemDisabled: {
    opacity: 0.45,
  },
  foodEmojiBgDisabled: {
    backgroundColor: "#d4c9b0",
  },
  foodEmojiDisabled: {
    opacity: 0.6,
  },
  textDisabled: {
    color: "#a08060",
  },
  disabledBadge: {
    backgroundColor: "#b09060",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  disabledBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
  },
  readyBadge: {
    backgroundColor: "#4a7c3f",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  readyBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.5,
  },
  cookProgressTrack: {
    width: "100%",
    height: 6,
    backgroundColor: "#d4b896",
    borderRadius: 3,
    overflow: "hidden",
  },
  cookProgressFill: {
    height: "100%",
    backgroundColor: "#c87820",
    borderRadius: 3,
  },
  cookTimerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  cookTimerText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#9a7040",
  },
});
