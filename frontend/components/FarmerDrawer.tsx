import { useRef, useEffect, useState, useCallback } from "react";
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
import { X, Sprout, Package, ArrowUp, Timer } from "lucide-react-native";
import { Farmer, Resources } from "../types";
import { RESOURCE_META } from "../constants/resources";
import { useLanguage, TranslationKeys } from "../lib/i18n";
import CustomButton from "./CustomButton";
import { useCoinConfirm } from "../lib/coin-confirm-context";
import InGameCoinConfirmModal from "./InGameCoinConfirmModal";

// Cross-resource upgrade costs
const UPGRADE_RESOURCES: Record<string, [string, string]> = {
  strawberry: ["strawberry", "pinecone"],
  pinecone: ["pinecone", "blueberry"],
  blueberry: ["blueberry", "strawberry"],
};

function getUpgradeCost(level: number) {
  return level * 2;
}

function getMaxCapacity(level: number) {
  return 4 + level;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

type Props = {
  farmer: Farmer | null;
  resources?: Resources;
  coins?: number;
  onClose: () => void;
  onCollect: (farmer: Farmer) => void;
  onUpgrade: (farmer: Farmer) => void;
  onFillStorage?: (farmer: Farmer) => void;
};

const DISMISS_THRESHOLD = 100;

export default function FarmerDrawer({
  farmer,
  resources,
  coins = 0,
  onClose,
  onCollect,
  onUpgrade,
  onFillStorage,
}: Props) {
  const { t } = useLanguage();
  const { triggerCoinConfirm } = useCoinConfirm();
  const translateY = useRef(new Animated.Value(0)).current;

  // Live pending + countdown managed locally
  const [livePending, setLivePending] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerRowWidth, setTimerRowWidth] = useState(0);
  const livePendingRef = useRef(0);

  // Interpolate farmer snapshot forward to "now" using _fetched_at_ms.
  function interpolate(f: Farmer) {
    if (!f) return { timeLeft: 0, pending: 0 };
    const elapsedSec = f._fetched_at_ms
      ? (Date.now() - f._fetched_at_ms) / 1000
      : 0;
    const cycleSec = (f.interval_minutes ?? 0) * 60;
    const maxCap = getMaxCapacity(f.level);
    const rawTimeLeft = Math.max(0, (f.next_ready_in_seconds ?? 0) - elapsedSec);
    const burned = f.next_ready_in_seconds - rawTimeLeft; // seconds consumed since fetch
    const extraCycles =
      cycleSec > 0
        ? Math.max(0, Math.floor((cycleSec - f.next_ready_in_seconds + burned) / cycleSec))
        : 0;
    const pending = Math.min((f.pending ?? 0) + extraCycles, maxCap);
    const timeLeft =
      rawTimeLeft <= 0 ? cycleSec - (-rawTimeLeft % cycleSec) : rawTimeLeft;
    return { timeLeft: Math.round(timeLeft), pending };
  }

  // Slide animation reset — only when the drawer opens (new farmer)
  useEffect(() => {
    if (farmer) translateY.setValue(0);
  }, [farmer?.id]);

  // Re-interpolate whenever farmer data changes (open or after fill/collect)
  useEffect(() => {
    if (farmer) {
      const { timeLeft, pending } = interpolate(farmer);
      livePendingRef.current = pending;
      setLivePending(pending);
      setTimeLeft(timeLeft);
    }
  }, [farmer?.id, farmer?.last_collected_at]);

  // Keep ref in sync so interval can read latest value without recreating
  useEffect(() => {
    livePendingRef.current = livePending;
  }, [livePending]);

  // Tick every second; pause when farmer storage is full
  useEffect(() => {
    if (!farmer) return;
    const maxCap = getMaxCapacity(farmer.level);
    const interval = setInterval(() => {
      // Storage full — freeze the timer, don't produce
      if (livePendingRef.current >= maxCap) return;

      setTimeLeft((prev) => {
        if (prev <= 1) {
          setLivePending((p) => Math.min(p + 1, maxCap));
          return farmer.interval_minutes * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [farmer?.id]);

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

  if (!farmer) return null;

  const meta = RESOURCE_META[farmer.resource_type] ?? {
    catImage: null,
    image: null,
    color: "#4a8c3f",
    label: farmer.resource_type,
  };

  const [res1, res2] = UPGRADE_RESOURCES[farmer.resource_type] ?? ["?", "?"];
  const upgradeCost = getUpgradeCost(farmer.level);
  const res1Meta = RESOURCE_META[res1];
  const res2Meta = RESOURCE_META[res2];
  const isMaxLevel = farmer.level >= 50;
  const canUpgrade =
    !isMaxLevel &&
    (resources?.[res1 as keyof Resources] ?? 0) >= upgradeCost &&
    (resources?.[res2 as keyof Resources] ?? 0) >= upgradeCost;

  const currentStored =
    (resources?.[farmer.resource_type as keyof Resources] as number) ?? 0;
  const storageCap =
    (resources?.[
      (farmer.resource_type + "_cap") as keyof Resources
    ] as number) ?? 15;
  const freeSpace = Math.max(0, storageCap - currentStored);
  const collectible = Math.min(livePending, freeSpace);
  const capacityFull = freeSpace === 0 && livePending > 0;

  return (
    <Modal
      visible={!!farmer}
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
        {/* Top bar */}
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

        {/* Upgrade cost (left) + level badge (right) */}
        <View style={styles.headerRow}>
          <View style={styles.upgradeMini}>
            {res1Meta?.image && (
              <Image
                source={res1Meta.image}
                style={styles.upgradeMiniIcon}
                resizeMode="contain"
              />
            )}
            <Text
              style={[
                styles.upgradeMiniCost,
                (resources?.[res1 as keyof Resources] ?? 0) < upgradeCost &&
                  styles.costShort,
              ]}
            >
              ×{upgradeCost}
            </Text>
            <Text style={styles.upgradeMiniPlus}>+</Text>
            {res2Meta?.image && (
              <Image
                source={res2Meta.image}
                style={styles.upgradeMiniIcon}
                resizeMode="contain"
              />
            )}
            <Text
              style={[
                styles.upgradeMiniCost,
                (resources?.[res2 as keyof Resources] ?? 0) < upgradeCost &&
                  styles.costShort,
              ]}
            >
              ×{upgradeCost}
            </Text>
            <Text style={styles.upgradeMiniArrow}>→</Text>
            <Text style={styles.upgradeMiniLevel}>LV {farmer.level + 1}</Text>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeLabel}>LV</Text>
            <Text style={styles.levelBadgeNum}>{farmer.level}</Text>
          </View>
        </View>

        {/* Farmer name */}
        <Text style={styles.farmerName}>{farmer.name}</Text>

        {/* Cat image */}
        <View style={styles.imageFrame}>
          {meta.catImage && (
            <Image
              source={meta.catImage}
              style={styles.catImage}
              resizeMode="contain"
            />
          )}
        </View>

        <View style={styles.divider} />

        {/* Production stats */}
        <View style={styles.sectionLabelRow}>
          <Sprout size={12} color="#9a7040" strokeWidth={2} />
          <Text style={styles.sectionLabel}>{t("productionStats")}</Text>
        </View>

        <View style={styles.productionRow}>
          <View style={styles.productionBlock}>
            <Text style={styles.productionValue}>1</Text>
            <Text style={styles.productionSep}>/</Text>
            <Text style={styles.productionInterval}>
              {Number(farmer.interval_minutes).toFixed(1)}{" "}
              {t("perMin").replace("/ ", "")}
            </Text>
          </View>
          {livePending > 0 && (
            <View
              style={[styles.pendingBadge, { backgroundColor: meta.color }]}
            >
              <Package size={12} color="#fff" strokeWidth={2} />
              <Text style={styles.pendingText}>
                {livePending} / {getMaxCapacity(farmer.level)}{" "}
                {t("pendingReady")}
              </Text>
            </View>
          )}
        </View>

        {/* Next production countdown */}
        {(() => {
          const maxCap = getMaxCapacity(farmer.level);
          const isFarmerFull = livePending >= maxCap;
          const totalSeconds = farmer.interval_minutes * 60;
          const progress = isFarmerFull
            ? 0
            : totalSeconds > 0
              ? Math.max(0, Math.min(1, 1 - (timeLeft - 1) / totalSeconds))
              : 1;
          return (
            <View
              style={styles.nextReadyRow}
              onLayout={(e) => setTimerRowWidth(e.nativeEvent.layout.width)}
            >
              {/* Progress fill behind the content */}
              {!isFarmerFull && (
                <View
                  style={[
                    styles.nextReadyFill,
                    {
                      width: timerRowWidth * progress,
                      backgroundColor: meta.color,
                      opacity: isFarmerFull ? 0.5 : 1,
                    },
                  ]}
                />
              )}
              <Timer
                size={12}
                color={isFarmerFull ? "#c0392b" : "black"}
                strokeWidth={2}
              />
              <Text style={styles.nextReadyLabel}>
                {isFarmerFull ? t("farmerStorageFull") : t("nextIn")}
              </Text>
              {!isFarmerFull && (
                <Text style={styles.nextReadyTimer}>
                  {formatTime(timeLeft)}
                </Text>
              )}
            </View>
          );
        })()}

        {/* Collect button */}
        <CustomButton
          btnImage={meta.image ?? undefined}
          text={
            capacityFull
              ? `${t("collect")} — ${t("farmerStorageFull")}`
              : collectible > 0
                ? `${t("collect")} (+${collectible}${collectible < livePending ? `/${livePending}` : ""})`
                : t("nothingToCollect")
          }
          onClick={() => onCollect(farmer)}
          bgColor={capacityFull ? "#9a7040" : meta.color}
          borderColor={capacityFull ? "#7a5030" : meta.color}
          disabled={collectible === 0}
          style={styles.actionBtn}
        />

        <View style={styles.divider} />

        {/* Upgrade + Fill Storage buttons row */}
        <View style={styles.bottomBtnRow}>
          <CustomButton
            btnIcon={<ArrowUp size={20} color="#fff" strokeWidth={2.5} />}
            text={
              isMaxLevel
                ? `MAX LV ${farmer.level}`
                : `${t("upgrade")} → LV ${farmer.level + 1}`
            }
            onClick={() => onUpgrade(farmer)}
            bgColor={isMaxLevel ? "#9a7040" : "#4a7c3f"}
            borderColor={isMaxLevel ? "#7a5030" : "#2d5a24"}
            disabled={!canUpgrade}
            style={styles.bottomBtnFlex}
          />
          {(() => {
            const maxCap = getMaxCapacity(farmer.level);
            const fillCost = maxCap - livePending;
            const isFull = fillCost <= 0;
            const canFill = !isFull && coins >= fillCost;
            return (
              <CustomButton
                text={isFull ? t("storageFull") : `${t("fillStorage")} 🪙×${fillCost}`}
                onClick={() => !isFull && onFillStorage && triggerCoinConfirm({
                  transactionCost: fillCost,
                  transactionTitle: t("fillStorage"),
                  transactionDesc: t("fillStorageDesc"),
                  onConfirm: () => onFillStorage(farmer),
                })}
                bgColor={isFull ? "#9a7040" : "#b8860b"}
                borderColor={isFull ? "#7a5030" : "#8b6508"}
                disabled={isFull || !canFill}
                style={styles.bottomBtnFlex}
              />
            );
          })()}
        </View>
        <InGameCoinConfirmModal coins={coins} />
      </Animated.View>
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
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
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
  upgradeMiniPlus: { fontSize: 13, fontWeight: "700", color: "#9a7040" },
  upgradeMiniArrow: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9a7040",
    marginLeft: 2,
  },
  upgradeMiniLevel: { fontSize: 12, fontWeight: "800", color: "#4a7c3f" },
  costShort: { color: "#c0392b" },
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
  farmerName: {
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
  catImage: { width: 128, height: 128 },
  divider: {
    height: 1.5,
    backgroundColor: "#d4b896",
    marginBottom: 12,
    marginTop: 4,
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
  productionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  productionBlock: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  productionValue: { fontSize: 28, fontWeight: "800", color: "#3a1e00" },
  productionSep: { fontSize: 20, color: "#9a7040" },
  productionInterval: { fontSize: 16, fontWeight: "700", color: "#7a5a30" },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pendingText: { fontSize: 13, fontWeight: "800", color: "#fff" },
  nextReadyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ede0c4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 12,
    overflow: "hidden",
  },
  nextReadyFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 10,
  },
  nextReadyLabel: { fontSize: 12, fontWeight: "700", color: "black" },
  nextReadyTimer: {
    fontSize: 14,
    fontWeight: "800",
    color: "#4a2e0a",
    letterSpacing: 1,
  },
  actionBtn: {
    marginBottom: 4,
  },
  btnDisabled: { opacity: 0.4 },
  bottomBtnRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  bottomBtnFlex: {
    flex: 1,
  },
});
