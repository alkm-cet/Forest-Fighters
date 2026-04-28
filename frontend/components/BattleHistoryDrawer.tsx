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
import { GEAR_IMAGES } from "./GearDrawer";
import { useLanguage } from "../lib/i18n";
import type {
  PvpBattle,
  ClaimResult,
  GearSnapshot,
  PlayerGear,
} from "../types";

const ENEMY_IMGS: Record<string, any> = {
  goblin: require("../assets/dungeon/goblin.webp"),
  "party goblin": require("../assets/dungeon/goblin.webp"),
  orc: require("../assets/dungeon/orc.webp"),
  skeleton: require("../assets/dungeon/skeleton.webp"),
  slime: require("../assets/dungeon/slime.webp"),
  troll: require("../assets/dungeon/troll.webp"),
  "dark mage": require("../assets/dungeon/dark-mage.webp"),
  rock: require("../assets/dungeon/rock.webp"),
  "mushroom golem": require("../assets/dungeon/goblin.webp"),
  "bandit chief": require("../assets/dungeon/orc.webp"),
  "ice witch": require("../assets/dungeon/dark-mage.webp"),
  "fire imp": require("../assets/dungeon/slime.webp"),
  "lava titan": require("../assets/dungeon/troll.webp"),
  banshee: require("../assets/dungeon/dark-mage.webp"),
  "shadow knight": require("../assets/dungeon/skeleton.webp"),
  "mummy lord": require("../assets/dungeon/skeleton.webp"),
  wyvern: require("../assets/dungeon/troll.webp"),
  "void lich": require("../assets/dungeon/dark-mage.webp"),
  "shadow wolf": require("../assets/dungeon/skeleton.webp"),
  "thunder eagle": require("../assets/dungeon/goblin.webp"),
  "frost golem": require("../assets/dungeon/troll.webp"),
  "fire salamander": require("../assets/dungeon/slime.webp"),
  "demon warlord": require("../assets/dungeon/orc.webp"),
  "shade specter": require("../assets/dungeon/dark-mage.webp"),
  "stone colossus": require("../assets/dungeon/troll.webp"),
  "void crawler": require("../assets/dungeon/slime.webp"),
  "fallen paladin": require("../assets/dungeon/skeleton.webp"),
  "cursed knight": require("../assets/dungeon/skeleton.webp"),
  "stone titan": require("../assets/dungeon/troll.webp"),
  "inferno djinn": require("../assets/dungeon/dark-mage.webp"),
  "void archon": require("../assets/dungeon/dark-mage.webp"),
  "ancient dragon": require("../assets/dungeon/orc.webp"),
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
  champion2Name?: string;
  champion2Class?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
} & (PvpProps | PveProps);

// ─────────────────────────────────────────────────────────────────────────────
// 1v1 normalized shape
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

