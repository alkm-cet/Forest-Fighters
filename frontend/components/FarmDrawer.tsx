import { useRef, useState } from "react";
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
import { X, Package, ChevronRight } from "lucide-react-native";
import { Farm, Resources } from "../types";
import { FARM_META, RESOURCE_META } from "../constants/resources";
import CustomButton from "./CustomButton";
import CustomModal from "./CustomModal";
import { useRouter } from "expo-router";
import { useLanguage } from "../lib/i18n";

const DISMISS_THRESHOLD = 100;

const MAX_FARM_SLOTS = 20;
// Farm upgrade costs level * 5 of each: strawberry + pinecone + blueberry
const FARM_UPGRADE_COST_PER_LEVEL = 5;

function getFarmUpgradeCost(farmLevel: number) {
  return farmLevel * FARM_UPGRADE_COST_PER_LEVEL;
}

type Props = {
  farm: Farm | null;
  resources?: Resources;
  onClose: () => void;
  onCollect: (farm: Farm) => void;
  onUpgrade: (farm: Farm) => void;
};

export default function FarmDrawer({
  farm,
  resources,
  onClose,
  onCollect,
  onUpgrade,
}: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;

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

  if (!farm) return null;

  const meta = FARM_META[farm.farm_type];
  const produceMeta = RESOURCE_META[farm.produce_resource];

  // Farm header: show upgrade cost hint
  const isMaxLevel = farm.level >= MAX_FARM_SLOTS;
  const upgradeCost = getFarmUpgradeCost(farm.level);
  const strawberryCount = (resources?.strawberry ?? 0);
  const pineconeCount   = (resources?.pinecone   ?? 0);
  const blueberryCount  = (resources?.blueberry  ?? 0);
  const canAffordUpgrade = strawberryCount >= upgradeCost && pineconeCount >= upgradeCost && blueberryCount >= upgradeCost;
  const strawberryMeta = RESOURCE_META["strawberry"];
  const pineconesMeta  = RESOURCE_META["pinecone"];
  const blueberryMeta  = RESOURCE_META["blueberry"];

  // Collect
  const currentProduced = (resources?.[farm.produce_resource as keyof Resources] as number) ?? 0;
  const produceCap = (resources?.[`${farm.produce_resource}_cap` as keyof Resources] as number) ?? 10;
  const freeProduceSpace = Math.max(0, produceCap - currentProduced);
  const collectible = Math.min(farm.total_pending, freeProduceSpace);
  const produceCapFull = freeProduceSpace === 0 && farm.total_pending > 0;

  // Stats
  const totalMaxCapacity = farm.animals.reduce((sum, a) => sum + a.max_capacity, 0);
  const runningCount = farm.animals.filter((a) => a.is_running).length;

  return (
    <Modal
      visible={!!farm}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.drawer, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        {/* Top bar: handle + close */}
        <View style={styles.topBar}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <X size={14} color="#7a5230" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Header row: upgrade cost + farm level badge */}
        <View style={styles.headerRow}>
          <View style={styles.upgradeMini}>
            {!isMaxLevel ? (
              <>
                {strawberryMeta?.image && <Image source={strawberryMeta.image} style={styles.upgradeMiniIcon} resizeMode="contain" />}
                <Text style={[styles.upgradeMiniCost, strawberryCount < upgradeCost && styles.costShort]}>×{upgradeCost}</Text>
                <Text style={styles.upgradeMiniPlus}>+</Text>
                {pineconesMeta?.image && <Image source={pineconesMeta.image} style={styles.upgradeMiniIcon} resizeMode="contain" />}
                <Text style={[styles.upgradeMiniCost, pineconeCount < upgradeCost && styles.costShort]}>×{upgradeCost}</Text>
                <Text style={styles.upgradeMiniPlus}>+</Text>
                {blueberryMeta?.image && <Image source={blueberryMeta.image} style={styles.upgradeMiniIcon} resizeMode="contain" />}
                <Text style={[styles.upgradeMiniCost, blueberryCount < upgradeCost && styles.costShort]}>×{upgradeCost}</Text>
                <Text style={styles.upgradeMiniArrow}>→</Text>
                <Text style={styles.upgradeMiniLevel}>LV {farm.level + 1}</Text>
              </>
            ) : (
              <Text style={styles.upgradeMiniLevel}>{t("farmMaxLevelLabel")} {farm.level}</Text>
            )}
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeLabel}>{t("farmLevelLabel")}</Text>
            <Text style={styles.levelBadgeNum}>{farm.level}</Text>
          </View>
        </View>

        {/* Farm name */}
        <Text style={styles.farmName}>{meta.farmLabel}</Text>

        {/* Farm image */}
        <View style={styles.imageFrame}>
          {meta.image && (
            <Image source={meta.image} style={styles.farmImage} resizeMode="contain" />
          )}
        </View>

        <View style={styles.divider} />

        {/* Production stats */}
        <View style={styles.sectionLabelRow}>
          <Package size={12} color="#9a7040" strokeWidth={2} />
          <Text style={styles.sectionLabel}>{t("farmProductionSection")}</Text>
        </View>

        <View style={styles.statsBlock}>
          <View style={styles.statRow}>
            <Text style={styles.statRowLabel}>{t("farmTotalPending")}</Text>
            <View style={[styles.pendingBadge, { backgroundColor: meta.color }]}>
              {produceMeta?.image && (
                <Image source={produceMeta.image} style={styles.pendingBadgeIcon} resizeMode="contain" />
              )}
              <Text style={styles.pendingBadgeText}>
                {farm.total_pending} / {totalMaxCapacity}
              </Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statRowLabel}>{t("farmAnimalsRunning")}</Text>
            <Text style={styles.statRowValue}>
              {runningCount} / {farm.animals.length}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statRowLabel}>{t("farmSlotsLabel")}</Text>
            <Text style={styles.statRowValue}>
              {farm.animals.length} / {farm.slot_count}
            </Text>
          </View>
        </View>

        {/* Collect All button */}
        <CustomButton
          btnImage={produceMeta?.image ?? undefined}
          text={
            produceCapFull
              ? `${produceMeta?.label ?? farm.produce_resource} — ${t("farmerStorageFull")}`
              : collectible > 0
                ? `${t("farmCollectAll")} (+${collectible}${collectible < farm.total_pending ? `/${farm.total_pending}` : ""})`
                : t("nothingToCollect")
          }
          onClick={() => onCollect(farm)}
          bgColor={produceCapFull ? "#9a7040" : meta.color}
          borderColor={produceCapFull ? "#7a5030" : meta.color}
          disabled={collectible === 0}
          style={styles.actionBtn}
        />

        <View style={styles.divider} />

        {/* Bottom row: View Farm + Upgrade Farm */}
        <View style={styles.bottomBtnRow}>
          <CustomButton
            btnIcon={<ChevronRight size={20} color="#fff" strokeWidth={2.5} />}
            btnImagePos="right"
            text={t("farmViewFarm")}
            onClick={() => {
              onClose();
              setTimeout(() => {
                router.push({
                  pathname: "/(game)/farm/[type]",
                  params: { type: farm.farm_type },
                } as any);
              }, 200);
            }}
            bgColor="#7a5230"
            borderColor="#5a3810"
            style={{ flex: 1 }}
          />
          <CustomButton
            text={isMaxLevel ? t("farmMaxLv") : t("upgradeBtn")}
            subContent={
              !isMaxLevel ? (
                <View style={styles.costRow}>
                  {strawberryMeta?.image && <Image source={strawberryMeta.image} style={styles.costIcon} resizeMode="contain" />}
                  <Text style={[styles.costText, strawberryCount < upgradeCost && { color: "#ff8080" }]}>×{upgradeCost}</Text>
                  {pineconesMeta?.image && <Image source={pineconesMeta.image} style={styles.costIcon} resizeMode="contain" />}
                  <Text style={[styles.costText, pineconeCount < upgradeCost && { color: "#ff8080" }]}>×{upgradeCost}</Text>
                  {blueberryMeta?.image && <Image source={blueberryMeta.image} style={styles.costIcon} resizeMode="contain" />}
                  <Text style={[styles.costText, blueberryCount < upgradeCost && { color: "#ff8080" }]}>×{upgradeCost}</Text>
                </View>
              ) : undefined
            }
            onClick={() => !isMaxLevel && canAffordUpgrade && setShowUpgradeModal(true)}
            bgColor={isMaxLevel ? "#9a7040" : "#4a7c3f"}
            borderColor={isMaxLevel ? "#7a5030" : "#2d5a24"}
            disabled={isMaxLevel || !canAffordUpgrade}
            style={{ flex: 1 }}
          />
        </View>
      </Animated.View>

      <CustomModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onConfirm={() => {
          setShowUpgradeModal(false);
          onUpgrade(farm);
        }}
        title={t("farmUpgradeTitle")}
        confirmText={t("upgradeBtn")}
      >
        <View style={styles.modalBody}>
          <Text style={styles.modalText}>
            {t("farmUpgradeConfirmPre")} LV {farm.level} → LV {farm.level + 1} {t("farmUpgradeConfirmPost")}
          </Text>
          <View style={styles.modalCostRow}>
            {strawberryMeta?.image && <Image source={strawberryMeta.image} style={styles.modalCostIcon} resizeMode="contain" />}
            <Text style={styles.modalCostText}>×{upgradeCost}</Text>
            {pineconesMeta?.image && <Image source={pineconesMeta.image} style={styles.modalCostIcon} resizeMode="contain" />}
            <Text style={styles.modalCostText}>×{upgradeCost}</Text>
            {blueberryMeta?.image && <Image source={blueberryMeta.image} style={styles.modalCostIcon} resizeMode="contain" />}
            <Text style={styles.modalCostText}>×{upgradeCost}</Text>
          </View>
        </View>
      </CustomModal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
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
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 20,
  },
  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  handleWrap: { flex: 1, alignItems: "center", paddingLeft: 38 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#c8a96e" },
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
  upgradeMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ede0c4",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: "#c8a96e",
  },
  upgradeMiniIcon: { width: 20, height: 20 },
  upgradeMiniCost: { fontSize: 13, fontWeight: "800", color: "#3a1e00" },
  costShort: { color: "#c0392b" },
  upgradeMiniPlus: { fontSize: 11, fontWeight: "700", color: "#9a7040", marginHorizontal: 1 },
  upgradeMiniArrow: { fontSize: 11, fontWeight: "700", color: "#9a7040", marginLeft: 2 },
  upgradeMiniLevel: { fontSize: 12, fontWeight: "800", color: "#4a7c3f" },
  levelBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: "#e8c87a",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderColor: "#c8a040",
    gap: 3,
    justifyContent: "flex-end",
  },
  levelBadgeLabel: { fontSize: 10, fontWeight: "700", color: "#7a5020" },
  levelBadgeNum: { fontSize: 18, fontWeight: "900", color: "#3a1e00" },
  farmName: {
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
  farmImage: { width: 120, height: 120 },
  divider: { height: 1, backgroundColor: "#d4b896", marginVertical: 8 },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#9a7040",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statsBlock: {
    backgroundColor: "#ede0c4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#d4b896",
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statRowLabel: { fontSize: 12, fontWeight: "600", color: "#7a5030" },
  statRowValue: { fontSize: 13, fontWeight: "800", color: "#3a1e00" },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingBadgeIcon: { width: 14, height: 14 },
  pendingBadgeText: { fontSize: 12, fontWeight: "800", color: "#fff" },
  actionBtn: { marginBottom: 2 },
  viewFarmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ede0c4",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#c8a96e",
    paddingVertical: 14,
    gap: 8,
    marginBottom: 2,
  },
  viewFarmBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#3a1e00",
  },
  upgradeBtn: {},
  bottomBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  costRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  costIcon: { width: 16, height: 16 },
  costText: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.85)" },
  modalBody: { gap: 10 },
  modalText: { fontSize: 14, fontWeight: "600", color: "#5a3a10" },
  modalCostRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  modalCostIcon: { width: 22, height: 22 },
  modalCostText: { fontSize: 15, fontWeight: "800", color: "#3a1e00" },
});
