import { useState, useMemo } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { Text } from "./StyledText";
import { X, ChevronDown, ChevronUp, Swords, Shield, Zap, HeartPulse, ArrowLeft, CheckCircle } from "lucide-react-native";
import { useRouter } from "expo-router";
import { GearDefinition, PlayerGear, AdventureDungeon } from "../types";
import { GEAR_IMAGES } from "./GearDrawer";
import { ENEMY_IMAGES } from "../constants/dungeonImages";
import { useGearDefinitionsQuery, useItemDropDungeonsQuery } from "../lib/query/queries";
import { useLanguage } from "../lib/i18n";

// ── Tier colors (mirror GearDrawer) ──────────────────────────────────────────
const TIER_COLOR: Record<number, string> = { 1: "#5a8a3c", 2: "#c87820", 3: "#8a4cc8" };
const TIER_BG: Record<number, string>    = { 1: "#fdf5e4", 2: "#f3e8ff", 3: "#ffe8e8" };
const TIER_BORDER: Record<number, string>= { 1: "#c8a870", 2: "#9c78d0", 3: "#d07878" };

type FilterKey = "Warrior" | "Mage" | "Archer" | "charm" | null;

// ── DungeonDropList — lazy-loads dungeons for one definition ──────────────────
function DungeonDropList({
  definitionId,
  onSeeDungeon,
}: {
  definitionId: string;
  onSeeDungeon: (dungeonId: string) => void;
}) {
  const { t } = useLanguage();
  const { data: dungeons = [], isLoading } = useItemDropDungeonsQuery(definitionId);

  if (isLoading) {
    return (
      <View style={dropStyles.loading}>
        <ActivityIndicator size="small" color="#8a5a1c" />
      </View>
    );
  }

  if (dungeons.length === 0) {
    return (
      <View style={dropStyles.empty}>
        <Text style={dropStyles.emptyText}>{t("encyclopediaNoDungeons")}</Text>
      </View>
    );
  }

  return (
    <View style={dropStyles.list}>
      {dungeons.map((d) => (
        <DungeonRow key={d.id} dungeon={d} onSeeDungeon={onSeeDungeon} />
      ))}
    </View>
  );
}

