import { useRef, useEffect } from "react";
import { View, StyleSheet, Dimensions, Animated } from "react-native";
import { Champion, Farmer } from "../types";
import { RESOURCE_META } from "../constants/resources";

const { width: SCREEN_W } = Dimensions.get("window");

const ASSETS = {
  fire: require("../assets/home-assets/fire.png"),
  warrior: require("../assets/cats/warrior-cat.webp"),
  archer: require("../assets/cats/archer-cat.webp"),
  mage: require("../assets/cats/mage-cat.webp"),
};

type Props = {
  champions: Champion[];
  farmers?: Farmer[];
  showFarmers?: boolean;
};

// Shared slot geometry — farmer cats render at the exact same position as champion cats
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
  showFarmers = false,
}: Props) {
  const championOpacity = useRef(
    new Animated.Value(showFarmers ? 0 : 1),
  ).current;
  const farmerOpacity = useRef(new Animated.Value(showFarmers ? 1 : 0)).current;
  const fireOpacity = useRef(new Animated.Value(showFarmers ? 0 : 1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(championOpacity, {
        toValue: showFarmers ? 0 : 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(farmerOpacity, {
        toValue: showFarmers ? 1 : 0,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(fireOpacity, {
        toValue: showFarmers ? 0 : 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [showFarmers]);

  const warrior = champions.find((c) => c.class === "Warrior");
  const archer = champions.find((c) => c.class === "Archer");
  const mage = champions.find((c) => c.class === "Mage");

  const farmerByType: Record<string, Farmer> = {};
  for (const f of farmers) farmerByType[f.resource_type] = f;

  return (
    <View
      style={[styles.scene, { width: W, height: 300 }]}
      pointerEvents="none"
    >
      {/* ── Left slot: Warrior ↔ Strawberry ── */}
      {warrior && (
        <Animated.Image
          source={ASSETS.warrior}
          style={[styles.cat, SLOTS.left, { opacity: championOpacity }]}
          resizeMode="contain"
        />
      )}
      {farmerByType["strawberry"] && (
        <Animated.Image
          source={RESOURCE_META["strawberry"].catImage}
          style={[styles.cat, SLOTS.left, { opacity: farmerOpacity }]}
          resizeMode="contain"
        />
      )}

      {/* ── Center slot: Archer ↔ Pinecone ── */}
      {archer && (
        <Animated.Image
          source={ASSETS.archer}
          style={[styles.cat, SLOTS.center, { opacity: championOpacity }]}
          resizeMode="contain"
        />
      )}
      {farmerByType["pinecone"] && (
        <Animated.Image
          source={RESOURCE_META["pinecone"].catImage}
          style={[styles.cat, SLOTS.center, { opacity: farmerOpacity }]}
          resizeMode="contain"
        />
      )}

      {/* ── Right slot: Mage ↔ Blueberry (mirrored) ── */}
      {mage && (
        <Animated.Image
          source={ASSETS.mage}
          style={[
            styles.cat,
            SLOTS.right,
            { opacity: championOpacity, transform: [{ scaleX: -1 }] },
          ]}
          resizeMode="contain"
        />
      )}
      {farmerByType["blueberry"] && (
        <Animated.Image
          source={RESOURCE_META["blueberry"].catImage}
          style={[
            styles.cat,
            SLOTS.right,
            { opacity: farmerOpacity, transform: [{ scaleX: -1 }] },
          ]}
          resizeMode="contain"
        />
      )}

      {/* ── Fire — fades out when showing farmers ── */}
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
