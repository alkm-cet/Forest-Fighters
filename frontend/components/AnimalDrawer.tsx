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
import { X, Sprout, Package, ArrowUp, Timer } from "lucide-react-native";
import { Animal, Resources } from "../types";
import { ANIMAL_META, RESOURCE_META } from "../constants/resources";
import { useLanguage } from "../lib/i18n";
import CustomButton from "./CustomButton";
import CustomModal from "./CustomModal";

const DISMISS_THRESHOLD = 100;

const UPGRADE_RESOURCES: Record<string, [string, string]> = {
  chicken: ["strawberry", "pinecone"],
  sheep:   ["pinecone",   "blueberry"],
  cow:     ["blueberry",  "strawberry"],
};
function getUpgradeCost(level: number) { return level * 2; }
function getMaxCapacity(level: number) { return 4 + level; }

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

function formatMinutes(minutes: number): string {
  const m = Math.floor(Math.max(0, minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

type Props = {
  animal: Animal | null;
  resources?: Resources;
  onClose: () => void;
  onFeed: (animal: Animal) => void;
  onFeedMax: (animal: Animal) => void;
  onCollect: (animal: Animal) => void;
  onUpgrade: (animal: Animal) => void;
};

export default function AnimalDrawer({
  animal,
  resources,
  onClose,
  onFeed,
  onFeedMax,
  onCollect,
  onUpgrade,
}: Props) {
  const { t } = useLanguage();
  const translateY = useRef(new Animated.Value(0)).current;
  const [showMaxConfirm, setShowMaxConfirm] = useState(false);
  const [timerRowWidth, setTimerRowWidth]   = useState(0);

  // Live state: progress into current cycle (seconds) and fuel remaining (seconds)
  const [livePending,     setLivePending]     = useState(0);
  const [liveProgressSec, setLiveProgressSec] = useState(0);
  const [liveFuelSec,     setLiveFuelSec]     = useState(0);
  const livePendingRef    = useRef(0);
  const liveFuelSecRef    = useRef(0);

  useEffect(() => {
    if (animal) {
      translateY.setValue(0);
      livePendingRef.current  = animal.pending;
      liveFuelSecRef.current  = animal.fuel_remaining_minutes * 60;
      setLivePending(animal.pending);
      setLiveProgressSec(animal.progress_minutes * 60);
      setLiveFuelSec(animal.fuel_remaining_minutes * 60);
    }
  }, [animal?.id]);

  useEffect(() => { livePendingRef.current = livePending; }, [livePending]);
  useEffect(() => { liveFuelSecRef.current = liveFuelSec; }, [liveFuelSec]);

  useEffect(() => {
    if (!animal) return;
    const cycleSec = animal.interval_minutes * 60;
    const maxCap   = getMaxCapacity(animal.level);
    const interval = setInterval(() => {
      // Stop ticking if no fuel or storage full
      if (liveFuelSecRef.current <= 0 || livePendingRef.current >= maxCap) return;

      setLiveFuelSec((f) => Math.max(0, f - 1));
      setLiveProgressSec((p) => {
        const next = p + 1;
        if (next >= cycleSec) {
          setLivePending((pnd) => Math.min(pnd + 1, maxCap));
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [animal?.id]);

  // Long-press feed
  const feedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    return () => { if (feedIntervalRef.current) clearInterval(feedIntervalRef.current); };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > DISMISS_THRESHOLD || gs.vy > 0.6) {
          Animated.timing(translateY, { toValue: 800, duration: 180, useNativeDriver: true })
            .start(() => onClose());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }).start();
        }
      },
    }),
  ).current;

  if (!animal) return null;

  const meta        = ANIMAL_META[animal.animal_type];
  const consumeMeta = RESOURCE_META[animal.consume_resource];
  const produceMeta = RESOURCE_META[animal.produce_resource];

  // Upgrade
  const [res1, res2] = UPGRADE_RESOURCES[animal.animal_type] ?? ["?", "?"];
  const upgradeCost   = getUpgradeCost(animal.level);
  const res1Meta      = RESOURCE_META[res1];
  const res2Meta      = RESOURCE_META[res2];
  const isMaxLevel    = animal.level >= 50;
  const canUpgrade    = !isMaxLevel &&
    (resources?.[res1 as keyof Resources] as number ?? 0) >= upgradeCost &&
    (resources?.[res2 as keyof Resources] as number ?? 0) >= upgradeCost;

  // Collect
  const currentProduced  = (resources?.[animal.produce_resource as keyof Resources] as number) ?? 0;
  const produceCap       = (resources?.[`${animal.produce_resource}_cap` as keyof Resources] as number) ?? 10;
  const freeProduceSpace = Math.max(0, produceCap - currentProduced);
  const collectible      = Math.min(livePending, freeProduceSpace);
  const produceCapFull   = freeProduceSpace === 0 && livePending > 0;

  // Feed (in integer units)
  const availableFeed    = (resources?.[animal.consume_resource as keyof Resources] as number) ?? 0;
  const feedNeededForMax = animal.max_feed - animal.current_feed;
  const canFeedOne       = availableFeed >= 1 && animal.current_feed < animal.max_feed;
  const canFeedMax       = feedNeededForMax > 0 && availableFeed >= feedNeededForMax;
  const feedPct          = animal.max_feed > 0 ? Math.min(animal.current_feed / animal.max_feed, 1) : 0;

  // Timer / progress bar
  const maxCap      = getMaxCapacity(animal.level);
  const isFull      = livePending >= maxCap;
  const isStopped   = liveFuelSec <= 0;           // ran out of fuel
  const cycleSec    = animal.interval_minutes * 60;
  const progress    = (isFull || isStopped || cycleSec <= 0)
    ? (isStopped ? liveProgressSec / cycleSec : 0)   // freeze bar where it stopped
    : Math.min(liveProgressSec / cycleSec, 1);
  const countdown   = Math.max(0, cycleSec - liveProgressSec);
  const fuelMinLeft = liveFuelSec / 60;

  return (
    <Modal visible={!!animal} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.drawer, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        {/* ─── Top bar: level badge │ handle │ close ─── */}
        <View style={styles.topBar}>
          {/* Upgrade cost preview (left) */}
          {!isMaxLevel && (
            <View style={styles.upgradeMini}>
              {res1Meta?.image && <Image source={res1Meta.image} style={styles.upgradeMiniIcon} resizeMode="contain" />}
              <Text style={[styles.upgradeMiniCost, (resources?.[res1 as keyof Resources] as number ?? 0) < upgradeCost && styles.costShort]}>
                ×{upgradeCost}
              </Text>
              <Text style={styles.upgradeMiniPlus}>+</Text>
              {res2Meta?.image && <Image source={res2Meta.image} style={styles.upgradeMiniIcon} resizeMode="contain" />}
              <Text style={[styles.upgradeMiniCost, (resources?.[res2 as keyof Resources] as number ?? 0) < upgradeCost && styles.costShort]}>
                ×{upgradeCost}
              </Text>
              <Text style={styles.upgradeMiniArrow}>→</Text>
              <Text style={styles.upgradeMiniLevel}>LV {animal.level + 1}</Text>
            </View>
          )}
          {isMaxLevel && <View style={styles.upgradeMini}><Text style={styles.upgradeMiniLevel}>MAX</Text></View>}

          {/* Handle (center) */}
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {/* Level badge (right) */}
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeLabel}>LV</Text>
            <Text style={styles.levelBadgeNum}>{animal.level}</Text>
          </View>
        </View>

        {/* Close button — below topBar so it never overlaps */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <X size={14} color="#7a5230" strokeWidth={2.5} />
        </TouchableOpacity>

        {/* Animal name */}
        <Text style={styles.animalName}>{meta.label}</Text>

        {/* Animal image */}
        <View style={styles.imageFrame}>
          {meta.image && <Image source={meta.image} style={styles.animalImage} resizeMode="contain" />}
        </View>

        <View style={styles.divider} />

        {/* ─── Production Stats (mirrors FarmerDrawer) ─── */}
        <View style={styles.sectionLabelRow}>
          <Sprout size={12} color="#9a7040" strokeWidth={2} />
          <Text style={styles.sectionLabel}>{t("productionStats")}</Text>
        </View>

        <View style={styles.productionRow}>
          <View style={styles.productionBlock}>
            <Text style={styles.productionValue}>1</Text>
            <Text style={styles.productionSep}>/</Text>
            <Text style={styles.productionInterval}>
              {Number(animal.interval_minutes).toFixed(1)} {t("perMin").replace("/ ", "")}
            </Text>
          </View>
          {livePending > 0 && (
            <View style={[styles.pendingBadge, { backgroundColor: meta.color }]}>
              <Package size={12} color="#fff" strokeWidth={2} />
              <Text style={styles.pendingText}>
                {livePending} / {maxCap} {t("pendingReady")}
              </Text>
            </View>
          )}
        </View>

        {/* Next production countdown with progress bar */}
        <View
          style={styles.nextReadyRow}
          onLayout={(e) => setTimerRowWidth(e.nativeEvent.layout.width)}
        >
          {!isFull && (
            <View style={[
              styles.nextReadyFill,
              { width: timerRowWidth * progress, backgroundColor: isStopped ? "#b0a080" : meta.color },
            ]} />
          )}
          <Timer size={12} color={isFull ? "#c0392b" : isStopped ? "#b0805a" : "#9a7040"} strokeWidth={2} />
          <Text style={styles.nextReadyLabel}>
            {isFull ? t("farmerStorageFull") : isStopped ? "Paused — add feed" : t("nextIn")}
          </Text>
          {!isFull && !isStopped && (
            <Text style={styles.nextReadyTimer}>{formatTime(countdown)}</Text>
          )}
        </View>

        {/* Collect button */}
        <CustomButton
          btnImage={produceMeta?.image ?? undefined}
          text={
            produceCapFull
              ? `${produceMeta?.label ?? animal.produce_resource} — ${t("farmerStorageFull")}`
              : collectible > 0
              ? `${t("collect")} (+${collectible}${collectible < livePending ? `/${livePending}` : ""})`
              : t("nothingToCollect")
          }
          onClick={() => onCollect(animal)}
          bgColor={produceCapFull ? "#9a7040" : meta.color}
          borderColor={produceCapFull ? "#7a5030" : meta.color}
          disabled={collectible === 0}
          style={styles.actionBtn}
        />

        <View style={styles.divider} />

        {/* ─── Feed Storage section ─── */}
        <View style={styles.sectionLabelRow}>
          <Package size={12} color="#9a7040" strokeWidth={2} />
          <Text style={styles.sectionLabel}>FEED STORAGE</Text>
          <Text style={styles.availableFeedText}>
            {availableFeed} {consumeMeta?.label ?? animal.consume_resource} available
          </Text>
        </View>

        {/* Feed bar */}
        <View style={styles.feedBarRow}>
          {consumeMeta?.image && <Image source={consumeMeta.image} style={styles.feedBarIcon} resizeMode="contain" />}
          <View style={styles.feedBarTrack}>
            <View style={[styles.feedBarFill, { width: `${feedPct * 100}%` as any, backgroundColor: consumeMeta?.color ?? meta.color }]} />
          </View>
          <Text style={styles.feedBarText}>
            {animal.current_feed} / {animal.max_feed}
          </Text>
        </View>

        {/* Remaining fuel time */}
        <View style={styles.feedTimeRow}>
          <Timer size={11} color={isStopped ? "#b0805a" : "#9a7040"} strokeWidth={2} />
          <Text style={styles.feedTimeLabel}>Fuel Remaining</Text>
          <Text style={[styles.feedTimeValue, isStopped && { color: "#b0805a" }]}>
            {liveFuelSec > 0 ? formatMinutes(fuelMinLeft) : "Empty — add feed"}
          </Text>
        </View>

        {/* Feed buttons */}
        <View style={styles.feedBtnsRow}>
          <TouchableOpacity
            style={[styles.feedBtn, !canFeedOne && styles.feedBtnDisabled]}
            activeOpacity={0.7}
            onPress={() => onFeed(animal)}
            onLongPress={() => {
              onFeed(animal);
              feedIntervalRef.current = setInterval(() => onFeed(animal), 200);
            }}
            onPressOut={() => {
              if (feedIntervalRef.current) { clearInterval(feedIntervalRef.current); feedIntervalRef.current = null; }
            }}
            delayLongPress={300}
          >
            <Text style={[styles.feedBtnText, !canFeedOne && styles.feedBtnTextDisabled]}>+1</Text>
            {consumeMeta?.image && <Image source={consumeMeta.image} style={styles.feedBtnIcon} resizeMode="contain" />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.feedMaxBtn, !feedNeededForMax && styles.feedBtnDisabled]}
            activeOpacity={0.7}
            onPress={() => setShowMaxConfirm(true)}
          >
            <Text style={[styles.feedMaxBtnText, !feedNeededForMax && styles.feedBtnTextDisabled]}>
              MAX {feedNeededForMax > 0 ? `(${feedNeededForMax})` : ""}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* ─── Upgrade button (mirrors FarmerDrawer) ─── */}
        <CustomButton
          btnIcon={<ArrowUp size={20} color="#fff" strokeWidth={2.5} />}
          text={isMaxLevel ? `MAX LV ${animal.level}` : `${t("upgrade")} → LV ${animal.level + 1}`}
          onClick={() => onUpgrade(animal)}
          bgColor={isMaxLevel ? "#9a7040" : "#4a7c3f"}
          borderColor={isMaxLevel ? "#7a5030" : "#2d5a24"}
          disabled={!canUpgrade}
          style={styles.actionBtn}
        />
      </Animated.View>

      {/* MAX feed confirmation modal */}
      <CustomModal
        visible={showMaxConfirm}
        onClose={() => setShowMaxConfirm(false)}
        onConfirm={() => { setShowMaxConfirm(false); onFeedMax(animal); }}
        title={`Feed ${meta.label}?`}
        confirmText="Confirm"
        confirmDisabled={!canFeedMax}
      >
        <Text style={styles.modalBody}>
          This will use{" "}
          <Text style={styles.modalCost}>{feedNeededForMax} {consumeMeta?.label ?? animal.consume_resource}</Text>
          {"\n"}to fill the feed storage.
        </Text>
        {!canFeedMax && (
          <Text style={styles.modalWarning}>
            Not enough {consumeMeta?.label ?? animal.consume_resource}{" "}
            (have {availableFeed}, need {feedNeededForMax})
          </Text>
        )}
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

  // ── Top bar (same layout as FarmerDrawer) ──
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  upgradeMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flex: 1,
  },
  upgradeMiniIcon: { width: 18, height: 18 },
  upgradeMiniCost: {
    fontSize: 12,
    fontWeight: "800",
    color: "#3a2a10",
  },
  costShort: { color: "#c0392b" },
  upgradeMiniPlus:  { fontSize: 11, color: "#9a7040", fontWeight: "700" },
  upgradeMiniArrow: { fontSize: 11, color: "#9a7040", fontWeight: "700" },
  upgradeMiniLevel: { fontSize: 12, fontWeight: "800", color: "#4a7c3f" },
  handleWrap: { flex: 1, alignItems: "center" },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#c8a96e",
    marginTop: 4,
  },
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
    flex: 1,
    justifyContent: "flex-end",
  },
  levelBadgeLabel: { fontSize: 10, fontWeight: "700", color: "#7a5020" },
  levelBadgeNum:   { fontSize: 18, fontWeight: "900", color: "#3a1e00" },

  // Close button — below topBar, right-aligned
  closeBtn: {
    alignSelf: "flex-end",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e8d5a8",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    marginTop: -2,
  },

  animalName: {
    fontSize: 22,
    fontWeight: "900",
    color: "#3a1e00",
    textAlign: "center",
    marginBottom: 4,
  },
  imageFrame: {
    alignItems: "center",
    justifyContent: "center",
    height: 90,
    marginBottom: 4,
  },
  animalImage: { width: 80, height: 80 },

  divider: { height: 1, backgroundColor: "#d4b896", marginVertical: 8 },

  // ── Production stats (mirrors FarmerDrawer) ──
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#9a7040",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  productionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  productionBlock: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  productionValue: { fontSize: 20, fontWeight: "900", color: "#3a1e00" },
  productionSep:   { fontSize: 14, color: "#9a7040" },
  productionInterval: { fontSize: 12, fontWeight: "600", color: "#7a5030" },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pendingText: { fontSize: 12, fontWeight: "800", color: "#fff" },

  // ── Timer progress row (birebir FarmerDrawer) ──
  nextReadyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ede0c4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
    overflow: "hidden",
    position: "relative",
    marginBottom: 8,
  },
  nextReadyFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 10,
    opacity: 0.35,
  },
  nextReadyLabel: { flex: 1, fontSize: 12, fontWeight: "700", color: "#7a5030" },
  nextReadyTimer: { fontSize: 13, fontWeight: "800", color: "#3a1e00" },

  actionBtn: { marginBottom: 2 },

  // ── Feed storage ──
  availableFeedText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7a5030",
    flex: 1,
    textAlign: "right",
  },
  feedBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  feedBarIcon: { width: 18, height: 18 },
  feedBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: "#d4b896",
    borderRadius: 5,
    overflow: "hidden",
  },
  feedBarFill: { height: "100%", borderRadius: 5 },
  feedBarText: { fontSize: 12, fontWeight: "700", color: "#3a1e00", minWidth: 50, textAlign: "right" },
  feedTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ede0c4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  feedTimeLabel: { flex: 1, fontSize: 12, fontWeight: "700", color: "#7a5030" },
  feedTimeValue: { fontSize: 13, fontWeight: "800", color: "#3a1e00" },

  // ── Feed buttons ──
  feedBtnsRow: { flexDirection: "row", gap: 12, marginBottom: 2 },
  feedBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4a7c3f",
    borderWidth: 2,
    borderColor: "#2d5a24",
    borderRadius: 12,
    paddingVertical: 11,
    gap: 6,
  },
  feedMaxBtn: {
    flex: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#c8781a",
    borderWidth: 2,
    borderColor: "#9a5010",
    borderRadius: 12,
    paddingVertical: 11,
  },
  feedBtnDisabled:     { opacity: 0.4 },
  feedBtnText:         { fontSize: 16, fontWeight: "900", color: "#fff" },
  feedMaxBtnText:      { fontSize: 14, fontWeight: "900", color: "#fff" },
  feedBtnTextDisabled: { color: "#fff" },
  feedBtnIcon:         { width: 18, height: 18 },

  // ── Max feed modal ──
  modalBody:    { fontSize: 14, fontWeight: "600", color: "#5a3a10", lineHeight: 22 },
  modalCost:    { fontWeight: "900", color: "#3a1e00" },
  modalWarning: { fontSize: 12, fontWeight: "700", color: "#c0392b", marginTop: 8 },
});