// ── DungeonRow ────────────────────────────────────────────────────────────────
function DungeonRow({
  dungeon,
  onSeeDungeon,
}: {
  dungeon: AdventureDungeon;
  onSeeDungeon: (dungeonId: string) => void;
}) {
  const { t } = useLanguage();
  const enemyKey = dungeon.enemy_name?.toLowerCase() ?? "";
  const enemyImg = ENEMY_IMAGES[enemyKey] ?? null;
  const isBoss = dungeon.is_boss_stage;

  return (
    <View style={[dropStyles.row, isBoss && dropStyles.bossRow]}>
      <View style={dropStyles.rowLeft}>
        {enemyImg ? (
          <Image source={enemyImg} style={dropStyles.enemyImg} resizeMode="contain" />
        ) : (
          <View style={dropStyles.enemyImgPlaceholder} />
        )}
        <View style={dropStyles.rowInfo}>
          <Text style={dropStyles.stageName} numberOfLines={1}>
            {isBoss ? "👑 " : ""}{t("encyclopediaStage")} {dungeon.stage_number} – {dungeon.name}
          </Text>
          <View style={dropStyles.statsRow}>
            <View style={dropStyles.statChip}>
              <HeartPulse size={9} color="#c0392b" strokeWidth={2} />
              <Text style={[dropStyles.statVal, { color: "#c0392b" }]}>{dungeon.enemy_hp}</Text>
            </View>
            <View style={dropStyles.statChip}>
              <Swords size={9} color="#d4530c" strokeWidth={2} />
              <Text style={[dropStyles.statVal, { color: "#d4530c" }]}>{dungeon.enemy_attack}</Text>
            </View>
            <View style={dropStyles.statChip}>
              <Shield size={9} color="#1976d2" strokeWidth={2} />
              <Text style={[dropStyles.statVal, { color: "#1976d2" }]}>{dungeon.enemy_defense}</Text>
            </View>
            <View style={dropStyles.statChip}>
              <Zap size={9} color="#7b1fa2" strokeWidth={2} />
              <Text style={[dropStyles.statVal, { color: "#7b1fa2" }]}>{dungeon.enemy_chance}</Text>
            </View>
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={dropStyles.seeBtn}
        onPress={() => onSeeDungeon(dungeon.id)}
        activeOpacity={0.75}
      >
        <Text style={dropStyles.seeBtnText}>{t("encyclopediaSeeDungeon")}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── EncyclopediaItemCard ──────────────────────────────────────────────────────
function EncyclopediaItemCard({
  def,
  owned,
  expanded,
  onToggleExpand,
  onSeeDungeon,
}: {
  def: GearDefinition;
  owned: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onSeeDungeon: (dungeonId: string) => void;
}) {
  const { t } = useLanguage();
  const tierColor  = TIER_COLOR[def.tier]  ?? "#888";
  const tierBg     = TIER_BG[def.tier]     ?? "#fdf5e4";
  const tierBorder = TIER_BORDER[def.tier] ?? "#c8a870";

  const hasAtk  = def.base_attack  > 0;
  const hasDef  = def.base_defense > 0;
  const hasChc  = def.base_chance  > 0;

  return (
    <View style={[cardStyles.wrapper, { borderColor: tierBorder, backgroundColor: tierBg }]}>
      {/* Owned badge */}
      {owned && (
        <View style={cardStyles.ownedBadge}>
          <CheckCircle size={14} color="#2e7d32" strokeWidth={2.5} />
        </View>
      )}

      {/* Top row */}
      <View style={cardStyles.topRow}>
        <View style={cardStyles.iconBox}>
          {GEAR_IMAGES[def.id] ? (
            <Image source={GEAR_IMAGES[def.id]} style={cardStyles.itemImg} resizeMode="contain" />
          ) : (
            <Text style={cardStyles.itemEmoji}>{def.emoji || "❓"}</Text>
          )}
        </View>
        <View style={cardStyles.infoCol}>
          <Text style={cardStyles.itemName} numberOfLines={1}>{def.name}</Text>
          <View style={cardStyles.badgeRow}>
            {/* Tier badge */}
            <View style={[cardStyles.tierBadge, { backgroundColor: tierColor }]}>
              <Text style={cardStyles.tierText}>T{def.tier}</Text>
            </View>
            {/* Class badge */}
            <View style={[cardStyles.classBadge, { borderColor: tierColor }]}>
              <Text style={[cardStyles.classBadgeText, { color: tierColor }]}>
                {def.class_restriction ?? t("encyclopediaClassAll")}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stats */}
      {(hasAtk || hasDef || hasChc) && (
        <View style={cardStyles.statsRow}>
          {hasAtk && (
            <View style={[cardStyles.statChip, { backgroundColor: "#fff3e0" }]}>
              <Swords size={10} color="#d4530c" strokeWidth={2} />
              <Text style={[cardStyles.statVal, { color: "#d4530c" }]}>+{def.base_attack}</Text>
            </View>
          )}
          {hasDef && (
            <View style={[cardStyles.statChip, { backgroundColor: "#e3f2fd" }]}>
              <Shield size={10} color="#1976d2" strokeWidth={2} />
              <Text style={[cardStyles.statVal, { color: "#1976d2" }]}>+{def.base_defense}</Text>
            </View>
          )}
          {hasChc && (
            <View style={[cardStyles.statChip, { backgroundColor: "#f3e5f5" }]}>
              <Zap size={10} color="#7b1fa2" strokeWidth={2} />
              <Text style={[cardStyles.statVal, { color: "#7b1fa2" }]}>+{def.base_chance}</Text>
            </View>
          )}
        </View>
      )}

      {/* Get this item button */}
      <TouchableOpacity
        style={[cardStyles.getBtn, expanded && { backgroundColor: tierColor }]}
        onPress={onToggleExpand}
        activeOpacity={0.75}
      >
        {expanded
          ? <ChevronUp size={12} color="#fff" strokeWidth={2.5} />
          : <ChevronDown size={12} color={tierColor} strokeWidth={2.5} />
        }
        <Text style={[cardStyles.getBtnText, expanded && { color: "#fff" }]}>
          {t("encyclopediaGetItem")}
        </Text>
      </TouchableOpacity>

      {/* Dungeon dropdown */}
      {expanded && (
        <DungeonDropList definitionId={def.id} onSeeDungeon={onSeeDungeon} />
      )}
    </View>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
type Props = {
  visible: boolean;
  onClose: () => void;
  ownedGear: PlayerGear[];
  onNavigateToDungeon?: (dungeonId: string) => void;
};

// ── Main component ────────────────────────────────────────────────────────────
export default function ItemEncyclopedia({ visible, onClose, ownedGear, onNavigateToDungeon }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [filter, setFilter] = useState<FilterKey>(null);
  const [expandedDefId, setExpandedDefId] = useState<string | null>(null);

  const { data: allDefs = [], isLoading } = useGearDefinitionsQuery();

  const ownedIds = useMemo(
    () => new Set(ownedGear.map((g) => g.definition_id)),
    [ownedGear],
  );

  const filteredDefs = useMemo(() => {
    if (!filter) return allDefs;
    if (filter === "charm") return allDefs.filter((d) => d.gear_type === "charm");
    return allDefs.filter((d) => d.class_restriction === filter);
  }, [allDefs, filter]);

  function handleToggleExpand(defId: string) {
    setExpandedDefId((prev) => (prev === defId ? null : defId));
  }

  function handleSeeDungeon(dungeonId: string) {
    if (onNavigateToDungeon) {
      onNavigateToDungeon(dungeonId);
    } else {
      onClose();
      router.push({
        pathname: "/(game)/dungeons",
        params: { tab: "adventure", openDungeonId: dungeonId },
      });
    }
  }

  function handleFilterPress(key: FilterKey) {
    setFilter((prev) => (prev === key ? null : key));
    setExpandedDefId(null);
  }

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "Warrior", label: t("encyclopediaFilterWarrior") },
    { key: "Mage",    label: t("encyclopediaFilterMage") },
    { key: "Archer",  label: t("encyclopediaFilterArcher") },
    { key: "charm",   label: t("encyclopediaFilterCharms") },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.7}>
            <ArrowLeft size={18} color="#7a5230" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.title}>{t("encyclopediaTitle")}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Filter bar */}
        <View style={styles.filterBar}>
          {FILTERS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.filterBtn, filter === key && styles.filterBtnActive]}
              onPress={() => handleFilterPress(key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterBtnText, filter === key && styles.filterBtnTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
          {filter !== null && (
            <TouchableOpacity style={styles.clearFilterBtn} onPress={() => setFilter(null)} activeOpacity={0.7}>
              <X size={12} color="#7a5230" strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>

        {/* Item list */}
        {isLoading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color="#8a5a1c" />
          </View>
        ) : (
          <FlatList
            data={filteredDefs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <EncyclopediaItemCard
                def={item}
                owned={ownedIds.has(item.id)}
                expanded={expandedDefId === item.id}
                onToggleExpand={() => handleToggleExpand(item.id)}
                onSeeDungeon={handleSeeDungeon}
              />
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fdf5e4",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e8d5b0",
    backgroundColor: "#fdf5e4",
  },
  backBtn: {
    padding: 4,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#4a2c0a",
  },
  headerSpacer: {
    width: 26,
  },
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fdf5e4",
    borderBottomWidth: 1,
    borderBottomColor: "#e8d5b0",
  },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#c8a870",
    backgroundColor: "#fff8ee",
  },
  filterBtnActive: {
    backgroundColor: "#8a5a1c",
    borderColor: "#8a5a1c",
  },
  filterBtnText: {
    fontSize: 11,
    color: "#7a5230",
    fontWeight: "600",
  },
  filterBtnTextActive: {
    color: "#fff",
  },
  clearFilterBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c8a870",
    backgroundColor: "#fff8ee",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 12,
    gap: 10,
  },
});

