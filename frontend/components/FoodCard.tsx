import { useEffect, useState } from "react";
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Text } from "./StyledText";
import { Timer } from "lucide-react-native";
import { Recipe, Resources } from "../types";
import { RESOURCE_META } from "../constants/resources";

const BOILER_IMG = require("../assets/boiler.webp");

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
  // legacy names kept for backward compat
  "Strawberry Jam":           "🍓",
  "Great Forest Feast":       "🍽️",
};

export function describeEffect(recipe: Recipe): string {
  const target =
    recipe.target === "fighters"      ? "Fighters"
    : recipe.target === "farmers"     ? "Farmers"
    : recipe.target === "animals"     ? "Animals"
    : recipe.target === "farm_animals"? "Farmers & Animals"
    : "All units";

  const dur = recipe.effect_duration_minutes
    ? ` for ${recipe.effect_duration_minutes} min`
    : " (next battle only)";

  switch (recipe.effect_type) {
    case "boost_hp":
      return `${target} gain +${recipe.effect_value} max HP${dur}`;
    case "boost_defense":
      return `${target} gain +${recipe.effect_value} DEF${dur}`;
    case "boost_chance":
      return `${target} gain +${recipe.effect_value} CRIT${dur}`;
    case "boost_production":
      return `${target} produce ${recipe.effect_value}% faster${dur}`;
    case "boost_all":
      return `${target} get ${recipe.effect_value}x production + combat boost${dur}`;
    case "boost_capacity":
      return `${target} storage +${recipe.effect_value} capacity${dur}`;
    default:
      return `${target} +${recipe.effect_value} ${recipe.effect_type.replace("boost_", "")}${dur}`;
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
};

export default function FoodCard({ recipe, resources, onCook, cookingReadyAtMs }: Props) {
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

      {/* Emoji */}
      <Text style={styles.emoji}>{emoji}</Text>

      {/* Name */}
      <Text style={styles.name} numberOfLines={2}>{recipe.name}</Text>

      {/* Effect */}
      <View style={styles.effectChip}>
        <Text style={styles.effectText} numberOfLines={2}>{describeEffect(recipe)}</Text>
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

      {/* Cook progress bar */}
      {isCooking && (
        <View style={styles.cookBarTrack}>
          <View style={[styles.cookBarFill, { width: `${progress * 100}%` as any }]} />
          <View style={styles.cookBarLabel}>
            <Timer size={10} color="#3a2a10" strokeWidth={2} />
            <Text style={styles.cookBarText}>{formatTime(msLeft / 1000)}</Text>
          </View>
        </View>
      )}

      {/* Cook button */}
      {!isCooking && (
        <TouchableOpacity
          style={[styles.cookBtn, !canAfford && styles.cookBtnDisabled]}
          activeOpacity={canAfford ? 0.75 : 1}
          onPress={() => canAfford && onCook(recipe)}
        >
          <Image source={BOILER_IMG} style={styles.boilerIcon} resizeMode="contain" />
          <Text style={styles.cookBtnText}>
            {canAfford ? "Cook" : "Not enough"}
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
});
