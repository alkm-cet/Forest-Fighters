import { useState, useRef, useEffect } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Modal,
  useWindowDimensions,
  Animated,
} from "react-native";
import {
  Lock,
  Crown,
  Swords,
  Shield,
  Zap,
  HeartPulse,
  Clock,
} from "lucide-react-native";
import { Text } from "../StyledText";
import {
  AdventureDungeon,
  AdventureProgress,
  AdventureMilestone,
  DungeonRun,
  Dungeon,
} from "../../types";
import CountdownTimer from "../CountdownTimer";
import CustomButton from "../CustomButton";
import { RESOURCE_META } from "../../constants/resources";

const CAT_PAWN = require("../../assets/icons/icon-cat-pawn.webp");
const COIN_IMG = require("../../assets/icons/icon-coin.webp");
const CHAMP_IMAGES: Record<string, ReturnType<typeof require>> = {
  Warrior: require("../../assets/cats/warrior-cat.webp"),
  Archer: require("../../assets/cats/archer-cat.webp"),
  Mage: require("../../assets/cats/mage-cat.webp"),
};
const STAR_IMG = require("../../assets/icons/icon-star.webp");
const DUNGEON_IMG = require("../../assets/icons/icon-dungeon.webp");

const ENEMY_IMAGES: Record<string, ReturnType<typeof require>> = {
  skeleton: require("../../assets/dungeon/skeleton.webp"),
  orc: require("../../assets/dungeon/orc.webp"),
  troll: require("../../assets/dungeon/troll.webp"),
  slime: require("../../assets/dungeon/slime.webp"),
  goblin: require("../../assets/dungeon/goblin.webp"),
  "dark mage": require("../../assets/dungeon/dark-mage.webp"),
  "mushroom golem": require("../../assets/dungeon/goblin.webp"),
  "bandit chief": require("../../assets/dungeon/orc.webp"),
  "ice witch": require("../../assets/dungeon/dark-mage.webp"),
  "fire imp": require("../../assets/dungeon/slime.webp"),
  "lava titan": require("../../assets/dungeon/troll.webp"),
  banshee: require("../../assets/dungeon/dark-mage.webp"),
  "shadow knight": require("../../assets/dungeon/skeleton.webp"),
  "mummy lord": require("../../assets/dungeon/skeleton.webp"),
  wyvern: require("../../assets/dungeon/troll.webp"),
  "void lich": require("../../assets/dungeon/dark-mage.webp"),
};

const NODE_SIZE = 62;
const BOSS_NODE_SIZE = 78;
const NODE_SPACING = 120;
const DOT_SIZE = 5;
const DOT_GAP = 9;
const S_OFFSET = 16;

interface Props {
  dungeons: AdventureDungeon[];
  progress: AdventureProgress[];
  milestones: AdventureMilestone[];
  totalStars: number;
  runs: DungeonRun[];
  championId: string | undefined;
  championClass: string | undefined;
  championIsBusy: boolean;
  onEnter: (dungeon: Dungeon) => void;
  onClaim: (run: DungeonRun) => void;
  onMilestoneClaim: (requiredStars: number) => void;
}

function StarsRow({ stars }: { stars: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[0, 1, 2].map((i) => (
        <Image
          key={i}
          source={STAR_IMG}
          style={{ width: 16, height: 16, opacity: i < stars ? 1 : 0.25 }}
          resizeMode="contain"
        />
      ))}
    </View>
  );
}

/** Renders dotted dots along a straight segment between two points */
function renderDottedSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
  color: string,
  keyPrefix: string,
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const step = DOT_SIZE + DOT_GAP;
  const count = Math.max(1, Math.floor(len / step));

  return Array.from({ length: count }, (_, j) => {
    const t = (j + 0.5) / count;
    const x = a.x + dx * t;
    const y = a.y + dy * t;
    return (
      <View
        key={`${keyPrefix}-${j}`}
        style={{
          position: "absolute",
          left: x - DOT_SIZE / 2,
          top: y - DOT_SIZE / 2,
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: DOT_SIZE / 2,
          backgroundColor: color,
          opacity: 0.85,
        }}
      />
    );
  });
}

