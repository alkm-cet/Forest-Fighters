import { View, Image, StyleSheet } from "react-native";
import { Text } from "./StyledText";
import { CheckCircle2, Gift } from "lucide-react-native";
import type { DailyBonus } from "../types";

const COIN_IMG = require("../assets/icons/icon-coin.webp");

const RESOURCE_EMOJI: Record<string, string> = {
  egg:  "🥚",
  wool: "🧶",
  milk: "🥛",
};

type Props = {
  bonus: DailyBonus;
};

export default function QuestBonusBar({ bonus }: Props) {
  const { claimed_count, total, bonus_coins, bonus_amount, already_claimed } = bonus;
  const allClaimed = claimed_count >= total;

  return (
    <View style={[styles.container, already_claimed && styles.containerClaimed]}>
      {/* Left: progress dots */}
      <View style={styles.left}>
        <View style={styles.dotsRow}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i < claimed_count && styles.dotFilled]}
            />
          ))}
        </View>
        <Text style={styles.label}>
          {already_claimed
            ? "Daily bonus claimed!"
            : allClaimed
            ? "Claim all to earn bonus!"
            : `${claimed_count}/${total} daily quests claimed`}
        </Text>
      </View>

      {/* Right: bonus reward preview */}
      <View style={styles.rewardRow}>
        {already_claimed ? (
          <CheckCircle2 size={18} color="#4caf50" strokeWidth={2.5} />
        ) : (
          <Gift size={16} color={allClaimed ? "#c87820" : "#b0a090"} strokeWidth={2} />
        )}
        <Image source={COIN_IMG} style={styles.coinIcon} resizeMode="contain" />
        <Text style={[styles.rewardText, already_claimed && styles.rewardTextClaimed]}>
          +{bonus_coins}
        </Text>
        <Text style={[styles.resourceText, already_claimed && styles.rewardTextClaimed]}>
          {RESOURCE_EMOJI["egg"]}/{RESOURCE_EMOJI["wool"]}/{RESOURCE_EMOJI["milk"]} +{bonus_amount}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff8ec",
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#e8c87a",
  },
  containerClaimed: {
    backgroundColor: "#f0f8f0",
    borderColor: "#b8d8b0",
  },
  left: {
    flex: 1,
    gap: 5,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 5,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ddd0b8",
  },
  dotFilled: {
    backgroundColor: "#4caf50",
  },
  label: {
    fontSize: 11,
    color: "#8a7060",
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  coinIcon: {
    width: 14,
    height: 14,
  },
  rewardText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#c87820",
  },
  resourceText: {
    fontSize: 12,
    color: "#8a7060",
  },
  rewardTextClaimed: {
    color: "#4caf50",
  },
});
