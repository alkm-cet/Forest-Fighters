import { useRef, useEffect, useState } from "react";
import {
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  PanResponder,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import { Text } from "./StyledText";
import { X, Sparkles, Trash2, Swords, Shield, Zap } from "lucide-react-native";
import { Champion, PlayerGear, GearRarity, PlayerFood } from "../types";
import { RARITY_META, CLASS_META } from "../constants/resources";
import {
  useGearInventoryQuery,
  useKitchenInventoryQuery,
} from "../lib/query/queries";
import {
  useEquipGearMutation,
  useUnequipGearMutation,
  useUpgradeGearMutation,
  useDiscardGearMutation,
} from "../lib/query/mutations";
import { useLanguage } from "../lib/i18n";
import type { TranslationKeys } from "../lib/i18n";

const COIN_IMG = require("../assets/icons/icon-coin.webp");

export const GEAR_IMAGES: Record<string, any> = {
  iron_sword: require("../assets/items/item-iron-sword.webp"),
  steel_axe: require("../assets/items/item-steel-axe.webp"),
  battle_blade: require("../assets/items/item-battle-blade.webp"),
  oak_staff: require("../assets/items/item-oak-staff.webp"),
  crystal_staff: require("../assets/items/item-crystal-staff.webp"),
  arcane_orb: require("../assets/items/item-arcane-orb.webp"),
  pine_bow: require("../assets/items/item-pine-bow.webp"),
  hunter_bow: require("../assets/items/item-hunter-bow.webp"),
  shadow_bow: require("../assets/items/item-shadow-bow.webp"),
  forest_charm: require("../assets/items/item-forest-charm.webp"),
  silver_charm: require("../assets/items/item-silver-charm.webp"),
  dragon_charm: require("../assets/items/item-dragon-charm.webp"),
};

const FORGE_STONE_IMGS = [
  require("../assets/firestone-t1.webp"),
  require("../assets/firestone-t2.webp"),
  require("../assets/firestone-t3.webp"),
];

const DISMISS_THRESHOLD = 100;
const DISMISS_VELOCITY = 0.6;

// Tier colors
const TIER_COLOR: Record<number, string> = {
  1: "#5a8a3c",
  2: "#c87820",
  3: "#8a4cc8",
};

function calcDiscardCoins(gear: PlayerGear): number {
  const rarityBonus =
    gear.rarity === "epic" ? 4 : gear.rarity === "rare" ? 2 : 0;
  return rarityBonus + (gear.definition.tier - 1) + gear.level;
}

type Props = {
  champion: Champion | null;
  visible: boolean;
  onClose: () => void;
};

// ── Minimal badge helpers (used in discard modal) ──────────────────────────────
function TierBadge({ tier }: { tier: number }) {
  const bg = TIER_COLOR[tier] ?? "#888";
  return (
    <View style={{ backgroundColor: bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>T{tier}</Text>
    </View>
  );
}
function RarityBadge({ rarity }: { rarity: GearRarity }) {
  const meta = RARITY_META[rarity];
  return (
    <View style={{ backgroundColor: meta?.color ?? "#888", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>{meta?.label ?? rarity}</Text>
    </View>
  );
}
function LevelBadge({ level }: { level: number }) {
  return (
    <View style={{ backgroundColor: "#3a2a10", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>Lv{level}</Text>
    </View>
  );
}

// ── Stat row ───────────────────────────────────────────────────────────────────
function StatRow({ gear, t }: { gear: PlayerGear; t: (key: TranslationKeys) => string }) {
  const stat =
    gear.attack_bonus > 0
      ? { label: t("gearStatAttack"), value: gear.attack_bonus, icon: <Swords size={13} color="#c0392b" strokeWidth={2.5} />, color: "#c0392b", bg: "#fce8e4" }
      : gear.defense_bonus > 0
        ? { label: t("gearStatDefense"), value: gear.defense_bonus, icon: <Shield size={13} color="#1565c0" strokeWidth={2.5} />, color: "#1565c0", bg: "#e3eeff" }
        : gear.chance_bonus > 0
          ? { label: t("gearStatChance"), value: gear.chance_bonus, icon: <Zap size={13} color="#2e7d32" strokeWidth={2.5} />, color: "#2e7d32", bg: "#e8f5e9" }
          : null;
  if (!stat) return null;
  return (
    <View style={[cardStyles.statRow, { backgroundColor: stat.bg }]}>
      {stat.icon}
      <Text style={[cardStyles.statLabel, { color: stat.color }]}>{stat.label}</Text>
      <Text style={[cardStyles.statValue, { color: stat.color }]}>+{stat.value}</Text>
    </View>
  );
}

// ── Dismiss animation wrapper ──────────────────────────────────────────────────
function DismissableCard({
  dismissing,
  onDismissed,
  children,
}: {
  dismissing: boolean;
  onDismissed: () => void;
  children: React.ReactNode;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (dismissing) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -320,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start(() => onDismissed());
    }
  }, [dismissing]);

  return (
    <Animated.View style={{ transform: [{ translateX }], opacity }}>
      {children}
    </Animated.View>
  );
}

// ── Unified gear card ──────────────────────────────────────────────────────────
function GearCard({
  gear,
  mode,
  onPrimary,
  onUpgrade,
  forgeStones,
  isDeployed,
  t,
}: {
  gear: PlayerGear;
  mode: "equip" | "unequip";
  onPrimary: () => void;
  onUpgrade?: (stoneIds: string[]) => void;
  forgeStones: PlayerFood[];
  isDeployed: boolean;
  t: (key: TranslationKeys) => string;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const meta        = RARITY_META[gear.rarity];
  const tierColor   = TIER_COLOR[gear.definition.tier] ?? "#888";
  const stonesNeeded = gear.level === 1 ? 1 : 2;
  const validStones  = forgeStones.filter((f) => {
    const tier = (f.recipe as any).gear_upgrade_tier;
    return tier === gear.definition.tier || tier === 3;
  });
  const canUpgrade    = gear.level < 3 && validStones.length >= stonesNeeded;
  const isMaxLevel    = gear.level >= 3;
  const primaryDisabled = isDeployed;

  return (
    <View style={cardStyles.card}>
      {/* LV badge — absolute top-right */}
      <View style={cardStyles.lvBadge}>
        <Text style={cardStyles.lvText}>LV </Text>
        <Text style={cardStyles.lvNum}>{gear.level}</Text>
      </View>

      <View style={cardStyles.inner}>
        {/* Top row: icon box + name + tier/rarity badges */}
        <View style={cardStyles.topRow}>
          <View style={cardStyles.iconBox}>
            {GEAR_IMAGES[gear.definition.id] ? (
              <Image source={GEAR_IMAGES[gear.definition.id]} style={cardStyles.itemImg} resizeMode="contain" />
            ) : (
              <Text style={cardStyles.itemEmoji}>{gear.definition.emoji}</Text>
            )}
          </View>
          <View style={cardStyles.infoCol}>
            <Text style={cardStyles.itemName} numberOfLines={1}>{gear.definition.name}</Text>
            <View style={cardStyles.badgeRow}>
              {/* Tier badge */}
              <View style={[cardStyles.tierBadge, { backgroundColor: tierColor }]}>
                <Text style={cardStyles.tierText}>T{gear.definition.tier}</Text>
              </View>
              {/* Rarity badge */}
              <View style={[cardStyles.rarityBadge, { backgroundColor: meta.color }]}>
                <Text style={cardStyles.rarityText}>{meta.label.toUpperCase()}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stat row */}
        <StatRow gear={gear} t={t} />

        {/* Bottom row: stone/upgrade slot + primary action */}
        <View style={cardStyles.bottomRow}>
          {/* Stone / upgrade slot */}
          {isMaxLevel ? (
            <View style={[cardStyles.stonePill, cardStyles.stonePillMax]}>
              <Text style={cardStyles.stonePillMaxText}>✦ MAX</Text>
            </View>
          ) : canUpgrade ? (
            <TouchableOpacity
              style={[cardStyles.stonePill, cardStyles.stonePillHas]}
              onPress={() => setUpgradeOpen((v) => !v)}
              activeOpacity={0.75}
            >
              <View style={cardStyles.gemDot} />
              <Sparkles size={10} color="#4a7c3f" strokeWidth={2.5} />
              <Text style={cardStyles.stonePillHasText}>{t("gearUpgradeBtn")} ({stonesNeeded})</Text>
            </TouchableOpacity>
          ) : (
            <View style={[cardStyles.stonePill, cardStyles.stonePillNone]}>
              <Sparkles size={10} color="rgba(255,255,255,0.4)" strokeWidth={2.5} />
              <Text style={cardStyles.stonePillNoneText}>{t("gearNoStonesLabel")}</Text>
            </View>
          )}

          {/* Primary action button */}
          <TouchableOpacity
            style={[
              cardStyles.actionBtn,
              mode === "equip" ? cardStyles.equipBtn : cardStyles.unequipBtn,
              primaryDisabled && cardStyles.actionBtnDisabled,
            ]}
            onPress={primaryDisabled ? undefined : onPrimary}
            disabled={primaryDisabled}
            activeOpacity={0.75}
          >
            <Text style={cardStyles.actionBtnText}>
              {mode === "equip" ? t("gearEquipBtn") : t("gearUnequipBtn")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Upgrade confirm panel */}
        {upgradeOpen && canUpgrade && (
          <View style={cardStyles.upgradePanel}>
            <Text style={cardStyles.upgradePanelText}>
              {stonesNeeded} {t("gearUpgradeStonesWillUse")}:{" "}
              {validStones.slice(0, stonesNeeded).map((s) => s.recipe.name).join(" + ")}
            </Text>
            <TouchableOpacity
              style={cardStyles.confirmBtn}
              onPress={() => {
                onUpgrade?.(validStones.slice(0, stonesNeeded).map((s) => s.id));
                setUpgradeOpen(false);
              }}
            >
              <Sparkles size={12} color="#fff" strokeWidth={2} />
              <Text style={cardStyles.confirmBtnText}>{t("gearConfirmUpgrade")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Inventory card (GearCard + external trash button) ─────────────────────────
function InventoryCard({
  gear,
  dismissing,
  onEquip,
  onUpgrade,
  onDiscard,
  onDismissed,
  forgeStones,
  isDeployed,
  t,
}: {
  gear: PlayerGear;
  dismissing: boolean;
  onEquip: () => void;
  onUpgrade?: (stoneIds: string[]) => void;
  onDiscard: () => void;
  onDismissed: () => void;
  forgeStones: PlayerFood[];
  isDeployed: boolean;
  t: (key: TranslationKeys) => string;
}) {
  return (
    <DismissableCard dismissing={dismissing} onDismissed={onDismissed}>
      <View style={styles.invRow}>
        <View style={{ flex: 1 }}>
          <GearCard
            gear={gear}
            mode="equip"
            onPrimary={onEquip}
            onUpgrade={onUpgrade}
            forgeStones={forgeStones}
            isDeployed={isDeployed}
            t={t}
          />
        </View>
        <TouchableOpacity
          style={styles.discardBtn}
          onPress={onDiscard}
          activeOpacity={0.75}
        >
          <Trash2 size={15} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </DismissableCard>
  );
}

// ── Main drawer ────────────────────────────────────────────────────────────────
export default function GearDrawer({ champion, visible, onClose }: Props) {
  const { t } = useLanguage();
  const translateY = useRef(new Animated.Value(0)).current;
  const [activeTab, setActiveTab] = useState<"weapon" | "charm">("weapon");
  const [discardTarget, setDiscardTarget] = useState<PlayerGear | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const { data: allGear = [] } = useGearInventoryQuery();
  const { data: kitchenItems = [] } = useKitchenInventoryQuery();

  const equipMutation = useEquipGearMutation();
  const unequipMutation = useUnequipGearMutation();
  const upgradeMutation = useUpgradeGearMutation();
  const discardMutation = useDiscardGearMutation();

  const forgeStones: PlayerFood[] = (kitchenItems as PlayerFood[]).filter(
    (f) =>
      f.status === "ready" && (f.recipe as any).effect_type === "gear_upgrade",
  );

  const stoneCountT1 = forgeStones.filter(
    (f) => (f.recipe as any).gear_upgrade_tier === 1,
  ).length;
  const stoneCountT2 = forgeStones.filter(
    (f) => (f.recipe as any).gear_upgrade_tier === 2,
  ).length;
  const stoneCountT3 = forgeStones.filter(
    (f) => (f.recipe as any).gear_upgrade_tier === 3,
  ).length;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD || g.vy > DISMISS_VELOCITY) {
          Animated.timing(translateY, {
            toValue: 600,
            duration: 200,
            useNativeDriver: true,
          }).start(onClose);
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (champion) {
      translateY.setValue(0);
      setActiveTab("weapon");
    }
  }, [champion?.id]);

  if (!visible || !champion) return null;

  const classMeta = CLASS_META[champion.class] ?? {
    image: null,
    color: "#888",
  };

  const equippedWeapon =
    allGear.find(
      (g) =>
        g.equipped_champion_id === champion.id && g.equipped_slot === "weapon",
    ) ?? null;
  const equippedCharm =
    allGear.find(
      (g) =>
        g.equipped_champion_id === champion.id && g.equipped_slot === "charm",
    ) ?? null;

  const inventoryWeapons = allGear.filter(
    (g) =>
      g.equipped_champion_id === null &&
      g.definition.gear_type === "weapon" &&
      (g.definition.class_restriction === null ||
        g.definition.class_restriction === champion.class),
  );
  const inventoryCharms = allGear.filter(
    (g) =>
      g.equipped_champion_id === null && g.definition.gear_type === "charm",
  );

  async function handleEquip(gear: PlayerGear, slot: "weapon" | "charm") {
    try {
      await equipMutation.mutateAsync({
        gearId: gear.id,
        champion_id: champion!.id,
        slot,
      });
    } catch (e: any) {
      Alert.alert(
        t("gearErrorTitle"),
        e?.response?.data?.error ?? t("gearErrorEquip"),
      );
    }
  }

  async function handleUnequip(gear: PlayerGear) {
    try {
      await unequipMutation.mutateAsync(gear.id);
    } catch (e: any) {
      Alert.alert(
        t("gearErrorTitle"),
        e?.response?.data?.error ?? t("gearErrorUnequip"),
      );
    }
  }

  async function handleUpgrade(gear: PlayerGear, stoneIds: string[]) {
    try {
      await upgradeMutation.mutateAsync({
        gearId: gear.id,
        food_ids: stoneIds,
      });
    } catch (e: any) {
      Alert.alert(
        t("gearErrorTitle"),
        e?.response?.data?.error ?? t("gearErrorUpgrade"),
      );
    }
  }

  function startDismiss(gear: PlayerGear) {
    setDiscardTarget(null);
    setDismissingId(gear.id);
    discardMutation.mutateAsync(gear.id).catch((e: any) => {
      setDismissingId(null);
      Alert.alert(
        t("gearErrorTitle"),
        e?.response?.data?.error ?? t("gearDiscardFailed"),
      );
    });
  }

  const tabItems = activeTab === "weapon" ? inventoryWeapons : inventoryCharms;

  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.drawer, { transform: [{ translateY }] }]}>
        {/* Handle */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View
            style={[
              styles.champPortrait,
              { borderColor: classMeta.color + "88" },
            ]}
          >
            {classMeta.image && (
              <Image
                source={classMeta.image}
                style={styles.champPortraitImg}
                resizeMode="contain"
              />
            )}
          </View>
          <View style={styles.headerMeta}>
            <Text style={styles.headerTitle}>{champion.name}</Text>
            <View style={styles.headerSubRow}>
              <View
                style={[
                  styles.classBadge,
                  {
                    backgroundColor: classMeta.color + "22",
                    borderColor: classMeta.color,
                  },
                ]}
              >
                <Text
                  style={[styles.classBadgeText, { color: classMeta.color }]}
                >
                  {champion.class}
                </Text>
              </View>
              <View style={styles.stoneCountRow}>
                {stoneCountT1 > 0 && (
                  <View
                    style={[
                      styles.stoneCountBadge,
                      { backgroundColor: "#5a8a3c22", borderColor: "#5a8a3c" },
                    ]}
                  >
                    <Image
                      source={FORGE_STONE_IMGS[0]}
                      style={styles.stoneCountImg}
                      resizeMode="contain"
                    />
                    <Text style={[styles.stoneCountText, { color: "#5a8a3c" }]}>
                      ×{stoneCountT1}
                    </Text>
                  </View>
                )}
                {stoneCountT2 > 0 && (
                  <View
                    style={[
                      styles.stoneCountBadge,
                      { backgroundColor: "#c8782022", borderColor: "#c87820" },
                    ]}
                  >
                    <Image
                      source={FORGE_STONE_IMGS[1]}
                      style={styles.stoneCountImg}
                      resizeMode="contain"
                    />
                    <Text style={[styles.stoneCountText, { color: "#c87820" }]}>
                      ×{stoneCountT2}
                    </Text>
                  </View>
                )}
                {stoneCountT3 > 0 && (
                  <View
                    style={[
                      styles.stoneCountBadge,
                      { backgroundColor: "#8a4cc822", borderColor: "#8a4cc8" },
                    ]}
                  >
                    <Image
                      source={FORGE_STONE_IMGS[2]}
                      style={styles.stoneCountImg}
                      resizeMode="contain"
                    />
                    <Text style={[styles.stoneCountText, { color: "#8a4cc8" }]}>
                      ×{stoneCountT3}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <X size={14} color="#7a5230" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerDivider} />

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ── Equipped section ── */}
          <Text style={styles.sectionLabel}>{t("gearEquippedSection")}</Text>
          <View style={styles.equippedRow}>
            {/* Weapon slot */}
            <View style={styles.equippedSlotCol}>
              <Text style={styles.slotTitle}>{t("gearWeaponSlot")}</Text>
              {equippedWeapon ? (
                <GearCard
                  gear={equippedWeapon}
                  mode="unequip"
                  onPrimary={() => handleUnequip(equippedWeapon)}
                  onUpgrade={(ids) => handleUpgrade(equippedWeapon, ids)}
                  forgeStones={forgeStones}
                  isDeployed={champion.is_deployed}
                  t={t}
                />
              ) : (
                <View style={styles.emptySlot}>
                  <Text style={styles.emptySlotEmoji}>⚔️</Text>
                  <Text style={styles.emptySlotText}>{t("gearNoWeapon")}</Text>
                </View>
              )}
            </View>
            {/* Charm slot */}
            <View style={styles.equippedSlotCol}>
              <Text style={styles.slotTitle}>{t("gearCharmSlot")}</Text>
              {equippedCharm ? (
                <GearCard
                  gear={equippedCharm}
                  mode="unequip"
                  onPrimary={() => handleUnequip(equippedCharm)}
                  onUpgrade={(ids) => handleUpgrade(equippedCharm, ids)}
                  forgeStones={forgeStones}
                  isDeployed={champion.is_deployed}
                  t={t}
                />
              ) : (
                <View style={styles.emptySlot}>
                  <Text style={styles.emptySlotEmoji}>🍀</Text>
                  <Text style={styles.emptySlotText}>{t("gearNoCharm")}</Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Inventory header + tabs ── */}
          <View style={styles.inventoryHeader}>
            <Text style={styles.sectionLabel}>{t("gearInventorySection")}</Text>
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={styles.tabBtn}
                onPress={() => setActiveTab("weapon")}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    activeTab === "weapon" && styles.tabBtnTextActive,
                  ]}
                >
                  {t("gearWeaponsTab")} ({inventoryWeapons.length})
                </Text>
                {activeTab === "weapon" && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tabBtn}
                onPress={() => setActiveTab("charm")}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    activeTab === "charm" && styles.tabBtnTextActive,
                  ]}
                >
                  {t("gearCharmsTab")} ({inventoryCharms.length})
                </Text>
                {activeTab === "charm" && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 12 }} />

          {tabItems.length === 0 ? (
            <View style={styles.emptyInventory}>
              <Image
                source={require("../assets/items/item-steel-axe.webp")}
                style={styles.emptyInventoryLogo}
                resizeMode="contain"
              />
              <Text style={styles.emptyInventoryText}>
                {t("gearEmptyTitle")}
              </Text>
              <Text style={styles.emptyInventoryHint}>
                {t("gearEmptyHint")}
              </Text>
            </View>
          ) : (
            tabItems.map((gear) => (
              <InventoryCard
                key={gear.id}
                gear={gear}
                dismissing={dismissingId === gear.id}
                onEquip={() =>
                  handleEquip(
                    gear,
                    gear.definition.gear_type as "weapon" | "charm",
                  )
                }
                onUpgrade={(ids) => handleUpgrade(gear, ids)}
                onDiscard={() => setDiscardTarget(gear)}
                onDismissed={() => setDismissingId(null)}
                forgeStones={forgeStones}
                isDeployed={champion.is_deployed}
                t={t}
              />
            ))
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>

      {/* ── Discard confirm modal ── */}
      {discardTarget && (
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setDiscardTarget(null)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
          <View style={styles.discardModal}>
            <Text style={styles.discardModalEmoji}>
              {discardTarget.definition.emoji}
            </Text>
            <Text style={styles.discardModalName}>
              {discardTarget.definition.name}
            </Text>
            <View style={styles.discardModalBadgeRow}>
              <TierBadge tier={discardTarget.definition.tier} />
              <RarityBadge rarity={discardTarget.rarity} />
              <LevelBadge level={discardTarget.level} />
            </View>
            <View style={styles.discardModalCoinRow}>
              <Image
                source={COIN_IMG}
                style={styles.discardModalCoinIcon}
                resizeMode="contain"
              />
              <Text style={styles.discardModalCoinText}>
                +{calcDiscardCoins(discardTarget)}
              </Text>
            </View>
            <Text style={styles.discardModalHint}>
              {t("gearDiscardHint")}
            </Text>
            <View style={styles.discardModalBtnRow}>
              <TouchableOpacity
                style={styles.discardCancelBtn}
                onPress={() => setDiscardTarget(null)}
                activeOpacity={0.75}
              >
                <Text style={styles.discardCancelText}>{t("gearDiscardCancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.discardConfirmBtn}
                onPress={() => startDismiss(discardTarget)}
                activeOpacity={0.75}
              >
                <Trash2 size={13} color="#fff" strokeWidth={2.5} />
                <Text style={styles.discardConfirmText}>{t("gearDiscardConfirm")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  drawer: {
    backgroundColor: "#f5e9cc",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "82%",
    borderTopWidth: 2,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#c8a96e",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  handleArea: { alignItems: "center", paddingVertical: 10 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#c8a96e" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  champPortrait: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#ede0c4",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  champPortraitImg: { width: 46, height: 46 },
  headerMeta: { flex: 1, gap: 4 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: "#3a1e00" },
  headerSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  classBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  classBadgeText: { fontSize: 10, fontWeight: "800" },
  stoneCountRow: { flexDirection: "row", gap: 4 },
  stoneCountBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  stoneCountImg: { width: 16, height: 16 },
  stoneCountText: { fontSize: 10, fontWeight: "800" },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e8d5a8",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerDivider: {
    height: 1,
    backgroundColor: "#d4b896",
    marginHorizontal: 14,
    marginBottom: 4,
  },
  scroll: { paddingHorizontal: 14 },

  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#9a7040",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 8,
  },

  // Equipped slots
  equippedRow: { flexDirection: "row", gap: 8 },
  equippedSlotCol: { flex: 1 },
  slotTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7a5a30",
    marginBottom: 6,
  },
  emptySlot: {
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    borderStyle: "dashed",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#ede0c4",
    minHeight: 136,
  },
  emptySlotEmoji: { fontSize: 26 },
  emptySlotText: {
    fontSize: 10,
    color: "#9a7040",
    fontStyle: "italic",
    fontWeight: "600",
  },

  // Inventory header + tabs
  inventoryHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 4,
  },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#d4b896",
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingBottom: 6,
    alignItems: "center",
    position: "relative",
  },
  tabBtnText: { fontSize: 12, fontWeight: "700", color: "#b8a070" },
  tabBtnTextActive: { color: "#3a1e00", fontWeight: "800" },
  tabUnderline: {
    position: "absolute",
    bottom: -1.5,
    left: 8,
    right: 8,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: "#c8a96e",
  },

  // Inventory row = card + trash button
  invRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  discardBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#c0392b",
    borderWidth: 1.5,
    borderColor: "#922b21",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },

  // (gear card styles moved to cardStyles below)

  // Empty inventory
  emptyInventory: { alignItems: "center", paddingVertical: 28, gap: 6 },
  emptyInventoryLogo: { width: 74, height: 74 },
  emptyInventoryEmoji: { fontSize: 40 },
  emptyInventoryText: { fontSize: 15, fontWeight: "700", color: "#7a5a30" },
  emptyInventoryHint: {
    fontSize: 11,
    color: "#9a7040",
    textAlign: "center",
    lineHeight: 16,
  },

  // Discard modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 60,
  },
  discardModal: {
    backgroundColor: "#f5e9cc",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#c8a96e",
    padding: 24,
    width: "78%",
    alignItems: "center",
    gap: 10,
  },
  discardModalEmoji: { fontSize: 52 },
  discardModalName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#3a1e00",
    textAlign: "center",
  },
  discardModalBadgeRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  discardModalCoinRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ede0c4",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: "#c8a96e",
  },
  discardModalCoinIcon: { width: 22, height: 22 },
  discardModalCoinText: { fontSize: 22, fontWeight: "900", color: "#c87820" },
  discardModalHint: {
    fontSize: 12,
    color: "#7a5a30",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 17,
  },
  discardModalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    width: "100%",
  },
  discardCancelBtn: {
    flex: 1,
    backgroundColor: "#ede0c4",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    paddingVertical: 11,
    alignItems: "center",
  },
  discardCancelText: { fontSize: 13, fontWeight: "800", color: "#7a5030" },
  discardConfirmBtn: {
    flex: 1,
    backgroundColor: "#c0392b",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#922b21",
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  discardConfirmText: { fontSize: 13, fontWeight: "900", color: "#fff" },
});

// ── Card styles (new plaque design) ──────────────────────────────────────────
const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fdf5e4",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#c8a870",
    padding: 12,
    shadowColor: "#6a4010",
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    position: "relative",
    gap: 10,
  },

  // LV badge — top-right absolute
  lvBadge: {
    position: "absolute",
    top: 10,
    right: 18,
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: "#2c2010",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    zIndex: 3,
  },
  lvText: { fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.7)", letterSpacing: 0.5 },
  lvNum:  { fontSize: 12, fontWeight: "900", color: "#fff" },

  inner: { gap: 8 },

  // Top row
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 44, // room for LV badge
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: "#f0e6c8",
    borderWidth: 1.5,
    borderColor: "#c8a870",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemImg:   { width: 42, height: 42 },
  itemEmoji: { fontSize: 30 },
  infoCol:   { flex: 1, gap: 5 },
  itemName:  { fontSize: 14, fontWeight: "900", color: "#2c1a00" },
  badgeRow:  { flexDirection: "row", gap: 3, alignItems: "center" },

  // Tier + rarity badges (connected ribbon style)
  tierBadge: {
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  tierText: { fontSize: 9, fontWeight: "900", color: "#fff", letterSpacing: 0.3 },
  rarityBadge: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  rarityText: { fontSize: 9, fontWeight: "900", color: "#fff", letterSpacing: 0.8 },

  // Stat row
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "900",
  },

  // Bottom row
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  // Stone pills
  stonePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderWidth: 1.5,
  },
  stonePillNone: {
    backgroundColor: "#6a5a48",
    borderColor: "#4a3a2a",
    opacity: 0.6,
  },
  stonePillNoneText: {
    fontSize: 9,
    fontWeight: "900",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 0.5,
  },
  stonePillHas: {
    backgroundColor: "#e8f5e9",
    borderColor: "#4a7c3f",
  },
  stonePillHasText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2d5a24",
  },
  stonePillMax: {
    backgroundColor: "#e8c87a",
    borderColor: "#c8a040",
    justifyContent: "center",
  },
  stonePillMaxText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#7a5020",
    textAlign: "center",
    flex: 1,
  },
  emptyDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#6a4a20",
    borderWidth: 2,
    borderColor: "#4a2a08",
    flexShrink: 0,
  },
  gemDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4a7c3f",
    flexShrink: 0,
  },

  // Primary action button
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  equipBtn: {
    backgroundColor: "#4a7c3f",
    borderColor: "#2d5a24",
  },
  unequipBtn: {
    backgroundColor: "#c87820",
    borderColor: "#a05a10",
  },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: { fontSize: 13, fontWeight: "900", color: "#fff" },

  // Upgrade panel
  upgradePanel: {
    backgroundColor: "#f5edd8",
    borderRadius: 8,
    padding: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: "#d4b896",
  },
  upgradePanelText: { fontSize: 10, color: "#7a5a30", fontWeight: "600" },
  confirmBtn: {
    backgroundColor: "#7a5a9a",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1.5,
    borderColor: "#5a3a7a",
  },
  confirmBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