type StartStats = {
  attack: number;
  defense: number;
  chance: number;
  hp: number;
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
  leftStartStats?: StartStats;
  rightStartStats?: StartStats;
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

// ─────────────────────────────────────────────────────────────────────────────
// Boss battle shape (separate, not normalized to left/right)
// ─────────────────────────────────────────────────────────────────────────────

type BossLogEntry = {
  round: number;
  actor: "c1" | "c2" | "boss_vs_c1" | "boss_vs_c2";
  atkBoosted: boolean;
  defBoosted: boolean;
  attackValue: number;
  defenseValue: number;
  damage: number;
  c1HpAfter: number;
  c2HpAfter: number;
  bossHpAfter: number;
};

type BossNormalized = {
  won: boolean;
  c1Name: string;
  c1Class: string;
  c2Name: string;
  c2Class: string | null;
  bossName: string;
  bossImg: any | null;
  log: BossLogEntry[];
  c1StartStats?: StartStats;
  c2StartStats?: StartStats;
  bossStartStats?: StartStats;
  rewardResource?: string;
  rewardAmount?: number;
  rewardResource2?: string | null;
  rewardAmount2?: number;
  coinReward?: number;
  starsEarned?: number | null;
  xpGained?: number;
  levelsGained?: number;
  newLevel?: number;
  champion2XpGained?: number;
  champion2LevelsGained?: number;
  champion2NewLevel?: number;
  gearDrops?: PlayerGear[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Normalize helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalize(props: PvpProps | PveProps): Normalized | null {
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
        leftHpAfter: Math.round(
          isAttacker ? e.attackerHpAfter : e.defenderHpAfter,
        ),
        rightHpAfter: Math.round(
          isAttacker ? e.defenderHpAfter : e.attackerHpAfter,
        ),
      };
    });

    const bl = battle.battle_log;
    const rawAttStats = bl && !Array.isArray(bl) ? bl.attacker : undefined;
    const rawDefStats = bl && !Array.isArray(bl) ? bl.defender : undefined;
    const leftStartStats = isAttacker ? rawAttStats : rawDefStats;
    const rightStartStats = isAttacker ? rawDefStats : rawAttStats;

    return {
      won,
      leftName,
      leftClass,
      leftGear,
      rightName,
      rightClass,
      rightGear,
      log,
      leftStartStats,
      rightStartStats,
      trophyDelta,
      transferredStrawberry: battle.transferred_strawberry,
      transferredPinecone: battle.transferred_pinecone,
      transferredBlueberry: battle.transferred_blueberry,
    };
  } else {
    const { result, championName, championClass } = props;
    if (result.isBossBattle) return null; // handled separately
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
        leftHpAfter: Math.round(e.attackerHpAfter),
        rightHpAfter: Math.round(e.defenderHpAfter),
      };
    });
    return {
      won,
      leftName: championName,
      leftClass: championClass,
      leftGear: result.championGear ?? null,
      rightName: result.enemyName ?? "Enemy",
      rightClass: null,
      rightGear: null,
      rightEnemyImg: enemyImg(result.enemyName),
      log,
      leftStartStats: result.championStartStats,
      rightStartStats: result.enemyStartStats,
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

function normalizeBoss(
  result: ClaimResult,
  c1Name: string,
  c1Class: string,
  c2Name: string,
  c2Class: string | null,
): BossNormalized {
  const won = result.winner === "champion";
  const rawLog: any[] = result.log ?? [];

  const log: BossLogEntry[] = rawLog.map((e) => {
    const actor =
      e.actor === "champion1"
        ? "c1"
        : e.actor === "champion2"
          ? "c2"
          : e.actor === "boss_vs_champion1"
            ? "boss_vs_c1"
            : "boss_vs_c2";
    return {
      round: e.round,
      actor,
      atkBoosted: e.atkBoosted ?? false,
      defBoosted: e.defBoosted ?? false,
      attackValue: e.attackValue ?? 0,
      defenseValue: e.defenseValue ?? 0,
      damage: e.damage ?? 0,
      c1HpAfter: Math.round(e.c1HpAfter ?? 0),
      c2HpAfter: Math.round(e.c2HpAfter ?? 0),
      bossHpAfter: Math.round(e.bossHpAfter ?? 0),
    };
  });

  return {
    won,
    c1Name,
    c1Class,
    c2Name,
    c2Class,
    bossName: result.enemyName ?? "Boss",
    bossImg: enemyImg(result.enemyName),
    log,
    c1StartStats: result.c1StartStats,
    c2StartStats: result.c2StartStats,
    bossStartStats: result.bossStartStats,
    rewardResource: result.rewardResource,
    rewardAmount: result.rewardAmount,
    rewardResource2: result.rewardResource2,
    rewardAmount2: result.rewardAmount2,
    coinReward: result.coinReward,
    starsEarned: result.starsEarned,
    xpGained: result.xpGained,
    levelsGained: result.levelsGained,
    newLevel: result.newLevel,
    champion2XpGained: result.champion2XpGained,
    champion2LevelsGained: result.champion2LevelsGained,
    champion2NewLevel: result.champion2NewLevel,
    gearDrops: result.gearDrops,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (shared)
// ─────────────────────────────────────────────────────────────────────────────

function GearChip({ gear }: { gear: PlayerGear }) {
  const meta = RARITY_META[gear.rarity];
  const stats = [
    gear.attack_bonus > 0 ? `+${gear.attack_bonus} ⚔️` : null,
    gear.defense_bonus > 0 ? `+${gear.defense_bonus} 🛡️` : null,
    gear.chance_bonus > 0 ? `+${gear.chance_bonus} 🎯` : null,
  ].filter(Boolean) as string[];
  return (
    <View style={[gearChipStyles.chip, { borderColor: meta.borderColor }]}>
      <Text style={gearChipStyles.levelText}>Lv.{gear.level}</Text>
      {GEAR_IMAGES[gear.definition.id] ? (
        <Image
          source={GEAR_IMAGES[gear.definition.id]}
          style={gearChipStyles.gearImg}
          resizeMode="contain"
        />
      ) : (
        <Text style={gearChipStyles.emoji}>{gear.definition.emoji}</Text>
      )}
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

      <View style={gearChipStyles.rightCol}>
        {stats.map((s) => (
          <Text key={s} style={gearChipStyles.statLine}>
            {s}
          </Text>
        ))}
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
  gearImg: { width: 25, height: 25 },
  name: { fontSize: 10, fontWeight: "700", color: "#3a2a10", maxWidth: 75 },
  rarityBadge: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  rarityText: { fontSize: 8, fontWeight: "700", color: "#fff" },
  tier: { fontSize: 9, color: "#888", fontWeight: "600" },
  rightCol: { alignItems: "flex-end", gap: 1 },
  levelText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7a5230",
    backgroundColor: "#fbe8c4",
    borderWidth: 1,
    borderColor: "#e0c9a6",
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  statLine: { fontSize: 9, fontWeight: "600", color: "#4a7c3f" },
});

function GearSlotRow({
  gear,
  align,
}: {
  gear: GearSnapshot | null;
  align?: "left" | "right";
}) {
  const { t } = useLanguage();
  if (!gear)
    return (
      <View
        style={{
          marginTop: 4,
          opacity: 0.45,
          alignItems: align === "right" ? "flex-end" : "flex-start",
        }}
      >
        <Text style={{ fontSize: 10, color: "#888" }}>
          {t("battleNoGearInfo")}
        </Text>
      </View>
    );
  const items = [gear.weapon, gear.charm].filter(Boolean) as PlayerGear[];
  if (items.length === 0)
    return (
      <View
        style={{
          marginTop: 4,
          opacity: 0.45,
          alignItems: align === "right" ? "flex-end" : "flex-start",
        }}
      >
        <Text style={{ fontSize: 10, color: "#888" }}>{t("battleNoGear")}</Text>
      </View>
    );
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

function MiniPortrait({
  cls,
  fallbackImg,
}: {
  cls: string | null;
  fallbackImg?: any;
}) {
  const meta = cls ? CLASS_META[cls] : null;
  if (!meta)
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

// ─────────────────────────────────────────────────────────────────────────────
// Outcome sections
// ─────────────────────────────────────────────────────────────────────────────

function PvpOutcome({ n, won }: { n: Normalized; won: boolean }) {
  const delta = n.trophyDelta ?? 0;
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

function RewardsBlock({
  n,
}: {
  n: Pick<
    Normalized,
    | "rewardResource"
    | "rewardAmount"
    | "rewardResource2"
    | "rewardAmount2"
    | "coinReward"
    | "starsEarned"
    | "xpGained"
    | "levelsGained"
    | "newLevel"
    | "gearDrops"
  >;
}) {
  const { t } = useLanguage();
  return (
    <View style={{ gap: 8 }}>
      {n.starsEarned != null && (
        <View style={outcomeStyles.row}>
          <Text style={outcomeStyles.starsText}>
            {Array.from({ length: 3 }, (_, i) =>
              i < (n.starsEarned ?? 0) ? "⭐" : "☆",
            ).join("")}
          </Text>
        </View>
      )}
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
      {(n.levelsGained ?? 0) > 0 && (
        <View style={outcomeStyles.levelUpBadge}>
          <Text style={outcomeStyles.levelUpText}>
            {t("battleLevelUpPrefix")} {n.newLevel}
          </Text>
        </View>
      )}
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
            <Text style={outcomeStyles.gearDropTitle}>
              {t("battleGearDrop")}
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              {GEAR_IMAGES[drop.definition.id] ? (
                <Image
                  source={GEAR_IMAGES[drop.definition.id]}
                  style={{ width: 36, height: 36 }}
                  resizeMode="contain"
                />
              ) : (
                <Text style={{ fontSize: 30, lineHeight: 36 }}>
                  {drop.definition.emoji}
                </Text>
              )}
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

// ─────────────────────────────────────────────────────────────────────────────
// 1v1 combat log
// ─────────────────────────────────────────────────────────────────────────────

function StartHpRow({
  log,
  leftName,
  rightName,
  leftStartStats,
  rightStartStats,
}: {
  log: CombatEntry[];
  leftName: string;
  rightName: string;
  leftStartStats?: StartStats;
  rightStartStats?: StartStats;
}) {
  const { t } = useLanguage();
  if (log.length === 0) return null;
  const first = log[0];
  const leftStartHp =
    leftStartStats?.hp ??
    (first.actor === "right"
      ? first.leftHpAfter + first.damage
      : first.leftHpAfter);
  const rightStartHp =
    rightStartStats?.hp ??
    (first.actor === "left"
      ? first.rightHpAfter + first.damage
      : first.rightHpAfter);
  return (
    <View style={[logStyles.startHpRow, { alignItems: "flex-start" }]}>
      <View style={[logStyles.startHpSide, { gap: 2 }]}>
        <Text style={logStyles.startHpName} numberOfLines={1}>
          {leftName}
        </Text>
        <Text style={logStyles.startHpVal}>❤️ {leftStartHp} HP</Text>
        {leftStartStats && (
          <Text style={logStyles.startStatText}>
            ⚔️ {leftStartStats.attack} 🛡️ {leftStartStats.defense} 🎯{" "}
            {leftStartStats.chance}%
          </Text>
        )}
      </View>
      <Text style={[logStyles.startHpVs, { marginTop: 4 }]}>
        {t("battleStart")}
      </Text>
      <View style={[logStyles.startHpSide, { alignItems: "flex-end", gap: 2 }]}>
        <Text style={logStyles.startHpName} numberOfLines={1}>
          {rightName}
        </Text>
        <Text style={logStyles.startHpVal}>❤️ {rightStartHp} HP</Text>
        {rightStartStats && (
          <Text style={logStyles.startStatText}>
            ⚔️ {rightStartStats.attack} 🛡️ {rightStartStats.defense} 🎯{" "}
            {rightStartStats.chance}%
          </Text>
        )}
      </View>
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
  const { t } = useLanguage();
  const newRound = !prevEntry || prevEntry.round !== entry.round;
  const leftAttacks = entry.actor === "left";
  const blocked = entry.damage === 0;
  const leftHp = entry.leftHpAfter;
  const rightHp = entry.rightHpAfter;
  const leftTookDamage = !leftAttacks && !blocked;
  const rightTookDamage = leftAttacks && !blocked;
  const arrowColor = leftAttacks ? "#e67e22" : "#e74c3c";

  return (
    <View style={logStyles.row}>
      {newRound && (
        <View style={logStyles.roundBadge}>
          <Text style={logStyles.roundText}>
            {t("battleRoundPrefix")} {entry.round + 1} —
          </Text>
        </View>
      )}
      <View
        style={[
          logStyles.line,
          leftAttacks ? logStyles.lineLeftAtk : logStyles.lineRightAtk,
        ]}
      >
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
                  <Text style={logStyles.critText}>{t("battleCrit")}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={logStyles.statBadgeRow}>
              {entry.defBoosted && (
                <View style={logStyles.blockBadge}>
                  <Text style={logStyles.blockText}>{t("battleShield")}</Text>
                </View>
              )}
              <Text style={logStyles.defVal}>DEF {entry.defenseValue}</Text>
            </View>
          )}
        </View>
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
              {blocked ? t("battleBlocked") : `−${entry.damage}`}
            </Text>
          </View>
        </View>
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
                  <Text style={logStyles.critText}>{t("battleCrit")}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[logStyles.statBadgeRow, logStyles.statBadgeRowRight]}>
              {entry.defBoosted && (
                <View style={logStyles.blockBadge}>
                  <Text style={logStyles.blockText}>{t("battleShield")}</Text>
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

// ─────────────────────────────────────────────────────────────────────────────
// Boss combat log entry — shows exactly who attacked whom
// ─────────────────────────────────────────────────────────────────────────────

function BossLogEntry({
  entry,
  prevEntry,
  b,
}: {
  entry: BossLogEntry;
  prevEntry: BossLogEntry | null;
  b: BossNormalized;
}) {
  const { t } = useLanguage();
  const newRound = !prevEntry || prevEntry.round !== entry.round;
  const isChampAtk = entry.actor === "c1" || entry.actor === "c2";
  const champName =
    entry.actor === "c1" || entry.actor === "boss_vs_c1" ? b.c1Name : b.c2Name;
  const champCls =
    entry.actor === "c1" || entry.actor === "boss_vs_c1"
      ? b.c1Class
      : b.c2Class;
  const blocked = entry.damage === 0;

  // HP shown: champ HP and boss HP
  const champHp =
    entry.actor === "c1" || entry.actor === "boss_vs_c1"
      ? entry.c1HpAfter
      : entry.c2HpAfter;

  const bgColor = isChampAtk ? "#f5fdf5" : "#fdf5f5";
  const borderColor = isChampAtk ? "#b2d8b2" : "#e0b8b8";
  const arrowColor = isChampAtk ? "#e67e22" : "#e74c3c";

  return (
    <View style={logStyles.row}>
      {newRound && (
        <View style={logStyles.roundBadge}>
          <Text style={logStyles.roundText}>
            {t("battleRoundPrefix")} {entry.round + 1} —
          </Text>
        </View>
      )}
      <View style={[logStyles.line, { backgroundColor: bgColor, borderColor }]}>
        {/* Attacker side */}
        <View style={logStyles.side}>
          <View style={logStyles.nameRow}>
            {isChampAtk ? (
              <MiniPortrait cls={champCls} />
            ) : (
              <MiniPortrait cls={null} fallbackImg={b.bossImg} />
            )}
            <Text
              style={[
                logStyles.sideName,
                { color: isChampAtk ? "#2d6e24" : "#a02020" },
              ]}
              numberOfLines={1}
            >
              {isChampAtk ? champName : b.bossName}
            </Text>
          </View>
          <View style={logStyles.statBadgeRow}>
            <Text style={logStyles.atkVal}>ATK {entry.attackValue}</Text>
            {entry.atkBoosted && (
              <View style={logStyles.critBadge}>
                <Text style={logStyles.critText}>{t("battleCrit")}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Center */}
        <View style={logStyles.center}>
          <ArrowRight size={20} color={arrowColor} strokeWidth={2.5} />
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
              {blocked ? t("battleBlocked") : `−${entry.damage}`}
            </Text>
          </View>
        </View>

        {/* Defender side */}
        <View
          style={[
            logStyles.side,
            logStyles.sideRight,
            !blocked && logStyles.sideDamaged,
          ]}
        >
          <View style={[logStyles.nameRow, { justifyContent: "flex-end" }]}>
            <Text
              style={[logStyles.sideName, { color: "#555" }]}
              numberOfLines={1}
            >
              {isChampAtk ? b.bossName : champName}
            </Text>
            {isChampAtk ? (
              <MiniPortrait cls={null} fallbackImg={b.bossImg} />
            ) : (
              <MiniPortrait cls={champCls} />
            )}
          </View>
          {/* Show HP after the hit */}
          <Text
            style={[
              logStyles.hpText,
              logStyles.hpRight,
              !blocked && logStyles.hpDamaged,
            ]}
          >
            {isChampAtk ? entry.bossHpAfter : champHp} HP
          </Text>
          <View style={[logStyles.statBadgeRow, logStyles.statBadgeRowRight]}>
            {entry.defBoosted && (
              <View style={logStyles.blockBadge}>
                <Text style={logStyles.blockText}>{t("battleShield")}</Text>
              </View>
            )}
            <Text style={logStyles.defVal}>DEF {entry.defenseValue}</Text>
          </View>
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
  startStatText: { fontSize: 11, fontWeight: "700", color: "#5a3e1b" },
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
// Boss VS section
// ─────────────────────────────────────────────────────────────────────────────

function BossVsSection({ b }: { b: BossNormalized }) {
  const c1Meta = CLASS_META[b.c1Class] ?? null;
  const c2Meta = b.c2Class ? (CLASS_META[b.c2Class] ?? null) : null;
  const bossImg = b.bossImg;

  return (
    <View style={bossStyles.vsRow}>
      {/* Champions — side by side */}
      <View style={bossStyles.championsRow}>
        <View style={bossStyles.champCol}>
          <View
            style={[
              bossStyles.portrait,
              { borderColor: c1Meta?.color ?? "#9a7040" },
            ]}
          >
            {c1Meta ? (
              <Image
                source={c1Meta.image}
                style={bossStyles.portraitImg}
                resizeMode="contain"
              />
            ) : (
              <Text style={{ fontSize: 22 }}>🐱</Text>
            )}
          </View>
          <Text style={bossStyles.champName} numberOfLines={1}>
            {b.c1Name}
          </Text>
        </View>

        <Text style={bossStyles.plusText}>+</Text>

        <View style={bossStyles.champCol}>
          <View
            style={[
              bossStyles.portraitSmall,
              { borderColor: c2Meta?.color ?? "#9a7040" },
            ]}
          >
            {c2Meta ? (
              <Image
                source={c2Meta.image}
                style={bossStyles.portraitImgSmall}
                resizeMode="contain"
              />
            ) : (
              <Text style={{ fontSize: 18 }}>🐱</Text>
            )}
          </View>
          <Text style={bossStyles.champNameSmall} numberOfLines={1}>
            {b.c2Name}
          </Text>
        </View>
      </View>

      {/* VS */}
      <View style={bossStyles.vsCenter}>
        <Text style={bossStyles.vsText}>VS</Text>
      </View>

      {/* Boss on the right */}
      <View style={bossStyles.bossBlock}>
        <View style={[bossStyles.bossPortraitWrap]}>
          {bossImg ? (
            <Image
              source={bossImg}
              style={bossStyles.portraitImg}
              resizeMode="contain"
            />
          ) : (
            <Text style={{ fontSize: 28 }}>👹</Text>
          )}
        </View>
        <View style={bossStyles.bossBadge}>
          <Text style={bossStyles.bossBadgeText}>👑 BOSS</Text>
        </View>
        <Text style={bossStyles.champName} numberOfLines={1}>
          {b.bossName}
        </Text>
      </View>
    </View>
  );
}

const bossStyles = StyleSheet.create({
  vsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 4,
  },
  championsRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  champCol: { alignItems: "center", gap: 2 },
  portrait: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef4e4",
  },
  portraitSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef4e4",
  },
  portraitImg: { width: 32, height: 32 },
  portraitImgSmall: { width: 26, height: 26 },
  champName: {
    fontSize: 10,
    fontWeight: "700",
    color: "#3a2a10",
    maxWidth: 68,
    textAlign: "center",
  },
  champNameSmall: {
    fontSize: 9,
    fontWeight: "700",
    color: "#3a2a10",
    maxWidth: 56,
    textAlign: "center",
  },
  plusText: { fontSize: 14, fontWeight: "800", color: "#7a5a30" },
  vsCenter: { paddingHorizontal: 6, alignItems: "center" },
  vsText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#9a7040",
    letterSpacing: 1,
  },
  bossBlock: { flex: 1, alignItems: "flex-end", gap: 2 },
  bossPortraitWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: "#f39c12",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef4e4",
  },
  bossBadge: {
    backgroundColor: "#f39c12",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  bossBadgeText: { fontSize: 9, fontWeight: "800", color: "#fff" },
});

// ─────────────────────────────────────────────────────────────────────────────
// Boss starting HP row
// ─────────────────────────────────────────────────────────────────────────────

function StatBlock({
  stats,
  fallbackHp,
  name,
  align,
}: {
  stats?: { attack: number; defense: number; chance: number; hp: number };
  fallbackHp?: number | null;
  name: string;
  align: "left" | "right";
}) {
  const hp = stats?.hp ?? fallbackHp;
  return (
    <View
      style={{
        gap: 2,
        alignItems: align === "right" ? "flex-end" : "flex-start",
      }}
    >
      <Text style={logStyles.startHpName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={logStyles.startHpVal}>❤️ {hp ?? "?"} HP</Text>
      {stats && (
        <>
          <Text style={logStyles.startStatText}>
            ⚔️ {stats.attack} 🛡️ {stats.defense} 🎯 {stats.chance}%
          </Text>
        </>
      )}
    </View>
  );
}

function BossStartHpRow({ b }: { b: BossNormalized }) {
  const { t } = useLanguage();
  const log = b.log;
  if (log.length === 0 && !b.c1StartStats) return null;

  // Derive fallback starting HPs from log when start stats aren't available
  let c1FallbackHp: number | null = null;
  let c2FallbackHp: number | null = null;
  let bossFallbackHp: number | null = null;

  if (!b.c1StartStats) {
    for (const e of log) {
      if (
        bossFallbackHp === null &&
        (e.actor === "c1" || e.actor === "c2") &&
        e.damage > 0
      ) {
        bossFallbackHp = e.bossHpAfter + e.damage;
      }
      if (c1FallbackHp === null && e.actor === "boss_vs_c1" && e.damage > 0) {
        c1FallbackHp = e.c1HpAfter + e.damage;
      }
      if (c2FallbackHp === null && e.actor === "boss_vs_c2" && e.damage > 0) {
        c2FallbackHp = e.c2HpAfter + e.damage;
      }
      if (
        c1FallbackHp !== null &&
        c2FallbackHp !== null &&
        bossFallbackHp !== null
      )
        break;
    }
    const firstC1 = log.find(
      (e) => e.actor === "c1" || e.actor === "boss_vs_c1",
    );
    const firstC2 = log.find(
      (e) => e.actor === "c2" || e.actor === "boss_vs_c2",
    );
    if (c1FallbackHp === null && firstC1) c1FallbackHp = firstC1.c1HpAfter;
    if (c2FallbackHp === null && firstC2) c2FallbackHp = firstC2.c2HpAfter;
    if (bossFallbackHp === null && log[0]) bossFallbackHp = log[0].bossHpAfter;
  }

  return (
    <View
      style={[
        logStyles.startHpRow,
        { justifyContent: "space-between", alignItems: "flex-start" },
      ]}
    >
      <View style={{ gap: 6 }}>
        <StatBlock
          stats={b.c1StartStats}
          fallbackHp={c1FallbackHp}
          name={b.c1Name}
          align="left"
        />
        <StatBlock
          stats={b.c2StartStats}
          fallbackHp={c2FallbackHp}
          name={b.c2Name}
          align="left"
        />
      </View>
      <Text style={[logStyles.startHpVs, { marginTop: 4 }]}>
        {t("battleStart")}
      </Text>
      <StatBlock
        stats={b.bossStartStats}
        fallbackHp={bossFallbackHp}
        name={b.bossName}
        align="right"
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function BattleHistoryDrawer(props: Props) {
  const { visible, onClose } = props;
  const { t } = useLanguage();

  const isBoss = props.mode === "pve" && !!props.result?.isBossBattle;

  const boss: BossNormalized | null = useMemo(() => {
    if (!isBoss || props.mode !== "pve") return null;
    return normalizeBoss(
      props.result,
      props.championName,
      props.championClass,
      props.champion2Name ?? props.result.champion2Name ?? "Champion 2",
      props.champion2Class ?? props.result.champion2Class ?? null,
    );
  }, [isBoss, props]);

  const n: Normalized | null = useMemo(() => {
    if (isBoss) return null;
    if (props.mode === "pvp") {
      if (!props.battle) return null;
      return normalize(props);
    } else {
      if (!props.result) return null;
      return normalize(props);
    }
  }, [isBoss, props]);

  if (!n && !boss) return null;

  const won = boss ? boss.won : n!.won;

  const subtitleText =
    props.mode === "pvp"
      ? `vs ${props.battle.attacker_id === props.myPlayerId ? props.battle.defender_name : props.battle.attacker_name}`
      : won
        ? t("battleDungeonCleared")
        : t("battleEnemyTooStrong");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* HEADER */}
          <View
            style={[styles.header, won ? styles.headerWin : styles.headerLose]}
          >
            {isBoss && <Text style={styles.bossTag}>👑 BOSS BATTLE</Text>}
            <Text style={styles.title}>
              {won ? t("battleVictory") : t("battleDefeat")}
            </Text>
            <Text style={styles.subtitle}>{subtitleText}</Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
          >
            {/* VS SECTION */}
            {boss ? (
              <BossVsSection b={boss} />
            ) : (
              <View style={styles.vsSection}>
                <ChampionPortrait
                  name={n!.leftName}
                  cls={n!.leftClass}
                  gear={n!.leftGear}
                  align="left"
                />
                <View style={styles.vsCenter}>
                  <Text style={styles.vsText}>VS</Text>
                </View>
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <ChampionPortrait
                    name={n!.rightName}
                    cls={n!.rightClass}
                    gear={n!.rightGear}
                    align="right"
                    enemyImg={n!.rightEnemyImg}
                  />
                </View>
              </View>
            )}

            {/* OUTCOME */}
            <View style={styles.outcomeSection}>
              {props.mode === "pvp" ? (
                <PvpOutcome n={n!} won={won} />
              ) : boss ? (
                <View style={{ gap: 8 }}>
                  <RewardsBlock n={boss} />
                  {/* Champion 2 XP row */}
                  {(boss.champion2XpGained ?? 0) > 0 && (
                    <View
                      style={[
                        outcomeStyles.row,
                        { justifyContent: "flex-start", gap: 8 },
                      ]}
                    >
                      <View style={outcomeStyles.xpPill}>
                        <Text style={outcomeStyles.xpText}>
                          {boss.c2Name}: +{boss.champion2XpGained} XP
                        </Text>
                      </View>
                      {(boss.champion2LevelsGained ?? 0) > 0 && (
                        <View style={outcomeStyles.levelUpBadge}>
                          <Text style={outcomeStyles.levelUpText}>
                            {t("battleLevelUpPrefix")} {boss.champion2NewLevel}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ) : (
                <RewardsBlock n={n!} />
              )}
            </View>

            {/* COMBAT LOG */}
            {boss && boss.log.length > 0 && (
              <View style={styles.logSection}>
                <Text style={styles.logTitle}>{t("battleCombatLog")}</Text>
                <BossStartHpRow b={boss} />
                {boss.log.map((entry, i) => (
                  <BossLogEntry
                    key={i}
                    entry={entry}
                    prevEntry={i > 0 ? boss.log[i - 1] : null}
                    b={boss}
                  />
                ))}
              </View>
            )}

            {!boss && n!.log.length > 0 && (
              <View style={styles.logSection}>
                <Text style={styles.logTitle}>{t("battleCombatLog")}</Text>
                <StartHpRow
                  log={n!.log}
                  leftName={n!.leftName}
                  rightName={n!.rightName}
                  leftStartStats={n!.leftStartStats}
                  rightStartStats={n!.rightStartStats}
                />
                {n!.log.map((entry, i) => (
                  <CombatLogEntry
                    key={i}
                    entry={entry}
                    prevEntry={i > 0 ? n!.log[i - 1] : null}
                    leftName={n!.leftName}
                    rightName={n!.rightName}
                    leftClass={n!.leftClass}
                    rightClass={n!.rightClass}
                    rightEnemyImg={n!.rightEnemyImg}
                  />
                ))}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.btn} onPress={onClose}>
            <Text style={styles.btnText}>{t("battleClose")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

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
  bossTag: {
    fontSize: 11,
    fontWeight: "800",
    color: "#b8860b",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
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
  vsCenter: { paddingTop: 16, paddingHorizontal: 6, alignItems: "center" },
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
