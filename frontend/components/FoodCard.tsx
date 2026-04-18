import { useEffect, useState } from "react";
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Text } from "./StyledText";
import { Timer, Zap } from "lucide-react-native";
import { Recipe, Resources } from "../types";
import { RESOURCE_META } from "../constants/resources";
import type { TranslationKeys } from "../lib/i18n";
import { useLanguage } from "../lib/i18n";

const COIN_IMG = require("../assets/icons/icon-coin.webp");

const BOILER_IMG = require("../assets/boiler.webp");

export const FORGE_STONE_IMGS: Record<string, any> = {
  "Forge Stone":        require("../assets/firestone-t1.webp"),
  "Fine Forge Stone":   require("../assets/firestone-t2.webp"),
  "Master Forge Stone": require("../assets/firestone-t3.webp"),
};

const TIER_COLORS: Record<number, string> = {
  1: "#5a8a3c",
  2: "#c87820",
  3: "#9b3fc8",
};

const TARGET_META: Record<string, { label: string; color: string }> = {
  fighters:    { label: "Warriors",       color: "#c0392b" },
  farmers:     { label: "Farmers",        color: "#2980b9" },
  animals:     { label: "Animals",        color: "#27ae60" },
  farm_animals:{ label: "Farm & Animals", color: "#16a085" },
  all:         { label: "All",            color: "#7f8c8d" },
};

export const FOOD_EMOJIS: Record<string, string> = {
  // v2 recipes
  "Forest Berry Jam":         "🍓",
  "Blueberry Mash":           "🫐",
  "Pinecone Tea":             "🍵",
  "Mixed Berry Pie":          "🥧",
  "Egg Forest Rice":          "🍚",
  "Pinecone Cake":            "🎂",
  "Forest Stew":              "🍲",
  "Magic Forest Soup":        "✨",
  "Ironbark Stew":            "🥘",
  "Dragon Pinecone Delight":  "🐉",
  "Mystic Wool Dessert":      "🧁",
  // warrior defense recipes
  "Forest Warrior Brew":      "🛡️",
  "Shield Bark Soup":         "⚔️",
  "Titanwood Feast":          "🪖",
  // attack boost recipes
  "Wild Berry Tonic":         "🍹",
  "Spiced Pinecone Brew":     "🌶️",
  "Battle Berry Stew":        "⚔️",
  "Ironbark Attack Broth":    "🪵",
  "Dragon's Wrath Elixir":    "🐉",
  "Ancient Forest Rage":      "🌿",
  // forge stones
  "Forge Stone":              "🔨",
  "Fine Forge Stone":         "⚒️",
  "Master Forge Stone":       "🔥",
  // legacy names kept for backward compat
  "Strawberry Jam":           "🍓",
  "Great Forest Feast":       "🍽️",
};

