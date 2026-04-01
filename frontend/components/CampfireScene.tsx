import { useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
} from "react-native";
import { Champion, Farmer, Animal } from "../types";
import { RESOURCE_META, ANIMAL_META } from "../constants/resources";

const { width: SCREEN_W } = Dimensions.get("window");

const ASSETS = {
  fire: require("../assets/home-assets/fire.png"),
  warrior:        require("../assets/cats/warrior-cat.webp"),
  warrior_closed: require("../assets/cats/warrior-cat-closed-eyes.png"),
  archer:         require("../assets/cats/archer-cat.webp"),
  archer_closed:  require("../assets/cats/archer-cat-closed-eyes.png"),
  mage:           require("../assets/cats/mage-cat.webp"),
  mage_closed:    require("../assets/cats/mage-cat-closed-eyes.png"),
};

type ActiveTab = "champions" | "farmers" | "animals";

type Props = {
  champions: Champion[];
  farmers?: Farmer[];
  animals?: Animal[];
  activeTab?: ActiveTab;
  /** @deprecated use activeTab instead */
  showFarmers?: boolean;
  closedEyesCat?: string | null;
  onCatPress?: (championClass: string) => void;
};

// Shared slot geometry — all layers render at the same positions
const W = SCREEN_W;
const cx = W / 2;
const B = 50;
const fireH = 135;

const SLOTS = {
  left: {
    width: 110,
    height: 100,
    left: cx - 140,
    bottom: B + fireH - 82,
    zIndex: 2,
  },
  center: {
    width: 100,
    height: 100,
    left: cx - 50,
    bottom: B + fireH - 22,
    zIndex: 1,
  },
  right: {
    width: 110,
    height: 100,
    left: cx + 25,
    bottom: B + fireH - 82,
    zIndex: 2,
  },
};

export default function CampfireScene({
  champions,
  farmers = [],
  animals = [],
  activeTab,
  showFarmers = false,
  closedEyesCat = null,
  onCatPress,
}: Props) {
  // Resolve active tab from either prop
  const tab: ActiveTab = activeTab ?? (showFarmers ? "farmers" : "champions");

  const championOpacity = useRef(new Animated.Value(tab === "champions" ? 1 : 0)).current;
  const farmerOpacity   = useRef(new Animated.Value(tab === "farmers"   ? 1 : 0)).current;
  const animalOpacity   = useRef(new Animated.Value(tab === "animals"   ? 1 : 0)).current;
  const fireOpacity     = useRef(new Animated.Value(tab === "champions" ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(championOpacity, { toValue: tab === "champions" ? 1 : 0, duration: 280, useNativeDriver: true }),
      Animated.timing(farmerOpacity,   { toValue: tab === "farmers"   ? 1 : 0, duration: 280, useNativeDriver: true }),
      Animated.timing(animalOpacity,   { toValue: tab === "animals"   ? 1 : 0, duration: 280, useNativeDriver: true }),
      Animated.timing(fireOpacity,     { toValue: tab === "champions" ? 1 : 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [tab]);

  const warrior = champions.find((c) => c.class === "Warrior");
  const archer  = champions.find((c) => c.class === "Archer");
  const mage    = champions.find((c) => c.class === "Mage");

  const farmerByType: Record<string, Farmer> = {};
  for (const f of farmers) farmerByType[f.resource_type] = f;

  const animalByType: Record<string, Animal> = {};
  for (const a of animals) animalByType[a.animal_type] = a;

  return (
    <View
      style={[styles.scene, { width: W, height: 300 }]}
      pointerEvents="box-none"
    >
      {/* ── Left slot: Warrior ↔ Strawberry Farmer ↔ Chicken ── */}
      {warrior && (
        <TouchableWithoutFeedback onPress={() => onCatPress?.("Warrior")}>
          <Animated.Image
            source={closedEyesCat === "Warrior" ? ASSETS.warrior_closed : ASSETS.warrior}
            style={[styles.cat, SLOTS.left, { opacity: championOpacity }]}
            resizeMode="contain"
          />
        </TouchableWithoutFeedback>
      )}
      {farmerByType["strawberry"] && (
        <Animated.Image
          source={RESOURCE_META["strawberry"].catImage}
          style={[styles.cat, SLOTS.left, { opacity: farmerOpacity }]}
          resizeMode="contain"
        />
      )}
      {animalByType["chicken"] && (
        <Animated.Image
          source={ANIMAL_META["chicken"].image}
          style={[styles.cat, SLOTS.left, { opacity: animalOpacity }]}
          resizeMode="contain"
        />
      )}

      {/* ── Center slot: Archer ↔ Pinecone Farmer ↔ Sheep ── */}
      {archer && (
        <TouchableWithoutFeedback onPress={() => onCatPress?.("Archer")}>
          <Animated.Image
            source={closedEyesCat === "Archer" ? ASSETS.archer_closed : ASSETS.archer}
            style={[styles.cat, SLOTS.center, { opacity: championOpacity }]}
            resizeMode="contain"
          />
        </TouchableWithoutFeedback>
      )}
      {farmerByType["pinecone"] && (
        <Animated.Image
          source={RESOURCE_META["pinecone"].catImage}
          style={[styles.cat, SLOTS.center, { opacity: farmerOpacity }]}
          resizeMode="contain"
        />
      )}
      {animalByType["sheep"] && (
        <Animated.Image
          source={ANIMAL_META["sheep"].image}
          style={[styles.cat, SLOTS.center, { opacity: animalOpacity }]}
          resizeMode="contain"
        />
      )}

      {/* ── Right slot: Mage ↔ Blueberry Farmer ↔ Cow (mirrored) ── */}
      {mage && (
        <TouchableWithoutFeedback onPress={() => onCatPress?.("Mage")}>
          <Animated.Image
            source={closedEyesCat === "Mage" ? ASSETS.mage_closed : ASSETS.mage}
            style={[styles.cat, SLOTS.right, { opacity: championOpacity, transform: [{ scaleX: -1 }] }]}
            resizeMode="contain"
          />
        </TouchableWithoutFeedback>
      )}
      {farmerByType["blueberry"] && (
        <Animated.Image
          source={RESOURCE_META["blueberry"].catImage}
          style={[styles.cat, SLOTS.right, { opacity: farmerOpacity, transform: [{ scaleX: -1 }] }]}
          resizeMode="contain"
        />
      )}
      {animalByType["cow"] && (
        <Animated.Image
          source={ANIMAL_META["cow"].image}
          style={[styles.cat, SLOTS.right, { opacity: animalOpacity, transform: [{ scaleX: -1 }] }]}
          resizeMode="contain"
        />
      )}

      {/* ── Fire — only visible on champions tab ── */}
      <Animated.Image
        source={ASSETS.fire}
        style={[
          styles.cat,
          {
            width: 100,
            height: fireH,
            left: cx - 50,
            bottom: B + 33,
            zIndex: 3,
            opacity: fireOpacity,
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    position: "relative",
  },
  cat: {
    position: "absolute",
  },
});