const cardStyles = StyleSheet.create({
  wrapper: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    position: "relative",
  },
  ownedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#fff8ee",
    borderWidth: 1,
    borderColor: "#e8d5b0",
    alignItems: "center",
    justifyContent: "center",
  },
  itemImg: {
    width: 36,
    height: 36,
  },
  itemEmoji: {
    fontSize: 22,
  },
  infoCol: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3a2010",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tierText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  classBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  classBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    gap: 5,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statVal: {
    fontSize: 11,
    fontWeight: "700",
  },
  getBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#c8a870",
    backgroundColor: "#fff8ee",
  },
  getBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7a5230",
  },
});

const dropStyles = StyleSheet.create({
  loading: {
    paddingVertical: 12,
    alignItems: "center",
  },
  empty: {
    paddingVertical: 10,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 12,
    color: "#888",
  },
  list: {
    marginTop: 8,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff8ee",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e8d5b0",
    padding: 7,
    gap: 8,
  },
  bossRow: {
    borderColor: "#c87820",
    backgroundColor: "#fff8ee",
  },
  rowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  enemyImg: {
    width: 34,
    height: 34,
    borderRadius: 6,
  },
  enemyImgPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: "#e8d5b0",
  },
  rowInfo: {
    flex: 1,
    gap: 3,
  },
  stageName: {
    fontSize: 11,
    fontWeight: "700",
    color: "#3a2010",
  },
  statsRow: {
    flexDirection: "row",
    gap: 5,
    flexWrap: "wrap",
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  statVal: {
    fontSize: 10,
    fontWeight: "600",
  },
  seeBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#8a5a1c",
  },
  seeBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
});
