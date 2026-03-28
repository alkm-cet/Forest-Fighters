import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { Text } from "./StyledText";
import { RESOURCE_META } from "../constants/resources";

type Props = {
  amount: number;
  resourceType: string;
  farmerIndex: number;
  screenWidth: number;
  onDone: () => void;
};

const FLOATER_WIDTH = 80;
const CARD_HEIGHT = 130;
const CARD_PADDING_H = 12;
const CARD_GAP = 8;

export default function CollectFloater({ amount, resourceType, farmerIndex, screenWidth, onDone }: Props) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const meta = RESOURCE_META[resourceType];

  // Calculate center X of the farmer card at farmerIndex
  const cardWidth = (screenWidth - CARD_PADDING_H * 2 - CARD_GAP * 2) / 3;
  const cardCenterX = CARD_PADDING_H + farmerIndex * (cardWidth + CARD_GAP) + cardWidth / 2;
  const left = cardCenterX - FLOATER_WIDTH / 2;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -160,
        duration: 2000,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View
      style={[
        styles.floater,
        {
          left,
          bottom: CARD_HEIGHT + 8,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="none"
    >
      {meta?.image && (
        <Image source={meta.image} style={styles.icon} resizeMode="contain" />
      )}
      <Text style={styles.label}>+{amount}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floater: {
    position: "absolute",
    width: FLOATER_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "rgba(245,233,204,0.95)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  icon: {
    width: 20,
    height: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: "800",
    color: "#3a1e00",
  },
});
