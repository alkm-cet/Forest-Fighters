import { useRef, useEffect, useState } from "react";
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
import { X, Swords, Gift, MapPin, Heart, Sparkles, HeartPulse, Shield, Zap } from "lucide-react-native";
import { Champion, DungeonRun, Resources } from "../types";
import { CLASS_META } from "../constants/resources";
import CustomModal from "./CustomModal";

const PLUS_BTN = require("../assets/plus-button-image.png");
import { useLanguage } from "../lib/i18n";

import PvpBattleButton from "./PvpBattleButton";
import EnterDungeonButton from "./EnterDungeonButton";
import CountdownTimer from "./CountdownTimer";

const REVIVE_COST = 3;

type StatKey = 'attack' | 'defense' | 'chance';

type BoostType = 'hp' | 'defense' | 'chance';

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
  onSpendStat?: (champion: Champion, stat: StatKey) => void;
  onBoost?: (champion: Champion, type: BoostType) => void;
  onMissionExpire?: () => void;
};

const BOOST_META: Record<BoostType, {
  label: string;
  icon: React.ReactNode;
  cost: number;
  costEmoji: string;
  boostCol: keyof Champion;
}> = {
  hp:      { label: '+10 HP',  icon: null, cost: 4, costEmoji: '🍓', boostCol: 'boost_hp' },
  defense: { label: '+5 DEF',  icon: null, cost: 4, costEmoji: '🌲', boostCol: 'boost_defense' },
  chance:  { label: '+5 CHC',  icon: null, cost: 3, costEmoji: '🫐', boostCol: 'boost_chance' },
};

const BOOST_RESOURCE: Record<BoostType, keyof Resources> = {
  hp:      'strawberry',
  defense: 'pinecone',
  chance:  'blueberry',
};

const STAT_MAX = 100;
const DISMISS_THRESHOLD = 100;

