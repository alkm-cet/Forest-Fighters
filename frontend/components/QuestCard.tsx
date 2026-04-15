import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRef } from "react";
import { Text } from "./StyledText";
import { CheckCircle2 } from "lucide-react-native";
import type { PlayerQuest } from "../types";

const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  pvp:      { emoji: "⚔️",  color: "#c0392b" },
  dungeon:  { emoji: "🏰",  color: "#8e44ad" },
  resource: { emoji: "🌿",  color: "#27ae60" },
  animal:   { emoji: "🐾",  color: "#e67e22" },
  cooking:  { emoji: "🍳",  color: "#d35400" },
  upgrade:  { emoji: "⬆️",  color: "#2980b9" },
};

const DIFFICULTY_LABEL: Record<string, string> = {
  easy:          "Easy",
  medium:        "Medium",
  action:        "Action",
  passive:       "Passive",
  weekly_easy:   "Easy",
  weekly_medium: "Medium",
  weekly_hard:   "Hard",
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy:          "#27ae60",
  medium:        "#e67e22",
  action:        "#c0392b",
  passive:       "#2980b9",
  weekly_easy:   "#27ae60",
  weekly_medium: "#e67e22",
  weekly_hard:   "#c0392b",
};

const COIN_IMG = require("../assets/icons/icon-coin.webp");

import { Image } from "react-native";

type Props = {
  quest: PlayerQuest;
  onClaim: (questId: string, pos: { x: number; y: number }) => void;
  isClaiming: boolean;
};

export default function QuestCard({ quest, onClaim, isClaiming }: Props) {
  const claimBtnRef = useRef<TouchableOpacity>(null);
  const { emoji, color } = CATEGORY_META[quest.category] ?? { emoji: "📋", color: "#7f8c8d" };
  const progress   = Math.min(quest.progress, quest.target_count);
  const fillPct    = quest.target_count > 0 ? (progress / quest.target_count) * 100 : 0;
  const isClaimed  = quest.status === "claimed";
  const isComplete = quest.status === "completed";
  const canClaim   = isComplete && !isClaiming;

  function handleClaimPress() {
    if (!canClaim) return;
    claimBtnRef.current?.measureInWindow((x, y, w, h) => {
      onClaim(quest.id, { x: x + w / 2, y: y + h / 2 });
    });
  }

  return (
    <View style={[styles.card, isClaimed && styles.cardClaimed]}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={[styles.categoryBadge, { backgroundColor: color + "22" }]}>
          <Text style={styles.categoryEmoji}>{emoji}</Text>
        </View>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, isClaimed && styles.titleClaimed]}>{quest.title}</Text>
          <Text style={styles.description}>{quest.description}</Text>
        </View>
        <View style={[styles.difficultyBadge, { backgroundColor: DIFFICULTY_COLOR[quest.difficulty] + "22" }]}>
          <Text style={[styles.difficultyText, { color: DIFFICULTY_COLOR[quest.difficulty] }]}>
            {DIFFICULTY_LABEL[quest.difficulty] ?? quest.difficulty}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${fillPct}%` as any, backgroundColor: isComplete || isClaimed ? "#4caf50" : color },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {progress}/{quest.target_count}
        </Text>
      </View>

      {/* Footer: reward + claim button */}
      <View style={styles.footerRow}>
        <View style={styles.rewardRow}>
          <Image source={COIN_IMG} style={styles.coinIcon} resizeMode="contain" />
          <Text style={styles.rewardText}>+{quest.reward_coins}</Text>
        </View>

        <TouchableOpacity
          ref={claimBtnRef}
          style={[
            styles.claimBtn,
            isComplete  && styles.claimBtnReady,
            isClaimed   && styles.claimBtnClaimed,
            !canClaim   && !isClaimed && styles.claimBtnDisabled,
          ]}
          onPress={handleClaimPress}
          disabled={!canClaim}
          activeOpacity={0.75}
        >
          {isClaiming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : isClaimed ? (
            <View style={styles.claimedInner}>
              <CheckCircle2 size={13} color="#4caf50" strokeWidth={2.5} />
              <Text style={styles.claimedText}>Claimed</Text>
            </View>
          ) : (
            <Text style={[styles.claimBtnText, isComplete && styles.claimBtnTextReady]}>
              {isComplete ? "Claim!" : "In Progress"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fffdf5",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e8dcc8",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardClaimed: {
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  categoryBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  categoryEmoji: {
    fontSize: 18,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3d2c1e",
    marginBottom: 2,
  },
  titleClaimed: {
    color: "#a09080",
  },
  description: {
    fontSize: 11,
    color: "#8a7060",
    lineHeight: 15,
  },
  difficultyBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
    flexShrink: 0,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: "700",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#e8dcc8",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 11,
    color: "#8a7060",
    minWidth: 32,
    textAlign: "right",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  coinIcon: {
    width: 16,
    height: 16,
  },
  rewardText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#c87820",
  },
  claimBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#d0c4b0",
    minWidth: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  claimBtnReady: {
    backgroundColor: "#4caf50",
  },
  claimBtnClaimed: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#c8d8c0",
  },
  claimBtnDisabled: {
    backgroundColor: "#d0c4b0",
  },
  claimBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8a7060",
  },
  claimBtnTextReady: {
    color: "#fff",
  },
  claimedInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  claimedText: {
    fontSize: 12,
    color: "#4caf50",
    fontWeight: "600",
  },
});
