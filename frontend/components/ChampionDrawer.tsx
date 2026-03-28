import { useRef, useEffect } from "react";
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  PanResponder,
} from "react-native";
import { Text } from "./StyledText";
import { X, Swords, Gift, MapPin, Heart, Sparkles } from "lucide-react-native";
import { Champion, DungeonRun, Resources } from "../types";
import { CLASS_META } from "../constants/resources";
import { useLanguage } from "../lib/i18n";

import PvpBattleButton from "./PvpBattleButton";
import EnterDungeonButton from "./EnterDungeonButton";
import CountdownTimer from "./CountdownTimer";

const REVIVE_COST = 3;

type Props = {
  champion: Champion | null;
  resources?: Resources;
  onClose: () => void;
  onPvp: (champion: Champion) => void;
  onDungeon: (champion: Champion) => void;
  claimableRun?: DungeonRun;
  isOnMission?: boolean;
  activeRunEndsAt?: string;
  onClaim?: (run: DungeonRun) => void;
  onRevive?: (champion: Champion) => void;
  onHeal?: (champion: Champion) => void;
};

const STAT_MAX = 100;
const DISMISS_THRESHOLD = 100;

function StatRow({ label, value }: { label: string; value: number }) {
  const pct = Math.min(value / STAT_MAX, 1);
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${Math.round(pct * 100)}%` as any },
          ]}
        />
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function ChampionDrawer({
  champion,
  resources,
  onClose,
  onPvp,
  onDungeon,
  claimableRun,
  isOnMission,
  activeRunEndsAt,
  onClaim,
  onRevive,
  onHeal,
}: Props) {
  const { t } = useLanguage();
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (champion) translateY.setValue(0);
  }, [champion]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > DISMISS_THRESHOLD || gs.vy > 0.6) {
          Animated.timing(translateY, {
            toValue: 800,
            duration: 180,
            useNativeDriver: true,
          }).start(() => onClose());
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 10,
          }).start();
        }
      },
    }),
  ).current;

  if (!champion) return null;

  const meta = CLASS_META[champion.class] ?? {
    image: null,
    color: "#888",
    cost: 0,
  };

  return (
    <Modal
      visible={!!champion}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Transparent backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.drawer, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        {/* Top bar: handle centered, close button on right */}
        <View style={styles.topBar}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <X size={14} color="#7a5230" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Class badge + level */}
        <View style={styles.headerRow}>
          <View style={styles.classBadge}>
            <Text style={styles.classBadgeText}>
              {champion.class.toUpperCase()}
            </Text>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeLabel}>LV</Text>
            <Text style={styles.levelBadgeNum}>{champion.level}</Text>
          </View>
        </View>

        {/* XP progress bar */}
        <View style={styles.xpRow}>
          <View style={styles.xpBarTrack}>
            <View
              style={[
                styles.xpBarFill,
                {
                  width: `${Math.min(
                    100,
                    Math.round((champion.xp / champion.xp_to_next_level) * 100)
                  )}%` as any,
                },
              ]}
            />
          </View>
          <Text style={styles.xpLabel}>
            {champion.xp} / {champion.xp_to_next_level} XP
          </Text>
        </View>

        {/* Champion name */}
        <Text style={styles.champName}>{champion.name}</Text>

        {/* Champion image */}
        <View style={styles.imageFrame}>
          {meta.image && (
            <Image
              source={meta.image}
              style={styles.champImage}
              resizeMode="contain"
            />
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Stats */}
        <View style={styles.sectionLabelRow}>
          <Swords size={12} color="#9a7040" strokeWidth={2} />
          <Text style={styles.sectionLabel}>{t("baseStatistics")}</Text>
        </View>
        <StatRow label={t("attack")} value={champion.attack} />
        <StatRow label={t("defense")} value={champion.defense} />
        <StatRow label={t("chance")} value={champion.chance} />

        {/* Buttons */}
        {champion.current_hp <= 0 ? (
          // Dead champion — show revive button full width
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[
                styles.reviveBtn,
                styles.btnFlex,
                (resources?.strawberry ?? 0) < REVIVE_COST && styles.btnDisabled,
              ]}
              onPress={() => (resources?.strawberry ?? 0) >= REVIVE_COST && onRevive?.(champion)}
              activeOpacity={0.8}
            >
              <Sparkles size={16} color="#fff" strokeWidth={2} />
              <Text style={styles.reviveBtnText}>{t("revive")}</Text>
              <Text style={styles.reviveCost}>🍓 ×{REVIVE_COST}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.btnRow}>
              <PvpBattleButton
                onPress={() => onPvp(champion)}
                style={styles.btnFlex}
              />
              {claimableRun ? (
                <TouchableOpacity
                  style={[styles.claimBtn, styles.btnFlex]}
                  onPress={() => onClaim?.(claimableRun)}
                  activeOpacity={0.8}
                >
                  <Gift size={16} color="#fff" strokeWidth={2} />
                  <Text style={styles.claimBtnText}>{t("claimReward")}</Text>
                </TouchableOpacity>
              ) : isOnMission ? (
                <View style={[styles.onMissionBtn, styles.btnFlex]}>
                  <MapPin size={16} color="#4a7c3f" strokeWidth={2} />
                  <View style={styles.onMissionInner}>
                    <Text style={styles.onMissionText}>{t("onMission")}</Text>
                    {activeRunEndsAt && (
                      <CountdownTimer endsAt={activeRunEndsAt} style={styles.onMissionTimer} />
                    )}
                  </View>
                </View>
              ) : (
                <EnterDungeonButton
                  onPress={() => onDungeon(champion)}
                  style={styles.btnFlex}
                />
              )}
            </View>

            {/* Heal button — only when injured */}
            {champion.current_hp < champion.max_hp && (
              (() => {
                const healCost = Math.ceil((champion.max_hp - champion.current_hp) / 35);
                const canHeal = (resources?.strawberry ?? 0) >= healCost;
                return (
                  <TouchableOpacity
                    style={[styles.healBtn, !canHeal && styles.btnDisabled]}
                    onPress={() => canHeal && onHeal?.(champion)}
                    activeOpacity={0.8}
                  >
                    <Heart size={15} color="#fff" strokeWidth={2} fill="#fff" />
                    <Text style={styles.healBtnText}>{t("heal")}</Text>
                    <Text style={styles.healCost}>🍓 ×{healCost}</Text>
                  </TouchableOpacity>
                );
              })()
            )}
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  drawer: {
    backgroundColor: "#f5e9cc",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: "#c8a96e",
    paddingHorizontal: 22,
    paddingBottom: 36,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  handleWrap: {
    flex: 1,
    alignItems: "center",
    paddingLeft: 38,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#c8a96e",
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#e8d5a8",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  classBadge: {
    backgroundColor: "#c8e6c9",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#4a7c3f",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  classBadgeText: {
    color: "#2d5a24",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    backgroundColor: "#3a1e00",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelBadgeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#d4a84b",
    letterSpacing: 1,
  },
  levelBadgeNum: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f5c842",
    lineHeight: 24,
  },
  xpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  xpBarTrack: {
    flex: 1,
    height: 7,
    backgroundColor: "#e0d0b0",
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#c8a96e",
  },
  xpBarFill: {
    height: "100%",
    backgroundColor: "#f5c842",
    borderRadius: 4,
  },
  xpLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9a7040",
    minWidth: 80,
    textAlign: "right",
  },
  champName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#3a1e00",
    marginBottom: 12,
  },
  imageFrame: {
    alignSelf: "center",
    width: 148,
    height: 148,
    backgroundColor: "#ede0c4",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#c8a96e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#b8893a",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  champImage: {
    width: 128,
    height: 128,
  },
  divider: {
    height: 1.5,
    backgroundColor: "#d4b896",
    marginBottom: 12,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9a7040",
    letterSpacing: 1.2,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  statLabel: {
    width: 56,
    fontSize: 13,
    fontWeight: "600",
    color: "#4a2e0a",
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#e8d5a8",
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#c8a96e",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#c0392b",
    borderRadius: 4,
  },
  statValue: {
    width: 30,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "700",
    color: "#3a1e00",
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  btnFlex: {
    flex: 1,
  },
  claimBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f0a030",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: "#c87820",
  },
  claimBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.4,
  },
  onMissionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#e8f5e9",
    borderRadius: 14,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: "#a5d6a7",
  },
  onMissionInner: {
    alignItems: "center",
    gap: 2,
  },
  onMissionText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#4a7c3f",
    letterSpacing: 0.8,
  },
  onMissionTimer: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2d5a24",
    letterSpacing: 1.2,
  },
  reviveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#7b3fa0",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: "#5a2d78",
  },
  reviveBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.4,
  },
  reviveCost: {
    fontSize: 13,
    fontWeight: "700",
    color: "#e8c8f8",
  },
  healBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#c0392b",
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 10,
    borderWidth: 2,
    borderColor: "#922b21",
  },
  healBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.4,
  },
  healCost: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f5c6c0",
  },
  btnDisabled: {
    opacity: 0.45,
  },
});
