import { View, Image, Text, StyleSheet } from "react-native";
import { Champion } from "../types";
import { CLASS_META } from "../constants/resources";

type Props = {
  champions: Champion[];
};

const CAT_IMAGES: Record<string, ReturnType<typeof require>> = {
  Warrior: require("../assets/cats/warrior-cat.webp"),
  Archer:  require("../assets/cats/archer-cat.webp"),
  Mage:    require("../assets/cats/mage-cat.webp"),
};

// Fallback order if DB doesn't have exactly Warrior/Archer/Mage
const SLOT_ORDER = ["Warrior", "Archer", "Mage"];

export default function CampfireScene({ champions }: Props) {
  // Map champions to slots by class; fall back to whatever we have
  const slots = SLOT_ORDER.map(
    (cls) => champions.find((c) => c.class === cls) ?? null
  );

  return (
    <View style={styles.scene}>

      {/* Left cat — Warrior */}
      <View style={[styles.catSlot, styles.leftSlot]}>
        {slots[0] && (
          <Image
            source={CAT_IMAGES[slots[0].class]}
            style={styles.catLeft}
            resizeMode="contain"
          />
        )}
      </View>

      {/* Center — Archer above fire */}
      <View style={styles.centerColumn}>
        {slots[1] && (
          <Image
            source={CAT_IMAGES[slots[1].class]}
            style={styles.catCenter}
            resizeMode="contain"
          />
        )}

        {/* Campfire */}
        <View style={styles.fireContainer}>
          <View style={styles.stoneRing}>
            <View style={styles.emberGlow} />
            <Text style={styles.fireEmoji}>🔥</Text>
          </View>
        </View>
      </View>

      {/* Right cat — Mage */}
      <View style={[styles.catSlot, styles.rightSlot]}>
        {slots[2] && (
          <Image
            source={CAT_IMAGES[slots[2].class]}
            style={styles.catRight}
            resizeMode="contain"
          />
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  // Left — Warrior
  catSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  leftSlot: {
    paddingBottom: 28,
  },
  catLeft: {
    width: 90,
    height: 100,
    transform: [{ scaleX: 1 }],
  },

  // Center column — Archer + fire
  centerColumn: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  catCenter: {
    width: 110,
    height: 120,
    marginBottom: -8,
    zIndex: 2,
  },

  // Fire
  fireContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
  },
  stoneRing: {
    width: 72,
    height: 44,
    borderRadius: 36,
    backgroundColor: "#8a7560",
    borderWidth: 3,
    borderColor: "#6b5a42",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  emberGlow: {
    position: "absolute",
    width: 52,
    height: 28,
    borderRadius: 26,
    backgroundColor: "#ff8c00",
    opacity: 0.45,
  },
  fireEmoji: {
    fontSize: 30,
    marginTop: -10,
    zIndex: 3,
  },

  // Right — Mage
  rightSlot: {
    paddingBottom: 28,
  },
  catRight: {
    width: 90,
    height: 100,
  },
});