function StatRow({
  label,
  value,
  boost,
  canUpgrade,
  onUpgrade,
}: {
  label: string;
  value: number;
  boost?: number;
  canUpgrade?: boolean;
  onUpgrade?: () => void;
}) {
  const pct = Math.min((value + (boost ?? 0)) / STAT_MAX, 1);
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
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {(boost ?? 0) > 0 && (
          <Text style={styles.statBoost}> +{boost}</Text>
        )}
      </View>
      {canUpgrade && (
        <TouchableOpacity onPress={onUpgrade} activeOpacity={0.75} style={styles.statPlusWrap}>
          <Image source={PLUS_BTN} style={styles.statPlusBtn} resizeMode="contain" />
        </TouchableOpacity>
      )}
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
  onSpendStat,
  onBoost,
  onMissionExpire,
}: Props) {
  const { t } = useLanguage();
  const translateY = useRef(new Animated.Value(0)).current;
  const [pendingStat, setPendingStat] = useState<StatKey | null>(null);
  const [pendingBoost, setPendingBoost] = useState<BoostType | null>(null);

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

        {/* Champion image + boost buttons */}
        <View style={styles.imageAndBoostRow}>
          <View style={styles.imageFrame}>
            {meta.image && (
              <Image
                source={meta.image}
                style={styles.champImage}
                resizeMode="contain"
              />
            )}
            {/* Active boost badges on image corners */}
            {(champion.boost_hp ?? 0) > 0 && (
              <View style={[styles.boostBadge, styles.boostBadgeTopLeft]}>
                <Heart size={12} color="#fff" strokeWidth={2} fill="#fff" />
              </View>
            )}
            {(champion.boost_defense ?? 0) > 0 && (
              <View style={[styles.boostBadge, styles.boostBadgeBottomLeft]}>
                <Shield size={12} color="#fff" strokeWidth={2} />
              </View>
            )}
            {(champion.boost_chance ?? 0) > 0 && (
              <View style={[styles.boostBadge, styles.boostBadgeTopRight]}>
                <Zap size={12} color="#fff" strokeWidth={2} fill="#fff" />
              </View>
            )}
          </View>

          {/* Boost buttons */}
          <View style={styles.boostBtns}>
            {(Object.keys(BOOST_META) as BoostType[]).map((type) => {
              const bm = BOOST_META[type];
              const resKey = BOOST_RESOURCE[type];
              const isActive = (champion[bm.boostCol] as number ?? 0) > 0;
              const canAfford = (resources?.[resKey] ?? 0) >= bm.cost;
              const disabled = isActive || !canAfford;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.boostBtn, isActive && styles.boostBtnActive, disabled && !isActive && styles.boostBtnDisabled]}
                  onPress={() => !disabled && setPendingBoost(type)}
                  activeOpacity={0.75}
                >
                  {type === 'hp' && <Heart size={11} color={isActive ? "#fff" : "#c0392b"} strokeWidth={2} fill={isActive ? "#fff" : "#c0392b"} />}
                  {type === 'defense' && <Shield size={11} color={isActive ? "#fff" : "#4a7c3f"} strokeWidth={2} />}
                  {type === 'chance' && <Zap size={11} color={isActive ? "#fff" : "#8a5cc7"} strokeWidth={2} fill={isActive ? "#fff" : "#8a5cc7"} />}
                  <Text style={[styles.boostBtnLabel, isActive && styles.boostBtnLabelActive]}>{bm.label}</Text>
                  {!isActive && (
                    <Text style={[styles.boostBtnCost, !canAfford && styles.boostBtnCostRed]}>
                      {bm.costEmoji}×{bm.cost}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Boost confirmation modal */}
        {pendingBoost && champion && (
          <CustomModal
            visible={true}
            onClose={() => setPendingBoost(null)}
            onConfirm={() => {
              onBoost?.(champion, pendingBoost);
              setPendingBoost(null);
            }}
            title={t("boostConfirmTitle")}
            confirmDisabled={
              (resources?.[BOOST_RESOURCE[pendingBoost]] ?? 0) < BOOST_META[pendingBoost].cost
            }
          >
            <View style={styles.boostModalBody}>
              <Text style={styles.boostModalEffect}>{BOOST_META[pendingBoost].label}</Text>
              <Text style={styles.boostModalCost}>
                {t("upgradeCost")}: {BOOST_META[pendingBoost].costEmoji} ×{BOOST_META[pendingBoost].cost}
              </Text>
              <Text style={styles.boostModalNote}>{t("boostActiveUntil")}</Text>
            </View>
          </CustomModal>
        )}

        {/* HP Bar */}
        {(() => {
          const boostHp = champion.boost_hp ?? 0;
          const effectiveMaxHp = champion.max_hp + boostHp;
          const hpPct = effectiveMaxHp > 0 ? champion.current_hp / effectiveMaxHp : 0;
          const hpColor = hpPct > 0.6 ? "#2d8a3e" : hpPct > 0.3 ? "#d4a017" : "#c0392b";
          return (
            <View style={styles.hpSection}>
              <View style={styles.hpLabelRow}>
                <HeartPulse size={14} color={hpColor} strokeWidth={2.5} />
                <Text style={[styles.hpTitle, { color: hpColor }]}>
                  {champion.current_hp} / {champion.max_hp}
                  {boostHp > 0 && (
                    <Text style={styles.hpBoost}> +{boostHp}</Text>
                  )} HP
                </Text>
              </View>
              <View style={styles.hpBarTrack}>
                <View
                  style={[
                    styles.hpBarFill,
                    {
                      width: `${Math.round(Math.max(0, hpPct) * 100)}%` as any,
                      backgroundColor: hpColor,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })()}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Stats */}
        <View style={styles.sectionLabelRow}>
          <Swords size={12} color="#9a7040" strokeWidth={2} />
          <Text style={styles.sectionLabel}>{t("baseStatistics")}</Text>
          {champion.stat_points > 0 && (
            <View style={styles.statPointsBadge}>
              <Text style={styles.statPointsText}>+{champion.stat_points} {t("statPoints")}</Text>
            </View>
          )}
        </View>
        <StatRow
          label={t("attack")}
          value={champion.attack}
          canUpgrade={champion.stat_points > 0}
          onUpgrade={() => setPendingStat('attack')}
        />
        <StatRow
          label={t("defense")}
          value={champion.defense}
          boost={champion.boost_defense || undefined}
          canUpgrade={champion.stat_points > 0}
          onUpgrade={() => setPendingStat('defense')}
        />
        <StatRow
          label={t("chance")}
          value={champion.chance}
          boost={champion.boost_chance || undefined}
          canUpgrade={champion.stat_points > 0}
          onUpgrade={() => setPendingStat('chance')}
        />

        {/* Stat upgrade confirmation modal */}
        {pendingStat && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setPendingStat(null)}>
            <TouchableWithoutFeedback onPress={() => setPendingStat(null)}>
              <View style={styles.confirmOverlay} />
            </TouchableWithoutFeedback>
            <View style={styles.confirmCard}>
              <TouchableOpacity style={styles.confirmClose} onPress={() => setPendingStat(null)} activeOpacity={0.7}>
                <X size={14} color="#7a5230" strokeWidth={2.5} />
              </TouchableOpacity>
              <Text style={styles.confirmTitle}>{t("confirmUpgradeTitle")}</Text>
              <Text style={styles.confirmSubtitle}>
                {t(pendingStat === 'attack' ? 'upgradeStatAttack' : pendingStat === 'defense' ? 'upgradeStatDefense' : 'upgradeStatChance')}
              </Text>
              <View style={styles.confirmValueRow}>
                <Text style={styles.confirmValueCurrent}>{champion[pendingStat]}</Text>
                <Text style={styles.confirmValueArrow}>→</Text>
                <Text style={styles.confirmValueNext}>{champion[pendingStat] + 1}</Text>
              </View>
              <View style={styles.confirmBtnRow}>
                <TouchableOpacity
                  style={styles.confirmRejectBtn}
                  onPress={() => setPendingStat(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmRejectText}>{t("cancelBtn")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmAcceptBtn}
                  onPress={() => {
                    onSpendStat?.(champion, pendingStat);
                    setPendingStat(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmAcceptText}>{t("confirmUpgradeBtn")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

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
              {!isOnMission && !claimableRun && (
                <PvpBattleButton
                  onPress={() => onPvp(champion)}
                  style={styles.btnFlex}
                />
              )}
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
                      <CountdownTimer endsAt={activeRunEndsAt} style={styles.onMissionTimer} onExpire={onMissionExpire} />
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

            {/* Heal button — only when injured and not on mission */}
            {!isOnMission && champion.current_hp < (champion.max_hp + (champion.boost_hp ?? 0)) && (
              (() => {
                const effectiveMax = champion.max_hp + (champion.boost_hp ?? 0);
                const healCost = Math.ceil((effectiveMax - champion.current_hp) / 35);
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
  imageAndBoostRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  imageFrame: {
    width: 148,
    height: 148,
    backgroundColor: "#ede0c4",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#c8a96e",
    alignItems: "center",
    justifyContent: "center",
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
  boostBadge: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#3a1e00",
    borderWidth: 2,
    borderColor: "#f5e9cc",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  boostBadgeTopLeft: {
    top: -7,
    left: -7,
    backgroundColor: "#c0392b",
  },
  boostBadgeBottomLeft: {
    bottom: -7,
    left: -7,
    backgroundColor: "#4a7c3f",
  },
  boostBadgeTopRight: {
    top: -7,
    right: -7,
    backgroundColor: "#8a5cc7",
  },
  boostBtns: {
    flex: 1,
    gap: 8,
  },
  boostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ede0c4",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  boostBtnActive: {
    backgroundColor: "#3a1e00",
    borderColor: "#6a3e00",
  },
  boostBtnDisabled: {
    opacity: 0.45,
  },
  boostBtnLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#3a1e00",
    flex: 1,
  },
  boostBtnLabelActive: {
    color: "#f5c842",
  },
  boostBtnCost: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6a4a20",
  },
  boostBtnCostRed: {
    color: "#c0392b",
  },
  boostModalBody: {
    gap: 8,
  },
  boostModalEffect: {
    fontSize: 22,
    fontWeight: "800",
    color: "#3a1e00",
    textAlign: "center",
  },
  boostModalCost: {
    fontSize: 15,
    fontWeight: "700",
    color: "#7a5a30",
    textAlign: "center",
  },
  boostModalNote: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9a8060",
    textAlign: "center",
    fontStyle: "italic",
  },
  hpSection: {
    marginBottom: 12,
  },
  hpLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  hpTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  hpBoost: {
    fontSize: 15,
    fontWeight: "800",
    color: "#8a5cc7",
  },
  hpBarTrack: {
    height: 10,
    backgroundColor: "#e0d0b0",
    borderRadius: 5,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
  },
  hpBarFill: {
    height: "100%",
    borderRadius: 5,
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
  statPointsBadge: {
    marginLeft: "auto" as any,
    backgroundColor: "#3a1e00",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statPointsText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#f5c842",
    letterSpacing: 0.5,
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
  statValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    minWidth: 44,
    justifyContent: "flex-end",
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3a1e00",
  },
  statBoost: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8a5cc7",
  },
  statPlusWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  statPlusBtn: {
    width: 28,
    height: 28,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  confirmCard: {
    position: "absolute",
    bottom: "30%" as any,
    left: 24,
    right: 24,
    backgroundColor: "#f5e9cc",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#c8a96e",
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 20,
  },
  confirmClose: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e8d5a8",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#3a1e00",
    marginBottom: 6,
    paddingRight: 32,
  },
  confirmSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7a5a30",
    marginBottom: 16,
  },
  confirmValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 20,
    backgroundColor: "#ede0c4",
    borderRadius: 12,
    paddingVertical: 12,
  },
  confirmValueCurrent: {
    fontSize: 28,
    fontWeight: "800",
    color: "#3a1e00",
  },
  confirmValueArrow: {
    fontSize: 22,
    fontWeight: "700",
    color: "#9a7040",
  },
  confirmValueNext: {
    fontSize: 28,
    fontWeight: "800",
    color: "#4a7c3f",
  },
  confirmBtnRow: {
    flexDirection: "row",
    gap: 12,
  },
  confirmRejectBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#e8d5a8",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    alignItems: "center",
  },
  confirmRejectText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7a5a30",
  },
  confirmAcceptBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#4a7c3f",
    borderWidth: 1.5,
    borderColor: "#2d5a24",
    alignItems: "center",
  },
  confirmAcceptText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
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
