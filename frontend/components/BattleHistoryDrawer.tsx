import { useMemo } from "react";
import {
  Modal,
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Text } from "./StyledText";
import { ArrowRight, ArrowLeft } from "lucide-react-native";
import { RESOURCE_META, CLASS_META, RARITY_META } from "../constants/resources";
import type {
  PvpBattle,
  ClaimResult,
  GearSnapshot,
  PlayerGear,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Enemy images (keyed by enemy_name from the DB, case-insensitive normalised)
// ─────────────────────────────────────────────────────────────────────────────

const ENEMY_IMGS: Record<string, any> = {
  goblin: require("../assets/dungeon/goblin.webp"),
  "party goblin": require("../assets/dungeon/goblin.webp"),
  orc: require("../assets/dungeon/orc.webp"),
  skeleton: require("../assets/dungeon/skeleton.webp"),
  slime: require("../assets/dungeon/slime.webp"),
  troll: require("../assets/dungeon/troll.webp"),
  "dark mage": require("../assets/dungeon/dark-mage.webp"),
  rock: require("../assets/dungeon/rock.webp"),
};

function enemyImg(name?: string | null): any | null {
  if (!name) return null;
  return ENEMY_IMGS[name.toLowerCase()] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

type PvpProps = {
  mode: "pvp";
  battle: PvpBattle;
  myPlayerId: string;
};

type PveProps = {
  mode: "pve";
  result: ClaimResult;
  championName: string;
  championClass: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
} & (PvpProps | PveProps);

// ─────────────────────────────────────────────────────────────────────────────
// Normalized internal shape (decouples rendering from data source)
// ─────────────────────────────────────────────────────────────────────────────

type CombatEntry = {
  round: number;
  actor: "left" | "right";
  atkBoosted: boolean;
  defBoosted: boolean;
  attackValue: number;
  defenseValue: number;
  damage: number;
  leftHpAfter: number;
  rightHpAfter: number;
};

type Normalized = {
  won: boolean;
  leftName: string;
  leftClass: string | null;
  leftGear: GearSnapshot | null;
  rightName: string;
  rightClass: string | null;
  rightGear: GearSnapshot | null;
  rightEnemyImg?: any;
  log: CombatEntry[];
  // PvP
  trophyDelta?: number;
  transferredStrawberry?: number;
  transferredPinecone?: number;
  transferredBlueberry?: number;
  // PvE
  rewardResource?: string;
  rewardAmount?: number;
  rewardResource2?: string | null;
  rewardAmount2?: number;
  coinReward?: number;
  starsEarned?: number | null;
  xpGained?: number;
  levelsGained?: number;
  newLevel?: number;
  gearDrops?: PlayerGear[];
};

function normalize(props: PvpProps | PveProps): Normalized {
  if (props.mode === "pvp") {
    const { battle, myPlayerId } = props;
    const isAttacker = battle.attacker_id === myPlayerId;
    const won = isAttacker
      ? battle.winner_id === battle.attacker_id
      : battle.winner_id === battle.defender_id;

    const leftName = isAttacker
      ? battle.attacker_champion_name
      : battle.defender_champion_name;
    const leftClass = isAttacker
      ? battle.attacker_champion_class
      : battle.defender_champion_class;
    const rightName = isAttacker
      ? battle.defender_champion_name
      : battle.attacker_champion_name;
    const rightClass = isAttacker
      ? battle.defender_champion_class
      : battle.attacker_champion_class;

    const leftGear = battle.gear_snapshot
      ? isAttacker
        ? battle.gear_snapshot.attacker
        : battle.gear_snapshot.defender
      : null;
    const rightGear = battle.gear_snapshot
      ? isAttacker
        ? battle.gear_snapshot.defender
        : battle.gear_snapshot.attacker
      : null;

    const trophyDelta = isAttacker
      ? battle.attacker_trophies_delta
      : battle.defender_trophies_delta;

    // Normalize log: "left" always = viewer's champion
    // HP: left always tracks viewer (attacker if isAttacker, defender otherwise)
    const rawLog: any[] = battle.combat_log ?? [];
    const log: CombatEntry[] = rawLog.map((e) => {
      const actorIsLeft = isAttacker
        ? e.actor === "attacker"
        : e.actor === "defender";
      return {
        round: e.round,
        actor: actorIsLeft ? "left" : "right",
        atkBoosted: e.atkBoosted,
        defBoosted: e.defBoosted,
        attackValue: e.attackValue,
        defenseValue: e.defenseValue,
        damage: e.damage,
        leftHpAfter: isAttacker ? e.attackerHpAfter : e.defenderHpAfter,
        rightHpAfter: isAttacker ? e.defenderHpAfter : e.attackerHpAfter,
      };
    });

    return {
      won,
      leftName,
      leftClass,
      leftGear,
      rightName,
      rightClass,
      rightGear,
      log,
      trophyDelta,
      transferredStrawberry: battle.transferred_strawberry,
      transferredPinecone: battle.transferred_pinecone,
      transferredBlueberry: battle.transferred_blueberry,
    };
  } else {
    const { result, championName, championClass } = props;
    const won = result.winner === "champion";
    const rawLog: any[] = result.log ?? [];
    const log: CombatEntry[] = rawLog.map((e) => {
      const actorIsLeft = e.actor === "attacker";
      return {
        round: e.round,
        actor: actorIsLeft ? "left" : "right",
        atkBoosted: e.atkBoosted,
        defBoosted: e.defBoosted,
        attackValue: e.attackValue,
        defenseValue: e.defenseValue,
        damage: e.damage,
        // Champion is always attacker (left), enemy is always defender (right)
        leftHpAfter: e.attackerHpAfter,
        rightHpAfter: e.defenderHpAfter,
      };
    });
    return {
      won,
      leftName: championName,
      leftClass: championClass,
      leftGear: result.championGear ?? null,
      rightName: result.enemyName ?? "Düşman",
      rightClass: null,
      rightGear: null,
      rightEnemyImg: enemyImg(result.enemyName),
      log,
      rewardResource: result.rewardResource,
      rewardAmount: result.rewardAmount,
      rewardResource2: result.rewardResource2,
      rewardAmount2: result.rewardAmount2,
      coinReward: result.coinReward,
      starsEarned: result.starsEarned,
      xpGained: result.xpGained,
      levelsGained: result.levelsGained,
      newLevel: result.newLevel,
      gearDrops: result.gearDrops,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function GearChip({ gear }: { gear: PlayerGear }) {
  const meta = RARITY_META[gear.rarity];
  return (
    <View style={[gearChipStyles.chip, { borderColor: meta.borderColor }]}>
      <Text style={gearChipStyles.emoji}>{gear.definition.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={gearChipStyles.name} numberOfLines={1}>
          {gear.definition.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={[
              gearChipStyles.rarityBadge,
              { backgroundColor: meta.color },
            ]}
          >
            <Text style={gearChipStyles.rarityText}>{meta.label}</Text>
          </View>
          <Text style={gearChipStyles.tier}>T{gear.definition.tier}</Text>
        </View>
      </View>
    </View>
  );
}

const gearChipStyles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: "#fef9f0",
    marginBottom: 3,
  },
  emoji: { fontSize: 16, lineHeight: 20 },
  name: { fontSize: 10, fontWeight: "700", color: "#3a2a10", maxWidth: 90 },
  rarityBadge: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  rarityText: { fontSize: 8, fontWeight: "700", color: "#fff" },
  tier: { fontSize: 9, color: "#888", fontWeight: "600" },
});

function GearSlotRow({
  gear,
  align,
}: {
  gear: GearSnapshot | null;
  align?: "left" | "right";
}) {
  if (!gear) {
    return (
      <View
        style={{
          marginTop: 4,
          opacity: 0.45,
          alignItems: align === "right" ? "flex-end" : "flex-start",
        }}
      >
        <Text style={{ fontSize: 10, color: "#888" }}>
          — ekipman bilgisi yok —
        </Text>
      </View>
    );
  }
  const items = [gear.weapon, gear.charm].filter(Boolean) as PlayerGear[];
  if (items.length === 0) {
    return (
      <View
        style={{
          marginTop: 4,
          opacity: 0.45,
          alignItems: align === "right" ? "flex-end" : "flex-start",
        }}
      >
        <Text style={{ fontSize: 10, color: "#888" }}>— ekipsiz —</Text>
      </View>
    );
  }
  return (
    <View
      style={{
        marginTop: 4,
        alignItems: align === "right" ? "flex-end" : "flex-start",
        gap: 2,
      }}
    >
      {items.map((g) => (
        <GearChip key={g.id} gear={g} />
      ))}
    </View>
  );
}

function ChampionPortrait({
  name,
  cls,
  gear,
  align,
  enemyImg: img,
}: {
  name: string;
  cls: string | null;
  gear: GearSnapshot | null;
  align?: "left" | "right";
  enemyImg?: any;
}) {
  const classMeta = cls ? CLASS_META[cls] : null;
  return (
    <View
      style={[
        portraitStyles.container,
        { alignItems: align === "right" ? "flex-end" : "flex-start" },
      ]}
    >
      <View
        style={[
          portraitStyles.imageWrap,
          { borderColor: classMeta?.color ?? "#9a7040" },
        ]}
      >
        {classMeta ? (
          <Image
            source={classMeta.image}
            style={portraitStyles.image}
            resizeMode="contain"
          />
        ) : img ? (
          <Image
            source={img}
            style={portraitStyles.image}
            resizeMode="contain"
          />
        ) : (
          <Text style={{ fontSize: 36, lineHeight: 60 }}>👹</Text>
        )}
      </View>
      <Text style={portraitStyles.name} numberOfLines={1}>
        {name}
      </Text>
      {cls && (
        <Text
          style={[portraitStyles.cls, { color: classMeta?.color ?? "#888" }]}
        >
          {classMeta?.emoji} {cls}
        </Text>
      )}
      <GearSlotRow gear={gear} align={align} />
    </View>
  );
}

const portraitStyles = StyleSheet.create({
  container: { flex: 1, gap: 2 },
  imageWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef4e4",
  },
  image: { width: 45, height: 45 },
  name: {
    fontSize: 12,
    fontWeight: "800",
    color: "#3a2a10",
    marginTop: 4,
    maxWidth: 110,
  },
  cls: { fontSize: 10, fontWeight: "600" },
});

function PvpOutcome({ n, won }: { n: Normalized; won: boolean }) {
  const delta = n.trophyDelta ?? 0;
  const resources = (["strawberry", "pinecone", "blueberry"] as const).filter(
    (r) =>
      ((n as any)[`transferred${r.charAt(0).toUpperCase() + r.slice(1)}`] ??
        0) > 0,
  );
  return (
    <View style={outcomeStyles.row}>
      <View
        style={[
          outcomeStyles.trophyPill,
          { backgroundColor: delta >= 0 ? "#e8f5e9" : "#ffebee" },
        ]}
      >
        <Text
          style={[
            outcomeStyles.trophyText,
            { color: delta >= 0 ? "#2e7d32" : "#c62828" },
          ]}
        >
          {delta >= 0 ? "+" : ""}
          {delta} 🏆
        </Text>
      </View>
      {(["strawberry", "pinecone", "blueberry"] as const).map((r) => {
        const key =
          `transferred${r.charAt(0).toUpperCase() + r.slice(1)}` as keyof Normalized;
        const amt = (n[key] as number) ?? 0;
        if (amt === 0) return null;
        const meta = RESOURCE_META[r];
        return (
          <View key={r} style={outcomeStyles.resourceItem}>
            {meta.image && (
              <Image
                source={meta.image}
                style={{ width: 20, height: 20 }}
                resizeMode="contain"
              />
            )}
            <Text
              style={[
                outcomeStyles.resourceText,
                { color: won ? "#2e7d32" : "#c62828" },
              ]}
            >
              {won ? "+" : "-"}
              {amt}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function PveOutcome({ n }: { n: Normalized }) {
  return (
    <View style={{ gap: 8 }}>
      {/* Stars */}
      {n.starsEarned != null && (
        <View style={outcomeStyles.row}>
          <Text style={outcomeStyles.starsText}>
            {Array.from({ length: 3 }, (_, i) =>
              i < (n.starsEarned ?? 0) ? "⭐" : "☆",
            ).join("")}
          </Text>
        </View>
      )}
      {/* Resources */}
      <View style={outcomeStyles.row}>
        {(n.rewardAmount ?? 0) > 0 && n.rewardResource && (
          <View style={outcomeStyles.resourceItem}>
            {RESOURCE_META[n.rewardResource]?.image && (
              <Image
                source={RESOURCE_META[n.rewardResource].image}
                style={{ width: 20, height: 20 }}
                resizeMode="contain"
              />
            )}
            <Text style={[outcomeStyles.resourceText, { color: "#2e7d32" }]}>
              +{n.rewardAmount}
            </Text>
          </View>
        )}
        {(n.rewardAmount2 ?? 0) > 0 && n.rewardResource2 && (
          <View style={outcomeStyles.resourceItem}>
            {RESOURCE_META[n.rewardResource2!]?.image && (
              <Image
                source={RESOURCE_META[n.rewardResource2!].image}
                style={{ width: 20, height: 20 }}
                resizeMode="contain"
              />
            )}
            <Text style={[outcomeStyles.resourceText, { color: "#2e7d32" }]}>
              +{n.rewardAmount2}
            </Text>
          </View>
        )}
        {(n.coinReward ?? 0) > 0 && (
          <View style={outcomeStyles.resourceItem}>
            <Text style={outcomeStyles.coinText}>🪙 +{n.coinReward}</Text>
          </View>
        )}
        {(n.xpGained ?? 0) > 0 && (
          <View style={outcomeStyles.xpPill}>
            <Text style={outcomeStyles.xpText}>+{n.xpGained} XP</Text>
          </View>
        )}
      </View>
      {/* Level up */}
      {(n.levelsGained ?? 0) > 0 && (
        <View style={outcomeStyles.levelUpBadge}>
          <Text style={outcomeStyles.levelUpText}>
            ⬆️ SEVİYE ATLADI! LV {n.newLevel}
          </Text>
        </View>
      )}
      {/* Gear drops */}
      {(n.gearDrops ?? []).map((drop) => {
        const rarityMeta = RARITY_META[drop.rarity];
        return (
          <View
            key={drop.id}
            style={[
              outcomeStyles.gearDropBanner,
              {
                backgroundColor: rarityMeta.color + "22",
                borderColor: rarityMeta.borderColor,
              },
            ]}
          >
            <Text style={outcomeStyles.gearDropTitle}>✨ Gear Drop!</Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Text style={{ fontSize: 30, lineHeight: 36 }}>
                {drop.definition.emoji}
              </Text>
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: "700", color: "#3a2a10" }}
                >
                  {drop.definition.name}
                </Text>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <View
                    style={[
                      outcomeStyles.rarityBadge,
                      { backgroundColor: rarityMeta.color },
                    ]}
                  >
                    <Text
                      style={{ fontSize: 9, fontWeight: "700", color: "#fff" }}
                    >
                      {rarityMeta.label}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 10, color: "#888" }}>
                    T{drop.definition.tier}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {drop.attack_bonus > 0 && (
                    <Text style={outcomeStyles.statText}>
                      +{drop.attack_bonus} ⚔️
                    </Text>
                  )}
                  {drop.defense_bonus > 0 && (
                    <Text style={outcomeStyles.statText}>
                      +{drop.defense_bonus} 🛡️
                    </Text>
                  )}
                  {drop.chance_bonus > 0 && (
                    <Text style={outcomeStyles.statText}>
                      +{drop.chance_bonus} 🎯
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const outcomeStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  trophyPill: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  trophyText: { fontSize: 16, fontWeight: "800" },
  resourceItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  resourceText: { fontSize: 14, fontWeight: "800" },
  coinText: { fontSize: 13, fontWeight: "700", color: "#b8860b" },
  xpPill: {
    backgroundColor: "#fff3cd",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  xpText: { fontSize: 13, fontWeight: "700", color: "#856404" },
  starsText: { fontSize: 22, letterSpacing: 2 },
  levelUpBadge: {
    backgroundColor: "#3a1e00",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: "center",
  },
  levelUpText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#f5c842",
    letterSpacing: 0.5,
  },
  gearDropBanner: { borderRadius: 12, borderWidth: 2, padding: 10, gap: 4 },
  gearDropTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#3a2a10",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  rarityBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  statText: { fontSize: 11, fontWeight: "700", color: "#4a7c3f" },
});

// Starting HP row shown at the top of the combat log
function StartHpRow({
  log,
  leftName,
  rightName,
}: {
  log: CombatEntry[];
  leftName: string;
  rightName: string;
}) {
  if (log.length === 0) return null;
  const first = log[0];
  // Derive starting HP: whoever was hit in the first entry had HP reduced by damage
  const leftStartHp =
    first.actor === "right"
      ? first.leftHpAfter + first.damage
      : first.leftHpAfter;
  const rightStartHp =
    first.actor === "left"
      ? first.rightHpAfter + first.damage
      : first.rightHpAfter;
  return (
    <View style={logStyles.startHpRow}>
      <View style={logStyles.startHpSide}>
        <Text style={logStyles.startHpName} numberOfLines={1}>
          {leftName}
        </Text>
        <Text style={logStyles.startHpVal}>❤️ {leftStartHp} HP</Text>
      </View>
      <Text style={logStyles.startHpVs}>BAŞLANGIÇ</Text>
      <View style={[logStyles.startHpSide, { alignItems: "flex-end" }]}>
        <Text style={logStyles.startHpName} numberOfLines={1}>
          {rightName}
        </Text>
        <Text style={logStyles.startHpVal}>❤️ {rightStartHp} HP</Text>
      </View>
    </View>
  );
}

// Small inline portrait for combat log (class image or fallback emoji)
function MiniPortrait({
  cls,
  fallbackImg,
}: {
  cls: string | null;
  fallbackImg?: any;
}) {
  const meta = cls ? CLASS_META[cls] : null;
  if (!meta) {
    return (
      <View style={logStyles.miniPortrait}>
        {fallbackImg ? (
          <Image
            source={fallbackImg}
            style={logStyles.miniImg}
            resizeMode="contain"
          />
        ) : (
          <Text style={{ fontSize: 18, lineHeight: 26 }}>👹</Text>
        )}
      </View>
    );
  }
  return (
    <View style={[logStyles.miniPortrait, { borderColor: meta.color }]}>
      <Image
        source={meta.image}
        style={logStyles.miniImg}
        resizeMode="contain"
      />
    </View>
  );
}

function CombatLogEntry({
  entry,
  prevEntry,
  leftName,
  rightName,
  leftClass,
  rightClass,
  rightEnemyImg,
}: {
  entry: CombatEntry;
  prevEntry: CombatEntry | null;
  leftName: string;
  rightName: string;
  leftClass: string | null;
  rightClass: string | null;
  rightEnemyImg?: any;
}) {
  const newRound = !prevEntry || prevEntry.round !== entry.round;
  const leftAttacks = entry.actor === "left";
  const blocked = entry.damage === 0;

  // HP always belongs to the fixed side — left champ hp is always leftHpAfter
  const leftHp = entry.leftHpAfter;
  const rightHp = entry.rightHpAfter;

  // Highlight the side that took damage
  const leftTookDamage = !leftAttacks && !blocked;
  const rightTookDamage = leftAttacks && !blocked;

  // Arrow color: orange when left attacks, red when right attacks
  const arrowColor = leftAttacks ? "#e67e22" : "#e74c3c";

  return (
    <View style={logStyles.row}>
      {newRound && (
        <View style={logStyles.roundBadge}>
          <Text style={logStyles.roundText}>— TUR {entry.round + 1} —</Text>
        </View>
      )}

      <View
        style={[
          logStyles.line,
          leftAttacks ? logStyles.lineLeftAtk : logStyles.lineRightAtk,
        ]}
      >
        {/* ── LEFT CHAMPION (always left) ─────────────────────────────── */}
        <View style={[logStyles.side, leftTookDamage && logStyles.sideDamaged]}>
          <View style={logStyles.nameRow}>
            <MiniPortrait cls={leftClass} />
            <Text
              style={[
                logStyles.sideName,
                { color: leftAttacks ? "#2d6e24" : "#333" },
              ]}
              numberOfLines={1}
            >
              {leftName}
            </Text>
          </View>
          <Text
            style={[logStyles.hpText, leftTookDamage && logStyles.hpDamaged]}
          >
            {leftHp} HP
          </Text>
          {leftAttacks ? (
            <View style={logStyles.statBadgeRow}>
              <Text style={logStyles.atkVal}>ATK {entry.attackValue}</Text>
              {entry.atkBoosted && (
                <View style={logStyles.critBadge}>
                  <Text style={logStyles.critText}>⚡KRİT</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={logStyles.statBadgeRow}>
              {entry.defBoosted && (
                <View style={logStyles.blockBadge}>
                  <Text style={logStyles.blockText}>🛡KALKAN</Text>
                </View>
              )}
              <Text style={logStyles.defVal}>DEF {entry.defenseValue}</Text>
            </View>
          )}
        </View>

        {/* ── CENTER: directional arrow + damage ──────────────────────── */}
        <View style={logStyles.center}>
          {leftAttacks ? (
            <ArrowRight size={22} color={arrowColor} strokeWidth={2.5} />
          ) : (
            <ArrowLeft size={22} color={arrowColor} strokeWidth={2.5} />
          )}
          <View
            style={[
              logStyles.dmgPill,
              blocked ? logStyles.dmgPillBlock : logStyles.dmgPillHit,
            ]}
          >
            <Text
              style={[
                logStyles.dmgText,
                blocked ? logStyles.dmgTextBlock : logStyles.dmgTextHit,
              ]}
            >
              {blocked ? "BLOK" : `−${entry.damage}`}
            </Text>
          </View>
        </View>

        {/* ── RIGHT CHAMPION (always right) ───────────────────────────── */}
        <View
          style={[
            logStyles.side,
            logStyles.sideRight,
            rightTookDamage && logStyles.sideDamaged,
          ]}
        >
          <View style={[logStyles.nameRow, { justifyContent: "flex-end" }]}>
            <Text
              style={[
                logStyles.sideName,
                { color: !leftAttacks ? "#a02020" : "#333" },
              ]}
              numberOfLines={1}
            >
              {rightName}
            </Text>
            <MiniPortrait cls={rightClass} fallbackImg={rightEnemyImg} />
          </View>
          <Text
            style={[
              logStyles.hpText,
              logStyles.hpRight,
              rightTookDamage && logStyles.hpDamaged,
            ]}
          >
            {rightHp} HP
          </Text>
          {!leftAttacks ? (
            <View style={[logStyles.statBadgeRow, logStyles.statBadgeRowRight]}>
              <Text style={logStyles.atkVal}>ATK {entry.attackValue}</Text>
              {entry.atkBoosted && (
                <View style={logStyles.critBadge}>
                  <Text style={logStyles.critText}>⚡KRİT</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[logStyles.statBadgeRow, logStyles.statBadgeRowRight]}>
              {entry.defBoosted && (
                <View style={logStyles.blockBadge}>
                  <Text style={logStyles.blockText}>🛡KALKAN</Text>
                </View>
              )}
              <Text style={logStyles.defVal}>DEF {entry.defenseValue}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const logStyles = StyleSheet.create({
  row: { marginBottom: 5 },
  roundBadge: {
    alignSelf: "center",
    backgroundColor: "#ede0c4",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 3,
    marginBottom: 5,
    marginTop: 10,
  },
  roundText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#9a7040",
    letterSpacing: 1.2,
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    gap: 4,
  },
  lineLeftAtk: { backgroundColor: "#f5fdf5", borderColor: "#b2d8b2" },
  lineRightAtk: { backgroundColor: "#fdf5f5", borderColor: "#e0b8b8" },
  side: { flex: 1, gap: 3 },
  sideRight: { alignItems: "flex-end" },
  sideDamaged: { opacity: 0.85 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  miniPortrait: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "#bbb",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef4e4",
  },
  miniImg: { width: 24, height: 24 },
  sideName: { fontSize: 10, fontWeight: "800", flexShrink: 1 },
  hpText: { fontSize: 11, fontWeight: "700", color: "#555", marginLeft: 31 },
  hpRight: { marginLeft: 0, marginRight: 31 },
  hpDamaged: { color: "#c0392b", fontWeight: "800" },
  statBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
    marginLeft: 31,
  },
  statBadgeRowRight: {
    marginLeft: 0,
    marginRight: 31,
    justifyContent: "flex-end",
  },
  startHpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ede0c4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  startHpSide: { flex: 1, gap: 2 },
  startHpName: { fontSize: 10, fontWeight: "700", color: "#5a3e1b" },
  startHpVal: { fontSize: 12, fontWeight: "800", color: "#c0392b" },
  startHpVs: {
    fontSize: 9,
    fontWeight: "800",
    color: "#9a7040",
    letterSpacing: 1,
    textAlign: "center",
    paddingHorizontal: 6,
  },
  atkVal: { fontSize: 10, fontWeight: "600", color: "#777" },
  defVal: { fontSize: 10, fontWeight: "600", color: "#777" },
  critBadge: {
    backgroundColor: "#e67e22",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  critText: { fontSize: 8, fontWeight: "800", color: "#fff" },
  blockBadge: {
    backgroundColor: "#2980b9",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  blockText: { fontSize: 8, fontWeight: "800", color: "#fff" },
  center: { alignItems: "center", gap: 4, paddingHorizontal: 2 },
  dmgPill: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  dmgPillHit: { backgroundColor: "#c0392b" },
  dmgPillBlock: { backgroundColor: "#bbb" },
  dmgText: { fontSize: 11, fontWeight: "800" },
  dmgTextHit: { color: "#fff" },
  dmgTextBlock: { color: "#fff" },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function BattleHistoryDrawer(props: Props) {
  const { visible, onClose } = props;

  const n = useMemo(() => {
    if (props.mode === "pvp") {
      if (!props.battle) return null;
      return normalize(props);
    } else {
      if (!props.result) return null;
      return normalize(props);
    }
  }, [props]);

  if (!n) return null;

  const subtitleText =
    props.mode === "pvp"
      ? `vs ${props.battle.attacker_id === props.myPlayerId ? props.battle.defender_name : props.battle.attacker_name}`
      : props.result.winner === "champion"
        ? "Dungeon temizlendi!"
        : "Düşman çok güçlüydü";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* ── HEADER ── */}
          <View
            style={[
              styles.header,
              n.won ? styles.headerWin : styles.headerLose,
            ]}
          >
            <Text style={styles.title}>
              {n.won ? "⚔️  ZAFER!" : "💀  BOZGUN"}
            </Text>
            <Text style={styles.subtitle}>{subtitleText}</Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
          >
            {/* ── VS SECTION ── */}
            <View style={styles.vsSection}>
              <ChampionPortrait
                name={n.leftName}
                cls={n.leftClass}
                gear={n.leftGear}
                align="left"
              />
              <View style={styles.vsCenter}>
                <Text style={styles.vsText}>VS</Text>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <ChampionPortrait
                  name={n.rightName}
                  cls={n.rightClass}
                  gear={n.rightGear}
                  align="right"
                  enemyImg={n.rightEnemyImg}
                />
              </View>
            </View>

            {/* ── OUTCOME ── */}
            <View style={styles.outcomeSection}>
              {props.mode === "pvp" ? (
                <PvpOutcome n={n} won={n.won} />
              ) : (
                <PveOutcome n={n} />
              )}
            </View>

            {/* ── COMBAT LOG ── */}
            {n.log.length > 0 && (
              <View style={styles.logSection}>
                <Text style={styles.logTitle}>SAVAŞ GÜNLÜĞÜ</Text>
                <StartHpRow
                  log={n.log}
                  leftName={n.leftName}
                  rightName={n.rightName}
                />
                {n.log.map((entry, i) => (
                  <CombatLogEntry
                    key={i}
                    entry={entry}
                    prevEntry={i > 0 ? n.log[i - 1] : null}
                    leftName={n.leftName}
                    rightName={n.rightName}
                    leftClass={n.leftClass}
                    rightClass={n.rightClass}
                    rightEnemyImg={n.rightEnemyImg}
                  />
                ))}
              </View>
            )}
          </ScrollView>

          {/* ── CLOSE BUTTON ── */}
          <TouchableOpacity style={styles.btn} onPress={onClose}>
            <Text style={styles.btnText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#f5edd8",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: "#d4b896",
    flex: 1,
    maxHeight: "88%",
    paddingBottom: 32,
  },
  header: {
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  headerWin: { backgroundColor: "#c8e6c9" },
  headerLose: { backgroundColor: "#ffcdd2" },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1a1a1a",
    letterSpacing: 0.5,
  },
  subtitle: { fontSize: 14, fontWeight: "600", color: "#555", marginTop: 3 },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 0,
  },

  vsSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 4,
  },
  vsCenter: {
    paddingTop: 16,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  vsText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#9a7040",
    letterSpacing: 1,
  },

  outcomeSection: {
    backgroundColor: "#fef9f0",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e8d8b0",
    padding: 12,
    marginBottom: 14,
  },

  logSection: { marginBottom: 8 },
  logTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#9a7040",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 8,
    textAlign: "center",
  },

  btn: {
    backgroundColor: "#4a7c3f",
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { fontSize: 16, fontWeight: "800", color: "#fff" },
});
