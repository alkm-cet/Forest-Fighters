import {
  View,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { Animated } from "react-native";
import { Champion, Farmer, Animal } from "../types";

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

type Props = {
  champions: Champion[];
  farmers?: Farmer[];
  animals?: Animal[];
  activeTab?: string;
  /** @deprecated */
  showFarmers?: boolean;
  closedEyesCat?: string | null;
  onCatPress?: (championClass: string) => void;
};

const W = SCREEN_W;
const cx = W / 2;
const B = 50;
const fireH = 135;

const SLOTS = {
  left:   { width: 110, height: 100, left: cx - 140, bottom: B + fireH - 82, zIndex: 2 },
  center: { width: 100, height: 100, left: cx - 50,  bottom: B + fireH - 22, zIndex: 1 },
  right:  { width: 110, height: 100, left: cx + 25,  bottom: B + fireH - 82, zIndex: 2 },
};

export default function CampfireScene({
  champions,
  closedEyesCat = null,
  onCatPress,
}: Props) {
  const warrior = champions.find((c) => c.class === "Warrior");
  const archer  = champions.find((c) => c.class === "Archer");
  const mage    = champions.find((c) => c.class === "Mage");

  return (
    <View style={[styles.scene, { width: W, height: 300 }]} pointerEvents="box-none">
      {/* Left — Warrior */}
      {warrior && (
        <TouchableWithoutFeedback onPress={() => onCatPress?.("Warrior")}>
          <Animated.Image
            source={closedEyesCat === "Warrior" ? ASSETS.warrior_closed : ASSETS.warrior}
            style={[styles.cat, SLOTS.left]}
            resizeMode="contain"
          />
        </TouchableWithoutFeedback>
      )}

      {/* Center — Archer */}
      {archer && (
        <TouchableWithoutFeedback onPress={() => onCatPress?.("Archer")}>
          <Animated.Image
            source={closedEyesCat === "Archer" ? ASSETS.archer_closed : ASSETS.archer}
            style={[styles.cat, SLOTS.center]}
            resizeMode="contain"
          />
        </TouchableWithoutFeedback>
      )}

      {/* Right — Mage */}
      {mage && (
        <TouchableWithoutFeedback onPress={() => onCatPress?.("Mage")}>
          <Animated.Image
            source={closedEyesCat === "Mage" ? ASSETS.mage_closed : ASSETS.mage}
            style={[styles.cat, SLOTS.right, { transform: [{ scaleX: -1 }] }]}
            resizeMode="contain"
          />
        </TouchableWithoutFeedback>
      )}

      {/* Fire */}
      <Animated.Image
        source={ASSETS.fire}
        style={[styles.cat, { width: 100, height: fireH, left: cx - 50, bottom: B + 33, zIndex: 3 }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { position: "relative" },
  cat:   { position: "absolute" },
});