export function describeEffect(recipe: Recipe, t?: (key: TranslationKeys) => string): string {
  if (recipe.effect_type === "gear_upgrade") {
    const gearTier = (recipe as any).gear_upgrade_tier as number | undefined;
    if (gearTier === 3) return t ? t("forgeStoneAnyDesc") : "Upgrades any tier gear by 1 level";
    if (gearTier === 2) return t ? t("forgeStoneT2Desc") : "Upgrades Tier 2 gear by 1 level";
    return t ? t("forgeStoneT1Desc") : "Upgrades Tier 1 gear by 1 level";
  }

  const target =
    recipe.target === "fighters"       ? (t ? t("targetFighters")    : "Fighters")
    : recipe.target === "farmers"      ? (t ? t("targetFarmers")     : "Farmers")
    : recipe.target === "animals"      ? (t ? t("targetAnimals")     : "Animals")
    : recipe.target === "farm_animals" ? (t ? t("targetFarmAnimals") : "Farmers & Animals")
    : (t ? t("targetAll") : "All units");

  const minLabel = t ? t("minuteAbbr") : "min";
  const dur = recipe.effect_duration_minutes
    ? ` (${recipe.effect_duration_minutes} ${minLabel})`
    : "";

  switch (recipe.effect_type) {
    case "boost_hp":       return `${target} +${recipe.effect_value} HP${dur}`;
    case "boost_attack":   return `${target} +${recipe.effect_value} ATK${dur}`;
    case "boost_defense":  return `${target} +${recipe.effect_value} DEF${dur}`;
    case "boost_chance":   return `${target} +${recipe.effect_value} CRIT${dur}`;
    case "boost_production": return `${target} +${recipe.effect_value}% üretim${dur}`;
    case "boost_all":      return `${target} ×${recipe.effect_value} boost${dur}`;
    case "boost_capacity": return `${target} +${recipe.effect_value} kapasite${dur}`;
    default:               return `${target} +${recipe.effect_value} ${recipe.effect_type.replace("boost_", "")}${dur}`;
  }
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

type Props = {
  recipe: Recipe;
  resources: Resources;
  onCook: (recipe: Recipe) => void;
  /** Unix ms when this recipe finishes cooking. Null = not cooking. */
  cookingReadyAtMs?: number | null;
  /** player_food.id of the currently cooking item (needed for instant cook) */
  cookingFoodId?: string | null;
  /** Coins the player currently has */
  coins?: number;
  /** Called when player taps "Hemen Pişir" — parent handles coin confirm + API call */
  onInstantCook?: (foodId: string, coinCost: number) => void;
};

export default function FoodCard({ recipe, resources, onCook, cookingReadyAtMs, cookingFoodId, coins = 0, onInstantCook }: Props) {
  const { t } = useLanguage();
  const tierColor  = TIER_COLORS[recipe.tier] ?? "#9a7040";
  const targetMeta = TARGET_META[recipe.target] ?? TARGET_META.all;
  const emoji = FOOD_EMOJIS[recipe.name] ?? "🍴";
  const isCooking = !!cookingReadyAtMs && cookingReadyAtMs > Date.now();

  const canAfford = Object.entries(recipe.ingredients).every(([res, amt]) =>
    ((resources as any)[res] ?? 0) >= (amt ?? 0)
  );

  const cookTotalMs = recipe.cook_duration_minutes * 60 * 1000;
  const [msLeft, setMsLeft] = useState(() =>
    cookingReadyAtMs ? Math.max(0, cookingReadyAtMs - Date.now()) : 0
  );

  useEffect(() => {
    if (!cookingReadyAtMs) { setMsLeft(0); return; }
    setMsLeft(Math.max(0, cookingReadyAtMs - Date.now()));
    const iv = setInterval(() => setMsLeft(Math.max(0, cookingReadyAtMs - Date.now())), 1000);
    return () => clearInterval(iv);
  }, [cookingReadyAtMs]);

  const progress = cookTotalMs > 0 ? Math.min(1 - msLeft / cookTotalMs, 1) : 0;

  return (
    <View style={styles.card}>
      {/* Top badges row */}
      <View style={styles.badgeRow}>
        <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
          <Text style={styles.tierText}>T{recipe.tier}</Text>
        </View>
        <View style={[styles.targetBadge, { backgroundColor: targetMeta.color }]}>
          <Text style={styles.targetText}>{targetMeta.label}</Text>
        </View>
        <View style={styles.cookTimeChip}>
          <Timer size={9} color="#9a7040" strokeWidth={2.5} />
          <Text style={styles.cookTimeText}>{recipe.cook_duration_minutes}m</Text>
        </View>
      </View>

      {/* Emoji / item image */}
      {FORGE_STONE_IMGS[recipe.name]
        ? <Image source={FORGE_STONE_IMGS[recipe.name]} style={styles.itemImg} resizeMode="contain" />
        : <Text style={styles.emoji}>{emoji}</Text>
      }

      {/* Name */}
      <Text style={styles.name} numberOfLines={2}>{recipe.name}</Text>

      {/* Effect */}
      <View style={styles.effectChip}>
        <Text style={styles.effectText} numberOfLines={2}>{describeEffect(recipe, t)}</Text>
      </View>

      {/* Ingredients */}
      <View style={styles.ingredientRow}>
        {Object.entries(recipe.ingredients).map(([res, amt]) => {
          const meta = RESOURCE_META[res];
          const short = ((resources as any)[res] ?? 0) < (amt ?? 0);
          return (
            <View key={res} style={styles.ingredientItem}>
              {meta?.image ? (
                <Image source={meta.image} style={styles.ingredientIcon} resizeMode="contain" />
              ) : null}
              <Text style={[styles.ingredientAmt, short && styles.ingredientShort]}>
                {amt}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Cook progress bar + instant cook button */}
      {isCooking && (
        <>
          <View style={styles.cookBarTrack}>
            <View style={[styles.cookBarFill, { width: `${progress * 100}%` as any }]} />
            <View style={styles.cookBarLabel}>
              <Timer size={10} color="#3a2a10" strokeWidth={2} />
              <Text style={styles.cookBarText}>{formatTime(msLeft / 1000)}</Text>
            </View>
          </View>
          {cookingFoodId && onInstantCook && (() => {
            const coinCost = Math.max(1, Math.ceil(msLeft / 60000));
            const canAffordInstant = coins >= coinCost;
            return (
              <TouchableOpacity
                style={[styles.instantBtn, !canAffordInstant && styles.instantBtnDisabled]}
                activeOpacity={canAffordInstant ? 0.75 : 1}
                onPress={() => canAffordInstant && onInstantCook(cookingFoodId, coinCost)}
              >
                <Zap size={11} color={canAffordInstant ? "#fff" : "rgba(255,255,255,0.5)"} strokeWidth={2.5} />
                <Text style={styles.instantBtnText}>{t("instantCookBtn")}</Text>
                <View style={styles.instantCostRow}>
                  <Image source={COIN_IMG} style={styles.instantCoinIcon} resizeMode="contain" />
                  <Text style={styles.instantCostText}>×{coinCost}</Text>
                </View>
              </TouchableOpacity>
            );
          })()}
        </>
      )}

      {/* Spacer — pushes cook button to the bottom of the card */}
      <View style={styles.spacer} />

      {/* Cook button */}
      {!isCooking && (
        <TouchableOpacity
          style={[styles.cookBtn, !canAfford && styles.cookBtnDisabled]}
          activeOpacity={canAfford ? 0.75 : 1}
          onPress={() => canAfford && onCook(recipe)}
        >
          <Image source={BOILER_IMG} style={styles.boilerIcon} resizeMode="contain" />
          <Text style={styles.cookBtnText}>
            {canAfford ? t("cookBtn") : t("notEnoughIngredients")}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#f5edd8",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#d4b896",
    overflow: "hidden",
    padding: 10,
    alignItems: "center",
    gap: 6,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "stretch",
    flexWrap: "wrap",
  },
  tierBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tierText: { fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  targetBadge: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flex: 1,
  },
  targetText: { fontSize: 8, fontWeight: "800", color: "#fff", letterSpacing: 0.1 },
  cookTimeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#ede0c4",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  cookTimeText: { fontSize: 9, fontWeight: "700", color: "#9a7040" },
  emoji: {
    fontSize: 42,
    lineHeight: 52,
    textAlign: "center",
  },
  itemImg: {
    width: 52,
    height: 52,
    alignSelf: "center",
  },
  name: {
    fontSize: 12,
    fontWeight: "900",
    color: "#3a2a10",
    textAlign: "center",
    lineHeight: 15,
  },
  effectChip: {
    backgroundColor: "#ede0c4",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "stretch",
  },
  effectText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#7a5a30",
    lineHeight: 13,
    textAlign: "center",
  },
  ingredientRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    justifyContent: "center",
  },
  ingredientItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#ede0c4",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  ingredientIcon: { width: 13, height: 13 },
  ingredientAmt: { fontSize: 10, fontWeight: "800", color: "#3a2a10" },
  ingredientShort: { color: "#c0392b" },
  cookBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#4a7c3f",
    borderWidth: 1.5,
    borderColor: "#2d5a24",
    borderRadius: 10,
    paddingVertical: 7,
    alignSelf: "stretch",
  },
  cookBtnDisabled: { backgroundColor: "#9a7040", borderColor: "#7a5030" },
  boilerIcon: { width: 18, height: 18 },
  cookBtnText: { fontSize: 11, fontWeight: "900", color: "#fff" },
  spacer: { flex: 1 },
  cookBarTrack: {
    height: 22,
    backgroundColor: "#ede0c4",
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
    alignSelf: "stretch",
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
  instantBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#7a5a9a",
    borderWidth: 1.5,
    borderColor: "#5a3a7a",
    borderRadius: 9,
    paddingVertical: 5,
    alignSelf: "stretch",
  },
  instantBtnDisabled: { backgroundColor: "#9a8060", borderColor: "#7a6040" },
  instantBtnText: { fontSize: 10, fontWeight: "900", color: "#fff" },
  instantCostRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  instantCoinIcon: { width: 12, height: 12 },
  instantCostText: { fontSize: 10, fontWeight: "800", color: "rgba(255,255,255,0.85)" },
});
