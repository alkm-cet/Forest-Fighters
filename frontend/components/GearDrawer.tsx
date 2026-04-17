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
import { X, Sparkles, Trash2 } from "lucide-react-native";
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

// Soft rarity background colors
const RARITY_BG: Record<GearRarity, string> = {
  common: "#f4efe4",
  rare: "#e8f0ff",
  epic: "#f5eaff",
};

// Level badge colors: 1=neutral, 2=blue, 3=gold
const LV_COLOR: Record<number, string> = {
  1: "#9E9E9E",
  2: "#2196F3",
  3: "#c87820",
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

// ── Tier badge ─────────────────────────────────────────────────────────────────
function TierBadge({ tier }: { tier: number }) {
  const colors = ["#5a8a3c", "#c87820", "#8a4cc8"];
  return (
    <View
      style={[styles.badge, { backgroundColor: colors[tier - 1] ?? "#888" }]}
    >
      <Text style={styles.badgeText}>T{tier}</Text>
    </View>
  );
}

// ── Rarity badge ───────────────────────────────────────────────────────────────
function RarityBadge({ rarity }: { rarity: GearRarity }) {
  const meta = RARITY_META[rarity];
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: meta.color + "22",
          borderWidth: 1,
          borderColor: meta.color,
        },
      ]}
    >
      <Text style={[styles.badgeText, { color: meta.color }]}>
        {meta.label}
      </Text>
    </View>
  );
}

// ── Level badge ────────────────────────────────────────────────────────────────
function LevelBadge({ level }: { level: number }) {
  return (
    <View
      style={[styles.lvBadge, { backgroundColor: LV_COLOR[level] ?? "#888" }]}
    >
      <Text style={styles.lvBadgeText}>Lv {level}</Text>
    </View>
  );
}

