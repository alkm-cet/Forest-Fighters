import { View, Image, StyleSheet, Dimensions } from "react-native";
import { Champion } from "../types";

const { width: SCREEN_W } = Dimensions.get("window");

// Fixed asset sources
const ASSETS = {
  fire: require("../assets/home-assets/fire.png"),
  warrior: require("../assets/cats/warrior-cat.webp"),
  archer: require("../assets/cats/archer-cat.webp"),
  mage: require("../assets/cats/mage-cat.webp"),
};

const CAT_BY_CLASS: Record<string, keyof typeof ASSETS> = {
  Warrior: "warrior",
  Archer: "archer",
  Mage: "mage",
};

type Props = {
  champions: Champion[];
};

export default function CampfireScene({ champions }: Props) {
  const warrior = champions.find((c) => c.class === "Warrior");
  const archer = champions.find((c) => c.class === "Archer");
  const mage = champions.find((c) => c.class === "Mage");

  const W = SCREEN_W;
  const H = 300;
  const cx = W / 2;

  // Extra bottom padding so the scene looks vertically centered
  // when champion cards sit below it
  const B = 50;

  // Fire — center, sits at bottom padding level
  const fireW = 100;
  const fireH = 135;
  const fireLeft = cx - fireW / 2;
  const fireBottom = B + 33;

  // Archer — center behind fire, base overlaps top of fire stones
  const archerW = 100;
  const archerH = 100;
  const archerLeft = cx - archerW / 2;
  const archerBottom = B + fireH - 22;

  // Warrior — left, close to fire, same ground level as fire base
  const warriorW = 110;
  const warriorH = 100;
  const warriorLeft = cx - 140;
  const warriorBottom = B + fireH - 82;

  // Mage — right, close to fire, same ground level
  const mageW = 110;
  const mageH = 100;
  const mageLeft = cx + 25;
  const mageBottom = B + fireH - 82;

  return (
    <View style={[styles.scene, { width: W, height: H }]} pointerEvents="none">
      {/* Archer — behind fire (rendered first = lower z) */}
      {archer && (
        <Image
          source={ASSETS[CAT_BY_CLASS[archer.class]]}
          style={[
            styles.cat,
            {
              width: archerW,
              height: archerH,
              left: archerLeft,
              bottom: archerBottom,
              zIndex: 1,
            },
          ]}
          resizeMode="contain"
        />
      )}

      {/* Warrior — left */}
      {warrior && (
        <Image
          source={ASSETS[CAT_BY_CLASS[warrior.class]]}
          style={[
            styles.cat,
            {
              width: warriorW,
              height: warriorH,
              left: warriorLeft,
              bottom: warriorBottom,
              zIndex: 2,
            },
          ]}
          resizeMode="contain"
        />
      )}

      {/* Mage — right */}
      {mage && (
        <Image
          source={ASSETS[CAT_BY_CLASS[mage.class]]}
          style={[
            styles.cat,
            {
              width: mageW,
              height: mageH,
              left: mageLeft,
              bottom: mageBottom,
              zIndex: 2,
              transform: [{ scaleX: -1 }],
            },
          ]}
          resizeMode="contain"
        />
      )}

      {/* Fire — front center, highest z */}
      <Image
        source={ASSETS.fire}
        style={[
          styles.cat,
          {
            width: fireW,
            height: fireH,
            left: fireLeft,
            bottom: fireBottom,
            zIndex: 3,
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