/** Renders an S-shaped dotted connector between two node positions */
function renderSConnector(
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  index: number,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  // Perpendicular unit vector (for S-curve offset)
  const nx = -dy / len;
  const ny = dx / len;

  // S-curve: two control points offset in opposite directions
  const q1 = {
    x: from.x + dx * 0.33 + nx * S_OFFSET,
    y: from.y + dy * 0.33 + ny * S_OFFSET,
  };
  const q2 = {
    x: from.x + dx * 0.67 - nx * S_OFFSET,
    y: from.y + dy * 0.67 - ny * S_OFFSET,
  };

  const segments: [{ x: number; y: number }, { x: number; y: number }][] = [
    [from, q1],
    [q1, q2],
    [q2, to],
  ];

  return segments.flatMap(([a, b], si) =>
    renderDottedSegment(a, b, color, `connector-${index}-${si}`),
  );
}

export default function AdventureTab({
  dungeons,
  progress,
  milestones,
  totalStars,
  runs,
  championId,
  championClass,
  championIsBusy,
  onEnter,
  onClaim,
  onMilestoneClaim,
}: Props) {
  const { width } = useWindowDimensions();
  const [selectedDungeon, setSelectedDungeon] =
    useState<AdventureDungeon | null>(null);

  // Pulse animation for active run nodes
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const ZIGZAG_X = [width * 0.5, width * 0.73, width * 0.5, width * 0.27];
  const nodePositions = dungeons.map((_, i) => ({
    x: ZIGZAG_X[i % 4],
    y: 44 + i * NODE_SPACING,
  }));
  const totalMapHeight = 44 + dungeons.length * NODE_SPACING + 80;

  const nextMilestone = milestones.find((m) => !m.claimed);
  const nextClaimable = milestones.find(
    (m) => !m.claimed && totalStars >= m.required_stars,
  );

  function getProgress(dungeonId: string): AdventureProgress | undefined {
    return progress.find((p) => p.dungeon_id === dungeonId);
  }

  function isLocked(index: number): boolean {
    if (index === 0) return false;
    const prevProg = getProgress(dungeons[index - 1].id);
    return !prevProg || prevProg.best_stars === 0;
  }

  function getRunForDungeon(dungeonId: string): DungeonRun | undefined {
    return runs.find(
      (r) => r.dungeon_id === dungeonId && r.status === "active",
    );
  }

  return (
    <View style={styles.container}>
      {/* Milestone banner */}
      {nextMilestone && (
        <View style={styles.milestoneBanner}>
          <View style={styles.milestoneInfo}>
            <Text style={styles.milestoneTitle}>{nextMilestone.label}</Text>
            <Text style={styles.milestoneStars}>
              ⭐ {totalStars} / {nextMilestone.required_stars}
            </Text>
            <View style={styles.milestoneTrack}>
              <View
                style={[
                  styles.milestoneFill,
                  {
                    width: `${Math.min(
                      100,
                      (totalStars / nextMilestone.required_stars) * 100,
                    )}%` as any,
                  },
                ]}
              />
            </View>
          </View>
          {nextClaimable && (
            <TouchableOpacity
              style={styles.milestoneClaimBtn}
              onPress={() => onMilestoneClaim(nextClaimable.required_stars)}
            >
              <Text style={styles.milestoneClaimText}>CLAIM</Text>
              <View style={styles.milestoneCoinsRow}>
                <Image source={COIN_IMG} style={styles.milestoneCoinImg} resizeMode="contain" />
                <Text style={styles.milestoneCoins}>+{nextClaimable.reward_coins}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Map */}
      <ScrollView
        contentContainerStyle={[
          styles.mapContainer,
          { height: totalMapHeight },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* S-shaped dotted connectors */}
        {dungeons.slice(0, -1).map((_, i) => {
          const from = nodePositions[i];
          const to = nodePositions[i + 1];
          const prevProg = getProgress(dungeons[i].id);
          const isCleared = prevProg && prevProg.best_stars > 0;
          const dotColor = isCleared ? "#6aaa4a" : "#8a7a60";
          return renderSConnector(from, to, dotColor, i);
        })}

        {/* Nodes */}
        {dungeons.map((dungeon, i) => {
          const locked = isLocked(i);
          const prog = getProgress(dungeon.id);
          const stars = prog?.best_stars ?? 0;
          const isBoss = dungeon.is_boss_stage;
          const activeRun = getRunForDungeon(dungeon.id);
          const nodeSize = isBoss ? BOSS_NODE_SIZE : NODE_SIZE;
          const pos = nodePositions[i];

          // Node background tint based on state
          let nodeBg = "#6a5a48"; // locked/default: muted brown
          let nodeBorder = "#4a3a28";
          if (!locked) {
            if (stars === 3) {
              nodeBg = "#b8820a";
              nodeBorder = "#f9ca24";
            } else if (stars === 2) {
              nodeBg = "#5a7888";
              nodeBorder = "#8ab8cc";
            } else if (stars === 1) {
              nodeBg = "#7a4e20";
              nodeBorder = "#cd7f32";
            } else {
              // available, not yet cleared
              nodeBg = "#3a6a30";
              nodeBorder = "#6aaa4a";
            }
          }

          // Floating indicator side: if node is on right half → indicator on left, else on right
          const indicatorOnLeft = pos.x > width / 2;
          const CARD_W = 110;
          const CARD_H = 52;
          const cardLeft = indicatorOnLeft
            ? pos.x - nodeSize / 2 - CARD_W - 10
            : pos.x + nodeSize / 2 + 10;
          const cardTop = pos.y - CARD_H / 2;
          const champImg = championClass ? CHAMP_IMAGES[championClass] : null;

          const pulseScale = pulseAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.55],
          });
          const pulseOpacity = pulseAnim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.7, 0.4, 0],
          });

          return (
            <View key={dungeon.id}>
              {/* Pulse ring */}
              {activeRun && !locked && (
                <Animated.View
                  style={{
                    position: "absolute",
                    left: pos.x - nodeSize / 2,
                    top: pos.y - nodeSize / 2,
                    width: nodeSize,
                    height: nodeSize,
                    borderRadius: nodeSize / 2,
                    borderWidth: 3,
                    borderColor: "#5352ed",
                    transform: [{ scale: pulseScale }],
                    opacity: pulseOpacity,
                  }}
                  pointerEvents="none"
                />
              )}

              <TouchableOpacity
                style={[
                  styles.node,
                  {
                    width: nodeSize,
                    height: nodeSize,
                    borderRadius: nodeSize / 2,
                    left: pos.x - nodeSize / 2,
                    top: pos.y - nodeSize / 2,
                    backgroundColor: nodeBg,
                    borderColor: activeRun
                      ? "#5352ed"
                      : isBoss
                        ? "#f9ca24"
                        : nodeBorder,
                    borderWidth: isBoss ? 3 : 2.5,
                    opacity: locked ? 0.45 : 1,
                  },
                ]}
                onPress={() => !locked && setSelectedDungeon(dungeon)}
                disabled={locked}
                activeOpacity={0.75}
              >
                {/* Paw — fills the circle */}
                <Image
                  source={CAT_PAWN}
                  style={{
                    width: nodeSize * 0.72,
                    height: nodeSize * 0.72,
                    opacity: locked ? 0.35 : 1,
                  }}
                  resizeMode="contain"
                />

                {/* Lock overlay */}
                {locked && (
                  <Lock
                    size={20}
                    color="rgba(255,255,255,0.9)"
                    strokeWidth={2.5}
                    style={{ position: "absolute" }}
                  />
                )}

                {/* Boss crown badge */}
                {isBoss && !locked && (
                  <View style={styles.crownBadge}>
                    <Crown
                      size={11}
                      color="#f9ca24"
                      strokeWidth={2}
                      fill="#f9ca24"
                    />
                  </View>
                )}
              </TouchableOpacity>

              {/* Floating active-run card */}
              {activeRun && !locked && (
                <View
                  style={[
                    styles.runCard,
                    {
                      left: cardLeft,
                      top: cardTop,
                      width: CARD_W,
                      height: CARD_H,
                    },
                  ]}
                >
                  {champImg && (
                    <Image
                      source={champImg}
                      style={styles.runCardChampImg}
                      resizeMode="contain"
                    />
                  )}
                  <View style={styles.runCardInfo}>
                    <CountdownTimer
                      endsAt={activeRun.ends_at}
                      style={styles.runCardTimer}
                      onExpire={() => {}}
                    />
                  </View>
                </View>
              )}

              {/* Stars row — outside the circle, centered below */}
              {!locked && (
                <View
                  style={{
                    position: "absolute",
                    left: pos.x - nodeSize / 2,
                    top: pos.y + nodeSize / 2 + 5,
                    width: nodeSize,
                    alignItems: "center",
                  }}
                >
                  <StarsRow stars={stars} />
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Stage detail modal */}
      <Modal
        visible={selectedDungeon !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDungeon(null)}
      >
        {selectedDungeon && (
          <View style={styles.overlay}>
            <TouchableOpacity
              style={styles.backdrop}
              onPress={() => setSelectedDungeon(null)}
              activeOpacity={1}
            />
            <View style={styles.sheet}>
              {/* Header */}
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetTitle}>{selectedDungeon.name}</Text>
                  {selectedDungeon.is_boss_stage && (
                    <View style={styles.bossBadge}>
                      <Text style={styles.bossBadgeText}>👑 BOSS</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.stageNum}>
                  Stage {selectedDungeon.stage_number}
                </Text>
              </View>

              <Text style={styles.sheetDesc}>
                {selectedDungeon.description}
              </Text>

              {/* Duration */}
              <View style={styles.durationRow}>
                <Clock size={13} color="#7a5a30" strokeWidth={2.5} />
                <Text style={styles.durationText}>
                  {selectedDungeon.duration_minutes < 60
                    ? `${selectedDungeon.duration_minutes}m`
                    : `${Math.floor(selectedDungeon.duration_minutes / 60)}h${selectedDungeon.duration_minutes % 60 > 0 ? ` ${selectedDungeon.duration_minutes % 60}m` : ""}`}
                </Text>
              </View>

              {/* Enemy stats */}
              {(() => {
                const enemyKey =
                  selectedDungeon.enemy_name?.toLowerCase() ?? "";
                const enemyImg = ENEMY_IMAGES[enemyKey] ?? null;
                return (
                  <View style={styles.enemyBlock}>
                    {enemyImg && (
                      <Image
                        source={enemyImg}
                        style={styles.enemyImg}
                        resizeMode="contain"
                      />
                    )}
                    <View style={styles.enemyInfo}>
                      <Text style={styles.enemyName}>
                        {selectedDungeon.enemy_name}
                      </Text>
                      <View style={styles.statRow}>
                        <View style={styles.statItem}>
                          <Swords size={12} color="#c0392b" strokeWidth={2.5} />
                          <Text style={styles.statText}>
                            {selectedDungeon.enemy_attack}
                          </Text>
                        </View>
                        <View style={styles.statItem}>
                          <Shield size={12} color="#5d7f8a" strokeWidth={2.5} />
                          <Text style={styles.statText}>
                            {selectedDungeon.enemy_defense}
                          </Text>
                        </View>
                        <View style={styles.statItem}>
                          <Zap size={12} color="#8a6c2a" strokeWidth={2.5} />
                          <Text style={styles.statText}>
                            {selectedDungeon.enemy_chance}%
                          </Text>
                        </View>
                        <View style={styles.statItem}>
                          <HeartPulse
                            size={12}
                            color="#c0392b"
                            strokeWidth={2.5}
                          />
                          <Text style={styles.statText}>
                            {selectedDungeon.enemy_hp}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })()}

              {/* Stars */}
              {(() => {
                const prog = getProgress(selectedDungeon.id);
                const stars = prog?.best_stars ?? 0;
                return stars > 0 ? (
                  <View style={styles.sheetStarsRow}>
                    <Text style={styles.sheetStarsLabel}>Best: </Text>
                    <StarsRow stars={stars} />
                  </View>
                ) : null;
              })()}

              {/* Rewards */}
              <View style={styles.sheetRewardRow}>
                {(selectedDungeon.coin_reward ?? 0) > 0 && (
                  <View style={styles.rewardPill}>
                    <Image source={COIN_IMG} style={{ width: 16, height: 16 }} resizeMode="contain" />
                    <Text style={styles.rewardPillText}>{selectedDungeon.coin_reward}</Text>
                  </View>
                )}
                {selectedDungeon.xp_reward > 0 && (
                  <View style={styles.rewardPill}>
                    <Text style={styles.rewardPillText}>
                      ⭐ +{selectedDungeon.xp_reward} XP
                    </Text>
                  </View>
                )}
                {RESOURCE_META[selectedDungeon.reward_resource] && (
                  <View style={styles.rewardPill}>
                    <Image
                      source={
                        RESOURCE_META[selectedDungeon.reward_resource].image
                      }
                      style={{ width: 16, height: 16 }}
                      resizeMode="contain"
                    />
                    <Text style={styles.rewardPillText}>
                      ×{selectedDungeon.reward_amount}
                    </Text>
                  </View>
                )}
              </View>

              {/* Gear drop info */}
              <View style={styles.gearDropInfo}>
                <Text style={styles.gearDropInfoTitle}>⚔️ Gear Drops</Text>
                {(() => {
                  const isBoss = selectedDungeon.is_boss_stage;
                  const stage = selectedDungeon.stage_number;
                  const isFirstStage = stage === 1;
                  const dropChance = isFirstStage ? '100%' : isBoss ? '28%' : '12%';
                  const tierLabel =
                    isFirstStage ? 'T1'
                    : isBoss
                      ? (stage ?? 0) <= 5 ? 'T1 or T2' : (stage ?? 0) <= 10 ? 'T2 or T3' : 'T3'
                      : (stage ?? 0) <= 5 ? 'T1' : (stage ?? 0) <= 10 ? 'T2' : 'T3';
                  const rarities = isFirstStage
                    ? 'Weapon + Charm guaranteed'
                    : isBoss
                      ? 'Common 50% · Rare 35% · Epic 15%'
                      : 'Common 80% · Rare 18% · Epic 2%';
                  return (
                    <>
                      <View style={styles.gearDropRow}>
                        <Text style={styles.gearDropLabel}>Drop chance</Text>
                        <Text style={[styles.gearDropValue, isFirstStage && { color: '#4a7c3f' }]}>{dropChance}</Text>
                      </View>
                      <View style={styles.gearDropRow}>
                        <Text style={styles.gearDropLabel}>Tier</Text>
                        <Text style={styles.gearDropValue}>{tierLabel}</Text>
                      </View>
                      <Text style={styles.gearDropRarities}>{rarities}</Text>
                    </>
                  );
                })()}
              </View>

              {/* Action */}
              {(() => {
                const activeRun = getRunForDungeon(selectedDungeon.id);
                if (activeRun) {
                  const isExpired = new Date(activeRun.ends_at) <= new Date();
                  if (isExpired) {
                    return (
                      <TouchableOpacity
                        style={styles.claimBtn}
                        onPress={() => {
                          onClaim(activeRun);
                          setSelectedDungeon(null);
                        }}
                      >
                        <Text style={styles.claimBtnText}>🎁 CLAIM REWARD</Text>
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <View style={styles.onMissionBlock}>
                      <Text style={styles.onMissionLabel}>ON MISSION</Text>
                      <CountdownTimer
                        endsAt={activeRun.ends_at}
                        style={styles.countdownText}
                        onExpire={() => {}}
                      />
                    </View>
                  );
                }
                return (
                  <CustomButton
                    btnImage={DUNGEON_IMG}
                    text="ENTER DUNGEON"
                    onClick={() => {
                      onEnter(selectedDungeon);
                      setSelectedDungeon(null);
                    }}
                    bgColor="#4a7c3f"
                    borderColor="#2d5a24"
                    disabled={championIsBusy}
                    style={{ width: "100%", marginTop: 8 }}
                  />
                );
              })()}

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedDungeon(null)}
              >
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  milestoneBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(30,20,10,0.75)",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#c8a96e",
  },
  milestoneInfo: {
    flex: 1,
    gap: 4,
  },
  milestoneTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#f9ca24",
  },
  milestoneStars: {
    fontSize: 11,
    fontWeight: "700",
    color: "#e0d0a0",
  },
  milestoneTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 3,
    overflow: "hidden",
    marginRight: 8,
  },
  milestoneFill: {
    height: "100%",
    backgroundColor: "#f9ca24",
    borderRadius: 3,
  },
  milestoneClaimBtn: {
    backgroundColor: "#e67e22",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#d35400",
  },
  milestoneClaimText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
  },
  milestoneCoinsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  milestoneCoinImg: {
    width: 13,
    height: 13,
  },
  milestoneCoins: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  mapContainer: {
    position: "relative",
  },
  node: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  stageBadge: {
    position: "absolute",
    bottom: 5,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  stageBadgeText: {
    fontWeight: "800",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  crownBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: "rgba(30,20,0,0.85)",
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: "#f9ca24",
  },
  runCard: {
    position: "absolute",
    backgroundColor: "rgba(20,15,40,0.88)",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#5352ed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: 10,
    gap: 6,
  },
  runCardChampImg: {
    width: 44,
    height: 44,
    marginLeft: -4,
  },
  runCardInfo: {
    flex: 1,
    alignItems: "center",
  },
  runCardTimer: {
    fontSize: 12,
    fontWeight: "800",
    color: "#a8a4f8",
    letterSpacing: 0.5,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: "#f5e9cc",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    gap: 10,
    borderTopWidth: 2,
    borderColor: "#c8a96e",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#2d2010",
  },
  stageNum: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7a5a30",
    backgroundColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bossBadge: {
    backgroundColor: "#f39c12",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  bossBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
  },
  sheetDesc: {
    fontSize: 13,
    color: "#5a4020",
    lineHeight: 18,
    fontWeight: "500",
  },
  sheetStarsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sheetStarsLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7a5a30",
  },
  sheetRewardRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  rewardPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#c8a96e",
  },
  rewardPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3d2a10",
  },
  gearDropInfo: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c8a040',
    padding: 10,
    gap: 5,
  },
  gearDropInfoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#c8a040',
    letterSpacing: 0.5,
  },
  gearDropRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gearDropLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7a5a30',
  },
  gearDropValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#3d2a10',
  },
  gearDropRarities: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9a7040',
  },
  onMissionBlock: {
    backgroundColor: "#30336b",
    borderRadius: 10,
    alignItems: "center",
    gap: 3,
    paddingVertical: 10,
  },
  onMissionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#81c784",
    letterSpacing: 1.5,
  },
  countdownText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#a8d8b0",
    letterSpacing: 1.5,
  },
  claimBtn: {
    backgroundColor: "#e67e22",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: "#d35400",
  },
  claimBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  closeBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#7a5a30",
  },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#c8a96e",
  },
  durationText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#5a3a10",
  },
  enemyBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#c8a96e",
  },
  enemyImg: {
    width: 56,
    height: 56,
  },
  enemyInfo: {
    flex: 1,
    gap: 6,
  },
  enemyName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#c0392b",
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  statText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3d2a10",
  },
});