// ── Stat chips ─────────────────────────────────────────────────────────────────
function StatChips({ gear }: { gear: PlayerGear }) {
  const stats = [
    gear.attack_bonus > 0 && {
      label: `+${gear.attack_bonus} Saldırı`,
      icon: "⚔️",
      bg: "#fff0ee",
      color: "#c0392b",
    },
    gear.defense_bonus > 0 && {
      label: `+${gear.defense_bonus} Savunma`,
      icon: "🛡️",
      bg: "#eef4ff",
      color: "#1976d2",
    },
    gear.chance_bonus > 0 && {
      label: `+${gear.chance_bonus} Kritik`,
      icon: "🎯",
      bg: "#eeffee",
      color: "#27ae60",
    },
  ].filter(Boolean) as {
    label: string;
    icon: string;
    bg: string;
    color: string;
  }[];

  if (stats.length === 0) return null;
  return (
    <View style={styles.statChipsRow}>
      {stats.map((s) => (
        <View
          key={s.label}
          style={[styles.statChip, { backgroundColor: s.bg }]}
        >
          <Text style={[styles.statChipText, { color: s.color }]}>
            {s.icon} {s.label}
          </Text>
        </View>
      ))}
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
// Used for both equipped (mode="unequip") and inventory (mode="equip") cards.
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
  const meta = RARITY_META[gear.rarity];
  const stonesNeeded = gear.level === 1 ? 1 : 2;
  const validStones = forgeStones.filter((f) => {
    const tier = (f.recipe as any).gear_upgrade_tier;
    return tier === gear.definition.tier || tier === 3;
  });
  const canUpgrade = gear.level < 3 && validStones.length >= stonesNeeded;
  const isMaxLevel = gear.level >= 3;
  const primaryDisabled = isDeployed;

  return (
    <View
      style={[styles.gearCard, { backgroundColor: RARITY_BG[gear.rarity] }]}
    >
      {/* Left rarity accent bar */}
      <View
        style={[styles.gearCardAccent, { backgroundColor: meta.borderColor }]}
      />

      {/* Card body — column so buttons can span full width below the emoji+info row */}
      <View style={styles.gearCardBody}>
        {/* Top row: item image + info */}
        <View style={styles.gearCardTopRow}>
          {GEAR_IMAGES[gear.definition.id] ? (
            <Image
              source={GEAR_IMAGES[gear.definition.id]}
              style={styles.gearCardItemImg}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.gearCardEmoji}>{gear.definition.emoji}</Text>
          )}
          <View style={styles.gearCardInfo}>
            <View style={styles.gearCardNameRow}>
              <Text style={styles.gearCardName} numberOfLines={1}>
                {gear.definition.name}
              </Text>
              <LevelBadge level={gear.level} />
            </View>
            <View style={styles.gearCardBadgeRow}>
              <TierBadge tier={gear.definition.tier} />
              <RarityBadge rarity={gear.rarity} />
            </View>
            <StatChips gear={gear} />
          </View>
        </View>

        {/* Action buttons — full width of body */}
        <View style={styles.gearCardActions}>
          <TouchableOpacity
            style={[
              styles.gearActionBtn,
              mode === "equip" ? styles.equipBtn : styles.unequipBtn,
              primaryDisabled && styles.actionBtnDisabled,
            ]}
            onPress={primaryDisabled ? undefined : onPrimary}
            disabled={primaryDisabled}
            activeOpacity={0.75}
          >
            <Text style={styles.gearActionBtnText}>
              {mode === "equip" ? t("gearEquipBtn") : t("gearUnequipBtn")}
            </Text>
          </TouchableOpacity>

          {isMaxLevel ? (
            <View style={[styles.gearActionBtn, styles.maxLvBtn]}>
              <Text style={styles.maxLvBtnText}>✦ MAX</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.gearActionBtn,
                styles.upgradeBtn,
                !canUpgrade && styles.actionBtnDisabled,
              ]}
              onPress={canUpgrade ? () => setUpgradeOpen((v) => !v) : undefined}
              activeOpacity={canUpgrade ? 0.75 : 1}
            >
              <Sparkles
                size={10}
                color={canUpgrade ? "#fff" : "rgba(255,255,255,0.4)"}
                strokeWidth={2}
              />
              <Text
                style={[
                  styles.gearActionBtnText,
                  !canUpgrade && { opacity: 0.5 },
                ]}
              >
                {canUpgrade
                  ? `${t("gearUpgradeBtn")} (${stonesNeeded})`
                  : t("gearNoStonesBtn")}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Upgrade confirm panel */}
        {upgradeOpen && canUpgrade && (
          <View style={styles.upgradePanel}>
            <Text style={styles.upgradePanelText}>
              {stonesNeeded} {t("gearUpgradeStonesWillUse")}:{" "}
              {validStones
                .slice(0, stonesNeeded)
                .map((s) => s.recipe.name)
                .join(" + ")}
            </Text>
            <TouchableOpacity
              style={styles.confirmUpgradeBtn}
              onPress={() => {
                onUpgrade?.(
                  validStones.slice(0, stonesNeeded).map((s) => s.id),
                );
                setUpgradeOpen(false);
              }}
            >
              <Sparkles size={12} color="#fff" strokeWidth={2} />
              <Text style={styles.confirmUpgradeBtnText}>
                {t("gearConfirmUpgrade")}
              </Text>
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
        e?.response?.data?.error ?? "Could not discard gear",
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
                  Silahlar ({inventoryWeapons.length})
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
                  Tılsımlar ({inventoryCharms.length})
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
              Bu eşyayı atmak istediğinden emin misin?
            </Text>
            <View style={styles.discardModalBtnRow}>
              <TouchableOpacity
                style={styles.discardCancelBtn}
                onPress={() => setDiscardTarget(null)}
                activeOpacity={0.75}
              >
                <Text style={styles.discardCancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.discardConfirmBtn}
                onPress={() => startDismiss(discardTarget)}
                activeOpacity={0.75}
              >
                <Trash2 size={13} color="#fff" strokeWidth={2.5} />
                <Text style={styles.discardConfirmText}>At</Text>
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

  // ── Unified gear card ────────────────────────────────────────────────────────
  gearCard: {
    borderRadius: 12,
    flexDirection: "row",
    overflow: "hidden",
    // Subtle shadow instead of heavy border
    shadowColor: "#000",
    shadowOpacity: 0.09,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.07)",
  },
  gearCardAccent: {
    width: 5,
    flexShrink: 0,
  },
  gearCardBody: {
    flex: 1,
    flexDirection: "column",
    padding: 10,
    gap: 8,
  },
  gearCardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  gearCardEmoji: { fontSize: 32, lineHeight: 36, flexShrink: 0, marginTop: 2 },
  gearCardItemImg: { width: 52, height: 52, flexShrink: 0 },
  gearCardInfo: { flex: 1, gap: 6 },
  gearCardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gearCardName: { fontSize: 13, fontWeight: "900", color: "#3a1e00", flex: 1 },
  gearCardBadgeRow: { flexDirection: "row", gap: 4, alignItems: "center" },
  gearCardActions: { flexDirection: "row", gap: 6 },

  // Level badge
  lvBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  lvBadgeText: { fontSize: 10, fontWeight: "900", color: "#fff" },

  // Generic badges
  badge: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },

  // Stat chips
  statChipsRow: { flexDirection: "row", gap: 5, flexWrap: "wrap" },
  statChip: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  statChipText: { fontSize: 11, fontWeight: "800" },

  // Action buttons
  gearActionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  equipBtn: {
    backgroundColor: "#4a7c3f",
    borderWidth: 1.5,
    borderColor: "#2d5a24",
  },
  unequipBtn: {
    backgroundColor: "#c87820",
    borderWidth: 1.5,
    borderColor: "#a05a10",
  },
  upgradeBtn: {
    backgroundColor: "#7a5a9a",
    borderWidth: 1.5,
    borderColor: "#5a3a7a",
  },
  maxLvBtn: {
    backgroundColor: "#e8c87a",
    borderWidth: 1.5,
    borderColor: "#c8a040",
  },
  maxLvBtnText: { fontSize: 11, fontWeight: "900", color: "#7a5020" },
  actionBtnDisabled: { opacity: 0.4 },
  gearActionBtnText: { color: "#fff", fontSize: 11, fontWeight: "800" },

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
  confirmUpgradeBtn: {
    backgroundColor: "#7a5a9a",
    borderRadius: 7,
    paddingVertical: 7,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1.5,
    borderColor: "#5a3a7a",
  },
  confirmUpgradeBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },

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
