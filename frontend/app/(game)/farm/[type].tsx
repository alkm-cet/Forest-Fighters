import { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Text } from "../../../components/StyledText";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, ArrowUp, Info, Package, Plus, Timer } from "lucide-react-native";
// ArrowUp used in farmUpgradeSection CustomButton icon
import api from "../../../lib/api";
import { Farm, Animal, Resources } from "../../../types";
import { FARM_META, RESOURCE_META } from "../../../constants/resources";
import CustomButton from "../../../components/CustomButton";
import CustomModal from "../../../components/CustomModal";

const ANIMAL_MAX_LEVEL = 50;
const MAX_FARM_SLOTS = 20;
const FARM_UPGRADE_COST_PER_LEVEL = 10;

function getMaxCapacity(level: number) { return 9 + level; }
function getUpgradeCost(level: number) { return level * 2; }

const UPGRADE_RESOURCES: Record<string, [string, string]> = {
  chicken: ["strawberry", "pinecone"],
  sheep:   ["pinecone",   "blueberry"],
  cow:     ["blueberry",  "strawberry"],
};

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

// Stamp each animal with _fetched_at_ms so interpolation works
function stampAnimals(animals: Animal[]): Animal[] {
  const now = Date.now();
  return animals.map((a) => ({ ...a, _fetched_at_ms: now }));
}

// Interpolate one animal forward from its snapshot to now
function interpolateAnimal(a: Animal) {
  const elapsedSec = a._fetched_at_ms ? (Date.now() - a._fetched_at_ms) / 1000 : 0;
  const cycleSec = a.interval_minutes * 60;
  const maxCap = getMaxCapacity(a.level);
  const fuelSec = Math.max(0, a.fuel_remaining_minutes * 60 - elapsedSec);
  const actualRun = a.fuel_remaining_minutes * 60 - fuelSec;
  const rawProgress = a.progress_minutes * 60 + actualRun;
  const extraCycles = cycleSec > 0 ? Math.floor(rawProgress / cycleSec) : 0;
  const progressSec = cycleSec > 0 ? rawProgress % cycleSec : 0;
  const pending = Math.min(a.pending + extraCycles, maxCap);
  return { fuelSec, progressSec, pending };
}

// Per-animal live state
type AnimalLive = {
  id: string;
  fuelSec: number;
  progressSec: number;
  pending: number;
  initialFuelSec: number; // fuel at last feed/load — used to proportion the fuel bar
};

export default function FarmScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const router = useRouter();
  const farmType = type as "chicken" | "sheep" | "cow";

  const [farm, setFarm] = useState<Farm | null>(null);
  const [resources, setResources] = useState<Resources | null>(null);
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);

  // Live per-animal state map: animalId → { fuelSec, progressSec, pending }
  const [liveMap, setLiveMap] = useState<Record<string, AnimalLive>>({});
  const liveMapRef = useRef<Record<string, AnimalLive>>({});

  // Animal upgrade modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<Animal | null>(null);

  // Feed buffer (same pattern as index.tsx)
  const feedBufferRef = useRef(0);
  const feedInFlightRef = useRef(false);
  const flushFeedBufferRef = useRef<(animalId: string) => void>(
    null as unknown as (animalId: string) => void,
  );
  flushFeedBufferRef.current = (animalId: string) => {
    if (feedInFlightRef.current || feedBufferRef.current === 0) return;
    feedInFlightRef.current = true;
    const count = feedBufferRef.current;
    feedBufferRef.current = 0;
    (count === 1
      ? api.post(`/api/animals/${animalId}/feed`)
      : api.post(`/api/animals/${animalId}/feed-max`, { requestedUnits: count })
    )
      .then((res) => {
        const fresh = { ...res.data.animal, _fetched_at_ms: Date.now() };
        if (fresh.current_feed >= fresh.max_feed) feedBufferRef.current = 0;
        if (res.data.resources) setResources(res.data.resources);
        setFarm((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            animals: prev.animals.map((a) => (a.id === animalId ? fresh : a)),
          };
        });
        // Re-interpolate updated animal; reset initialFuelSec so fuel bar proportions correctly
        const { fuelSec, progressSec, pending } = interpolateAnimal(fresh);
        setLiveMap((prev) => ({
          ...prev,
          [animalId]: { id: animalId, fuelSec, progressSec, pending, initialFuelSec: fuelSec },
        }));
      })
      .catch(() => { feedBufferRef.current = 0; })
      .finally(() => {
        feedInFlightRef.current = false;
        if (feedBufferRef.current > 0) flushFeedBufferRef.current?.(animalId);
      });
  };

  // Feed max modal
  const [showMaxFeedConfirm, setShowMaxFeedConfirm] = useState(false);

  async function loadFarm() {
    try {
      const [farmsRes, resRes] = await Promise.all([
        api.get("/api/farms"),
        api.get("/api/resources"),
      ]);
      const found = farmsRes.data.find((f: Farm) => f.farm_type === farmType);
      if (found) {
        found.animals = stampAnimals(found.animals);
        setFarm(found);
        initLiveMap(found.animals);
      }
      setResources(resRes.data);
    } catch {
      // silent
    }
  }

  function initLiveMap(animals: Animal[]) {
    const map: Record<string, AnimalLive> = {};
    for (const a of animals) {
      const { fuelSec, progressSec, pending } = interpolateAnimal(a);
      map[a.id] = { id: a.id, fuelSec, progressSec, pending, initialFuelSec: fuelSec };
    }
    liveMapRef.current = map;
    setLiveMap({ ...map });
  }

  useEffect(() => {
    if (Platform.OS === "android") {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFarm();
    }, [farmType]),
  );

  // Tick: advance all running animals every second
  useEffect(() => {
    if (!farm) return;
    const interval = setInterval(() => {
      setLiveMap((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const animal of farm.animals) {
          const live = next[animal.id];
          if (!live) continue;
          const maxCap = getMaxCapacity(animal.level);
          if (live.fuelSec <= 0 || live.pending >= maxCap) continue;
          changed = true;
          const cycleSec = animal.interval_minutes * 60;
          const newFuelSec = Math.max(0, live.fuelSec - 1);
          let newProgressSec = live.progressSec + 1;
          let newPending = live.pending;
          if (newProgressSec >= cycleSec) {
            newPending = Math.min(newPending + 1, maxCap);
            newProgressSec = 0;
          }
          next[animal.id] = { ...live, fuelSec: newFuelSec, progressSec: newProgressSec, pending: newPending };
        }
        if (!changed) return prev;
        liveMapRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [farm?.id, farm?.animals.map((a) => a.id).join(",")]);

  // Re-interpolate when farm refreshes
  useEffect(() => {
    if (farm) initLiveMap(farm.animals);
  }, [farm?.animals.map((a) => `${a.id}:${a.fuel_remaining_minutes}:${a.pending}`).join(",")]);

  // Must be declared before any early return to satisfy Rules of Hooks
  const feedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (!farm) {
    const meta = FARM_META[farmType] ?? { farmLabel: "Farm", color: "#888", image: null };
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color="#7a5230" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{meta.farmLabel}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#9a7040" }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const meta = FARM_META[farm.farm_type];
  const produceMeta = RESOURCE_META[farm.produce_resource];
  const consumeMeta = RESOURCE_META[farm.consume_resource];

  const totalMaxCapacity = farm.animals.reduce((sum, a) => sum + a.max_capacity, 0);
  const totalPending = Object.values(liveMap).reduce((s, l) => s + (l?.pending ?? 0), 0);

  const pineconesMeta = RESOURCE_META["pinecone"];

  const selectedAnimal = farm.animals.find((a) => a.id === selectedAnimalId) ?? farm.animals[0] ?? null;
  const selectedLive = selectedAnimal ? liveMap[selectedAnimal.id] : null;

  // Feed UI for selected animal
  const liveFeedUnits = selectedAnimal && selectedAnimal.minutes_per_feed > 0
    ? Math.min(Math.ceil((selectedLive?.fuelSec ?? 0) / 60 / selectedAnimal.minutes_per_feed), selectedAnimal.max_feed)
    : 0;
  const availableFeed = selectedAnimal
    ? ((resources?.[selectedAnimal.consume_resource as keyof Resources] as number) ?? 0)
    : 0;
  const feedNeededForMax = selectedAnimal ? Math.max(0, selectedAnimal.max_feed - liveFeedUnits) : 0;
  const canFeedOne = availableFeed >= 1 && selectedAnimal ? liveFeedUnits < selectedAnimal.max_feed : false;
  const canFeedMax = feedNeededForMax > 0 && availableFeed >= feedNeededForMax;
  const feedPct = selectedAnimal && selectedAnimal.max_feed > 0
    ? Math.min(liveFeedUnits / selectedAnimal.max_feed, 1)
    : 0;

  // Selected animal upgrade affordability
  const [selRes1, selRes2] = selectedAnimal ? (UPGRADE_RESOURCES[selectedAnimal.animal_type] ?? ["?", "?"]) : ["?", "?"];
  const selUpgCost = selectedAnimal ? getUpgradeCost(selectedAnimal.level) : 0;
  const canUpgradeSelected = !!selectedAnimal &&
    selectedAnimal.level < ANIMAL_MAX_LEVEL &&
    ((resources?.[selRes1 as keyof Resources] as number) ?? 0) >= selUpgCost &&
    ((resources?.[selRes2 as keyof Resources] as number) ?? 0) >= selUpgCost;
  const selRes1Meta = RESOURCE_META[selRes1];
  const selRes2Meta = RESOURCE_META[selRes2];

  async function handleAddAnimal() {
    if (!farm) return;
    try {
      const res = await api.post(`/api/farms/${farm.farm_type}/animals`);
      const updated: Farm = res.data.farm;
      updated.animals = stampAnimals(updated.animals);
      setFarm(updated);
      initLiveMap(updated.animals);
    } catch (err: any) {
      alert(err.response?.data?.error ?? "Failed to add animal");
    }
  }

  async function handleAnimalUpgrade(animal: Animal) {
    const [res1, res2] = UPGRADE_RESOURCES[animal.animal_type] ?? ["?", "?"];
    const cost = getUpgradeCost(animal.level);
    if (
      ((resources?.[res1 as keyof Resources] as number) ?? 0) < cost ||
      ((resources?.[res2 as keyof Resources] as number) ?? 0) < cost
    ) {
      alert(`Need ${cost} ${res1} + ${cost} ${res2} to upgrade`);
      return;
    }
    try {
      const apiRes = await api.post(`/api/animals/${animal.id}/upgrade`);
      const fresh = { ...apiRes.data.animal, _fetched_at_ms: Date.now() };
      setResources(apiRes.data.resources);
      setFarm((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          animals: prev.animals.map((a) => (a.id === animal.id ? fresh : a)),
        };
      });
      const { fuelSec, progressSec, pending } = interpolateAnimal(fresh);
      setLiveMap((prev) => ({
        ...prev,
        [animal.id]: { id: animal.id, fuelSec, progressSec, pending },
      }));
    } catch (err: any) {
      alert(err.response?.data?.error ?? "Upgrade failed");
    }
  }

  async function handleCollectAnimal(animal: Animal) {
    if (!farm) return;
    try {
      const res = await api.post(`/api/farms/${farm.farm_type}/animals/${animal.id}/collect`);
      const updated: Farm = res.data.farm;
      updated.animals = stampAnimals(updated.animals);
      setFarm(updated);
      setResources(res.data.resources);
      initLiveMap(updated.animals);
    } catch (err: any) {
      alert(err.response?.data?.error ?? "Collect failed");
    }
  }

  const emptySlots = Math.max(0, farm.slot_count - farm.animals.length);

  return (
    <SafeAreaView style={styles.screen}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#7a5230" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{meta.farmLabel}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Sticky info block ── */}
      <View style={styles.stickyBlock}>
        <View style={styles.stickyRow}>
          <View style={styles.stickyLeft}>
            {/* Pending pill */}
            <View style={[styles.pendingPill, { backgroundColor: meta.color }]}>
              {produceMeta?.image && (
                <Image source={produceMeta.image} style={styles.pillIcon} resizeMode="contain" />
              )}
              <Text style={styles.pillText}>
                {totalPending} / {totalMaxCapacity}
              </Text>
            </View>
            {/* Slot info */}
            <View style={styles.slotPill}>
              <Text style={styles.slotPillText}>
                {farm.animals.length}/{farm.slot_count} slots
              </Text>
            </View>
          </View>

          {/* Farm level badge */}
          <View style={styles.farmLevelBadge}>
            <Text style={styles.farmLevelLabel}>FARM LV</Text>
            <Text style={styles.farmLevelNum}>{farm.level}</Text>
          </View>
        </View>
      </View>

      {/* ── Animal list ── */}
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {farm.animals.map((animal) => {
          const live = liveMap[animal.id];
          const maxCap = getMaxCapacity(animal.level);
          const cycleSec = animal.interval_minutes * 60;
          const isStopped = (live?.fuelSec ?? 0) <= 0;
          const isFull = (live?.pending ?? 0) >= maxCap;
          const progressFrac = isFull || isStopped || cycleSec <= 0
            ? (isStopped ? (live?.progressSec ?? 0) / cycleSec : 0)
            : Math.min((live?.progressSec ?? 0) / cycleSec, 1);
          const countdown = Math.max(0, cycleSec - (live?.progressSec ?? 0));
          const isSelected = selectedAnimalId === animal.id || (!selectedAnimalId && animal.id === farm.animals[0]?.id);

          const animalConsumeMeta = RESOURCE_META[animal.consume_resource];
          const initialFuelSec = live?.initialFuelSec ?? 0;
          const fuelFrac = initialFuelSec > 0 ? Math.min((live?.fuelSec ?? 0), initialFuelSec) / initialFuelSec : 0;

          const [res1, res2] = UPGRADE_RESOURCES[animal.animal_type] ?? ["?", "?"];
          const upgCost = getUpgradeCost(animal.level);
          const canUpgradeAnimal = animal.level < ANIMAL_MAX_LEVEL &&
            ((resources?.[res1 as keyof Resources] as number) ?? 0) >= upgCost &&
            ((resources?.[res2 as keyof Resources] as number) ?? 0) >= upgCost;

          return (
            <View key={animal.id}>
              <View style={styles.animalRowOuter}>
                {/* Card + fuel dropdown */}
                <View style={{ flex: 1 }}>
                  <TouchableOpacity
                    style={[
                      styles.animalRow,
                      isSelected && [
                        styles.animalRowSelected,
                        { borderColor: meta.color, shadowColor: meta.color },
                      ],
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setSelectedAnimalId(animal.id);
                    }}
                  >
                    {/* Selected: left color bar */}
                    {isSelected && (
                      <View style={[styles.selectedBar, { backgroundColor: meta.color }]} />
                    )}

                    {/* Animal image + LV badge overlay */}
                    <View style={styles.animalImageWrap}>
                      {meta.image && (
                        <Image source={meta.image} style={styles.animalRowImage} resizeMode="contain" />
                      )}
                      <View style={styles.animalLvBadge}>
                        <Text style={styles.animalLvBadgeText}>LV{animal.level}</Text>
                      </View>
                    </View>

                    {/* Middle: timer row + capacity */}
                    <View style={styles.animalMid}>
                      <View style={styles.timerRow}>
                        {!isFull && (
                          <View style={[styles.timerFill, {
                            width: `${progressFrac * 100}%` as any,
                            backgroundColor: isStopped ? "#b0a080" : meta.color,
                            opacity: isStopped ? 0.5 : 1,
                          }]} />
                        )}
                        <Timer size={11} color={isFull ? "#c0392b" : isStopped ? "#6a3a0a" : "#2a1a00"} strokeWidth={2} />
                        <Text style={[styles.timerLabel, isFull && styles.timerLabelFull]} numberOfLines={1}>
                          {isFull ? "Depo dolu" : isStopped ? "Durakladı — Üretim için besle!" : "Sonraki"}
                        </Text>
                        {!isFull && !isStopped && (
                          <Text style={styles.timerCountdown}>{formatTime(countdown)}</Text>
                        )}
                      </View>
                      <View style={styles.capacityRow}>
                        <View style={[styles.capacityBadge, { backgroundColor: isFull ? "#c0392b" : "#d4b896" }]}>
                          <Text style={[styles.capacityText, { color: isFull ? "#fff" : "#3a1e00" }]}>
                            {live?.pending ?? 0}/{maxCap}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Production rate (right side, replaces + button) */}
                    <View style={styles.animalRateBlock}>
                      <Text style={styles.animalRateValue}>{Number(animal.interval_minutes).toFixed(1)}</Text>
                      <Text style={styles.animalRateUnit}>dk/ürt</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Fuel dropdown */}
                  {isSelected && !isStopped && !isFull && (
                    <View style={[styles.fuelDropdown, { borderColor: meta.color }]}>
                      <View style={[styles.fuelFill, {
                        width: `${fuelFrac * 100}%` as any,
                        backgroundColor: animalConsumeMeta?.color ?? "#c8781a",
                      }]} />
                      {animalConsumeMeta?.image && (
                        <Image source={animalConsumeMeta.image} style={styles.fuelRowIcon} resizeMode="contain" />
                      )}
                      <Text style={styles.fuelRowLabel} numberOfLines={1}>
                        {animalConsumeMeta?.label ?? animal.consume_resource} tükeniyor
                      </Text>
                      <Text style={styles.fuelRowCountdown}>{formatTime(live?.fuelSec ?? 0)}</Text>
                    </View>
                  )}
                </View>

                {/* Collect button — appears whenever animal has pending produce */}
                {(live?.pending ?? 0) > 0 && (
                  <TouchableOpacity
                    style={[styles.collectSideBtn, { backgroundColor: meta.color }]}
                    activeOpacity={0.8}
                    onPress={() => handleCollectAnimal(animal)}
                  >
                    {produceMeta?.image && (
                      <Image source={produceMeta.image} style={styles.collectSideBtnIcon} resizeMode="contain" />
                    )}
                    <Text style={styles.collectSideBtnNum}>{live?.pending ?? 0}/{maxCap}</Text>
                    <Text style={styles.collectSideBtnLabel}>Topla</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {/* Empty slot rows */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <TouchableOpacity key={`empty-${i}`} style={styles.emptySlotRow} activeOpacity={0.7} onPress={handleAddAnimal}>
            <View style={styles.emptySlotIcon}>
              <Plus size={20} color="#9a7040" strokeWidth={2.5} />
            </View>
            <Text style={styles.emptySlotText}>{meta.label} Ekle</Text>
            <Text style={styles.emptySlotHint}>Slot dolu değil</Text>
          </TouchableOpacity>
        ))}

      </ScrollView>

      {/* ── Bottom feed section ── */}
      {selectedAnimal && (
        <View style={styles.feedSection}>
          <View style={styles.feedHeader}>
            <Package size={12} color="#9a7040" strokeWidth={2} />
            <Text style={styles.feedHeaderText}>FEED</Text>
            <Text style={styles.feedAvailableText}>
              {availableFeed} {consumeMeta?.label ?? selectedAnimal.consume_resource} available
            </Text>
          </View>

          {/* Feed info */}
          <View style={styles.feedInfoRow}>
            <Info size={11} color="#9a7040" strokeWidth={2} />
            <Text style={styles.feedInfoText}>
              Her bir {consumeMeta?.label ?? selectedAnimal.consume_resource}, {meta.label.toLowerCase()}lara +{Number(selectedAnimal.minutes_per_feed).toFixed(0)} dk üretim süresi verir.
            </Text>
          </View>

          {/* Feed bar */}
          <View style={styles.feedBarRow}>
            {consumeMeta?.image && (
              <Image source={consumeMeta.image} style={styles.feedBarIcon} resizeMode="contain" />
            )}
            <View style={styles.feedBarTrack}>
              <View
                style={[
                  styles.feedBarFill,
                  {
                    width: `${feedPct * 100}%` as any,
                    backgroundColor: consumeMeta?.color ?? meta.color,
                  },
                ]}
              />
            </View>
            <Text style={styles.feedBarText}>{liveFeedUnits} / {selectedAnimal.max_feed}</Text>
          </View>

          {/* Feed buttons */}
          <View style={styles.feedBtnsRow}>
            <TouchableOpacity
              style={[styles.feedBtn, !canFeedOne && styles.feedBtnDisabled]}
              activeOpacity={0.7}
              onPress={() => {
                feedBufferRef.current += 1;
                flushFeedBufferRef.current?.(selectedAnimal.id);
              }}
              onLongPress={() => {
                feedBufferRef.current += 1;
                flushFeedBufferRef.current?.(selectedAnimal.id);
                feedIntervalRef.current = setInterval(() => {
                  feedBufferRef.current += 1;
                  flushFeedBufferRef.current?.(selectedAnimal.id);
                }, 200);
              }}
              onPressOut={() => {
                if (feedIntervalRef.current) {
                  clearInterval(feedIntervalRef.current);
                  feedIntervalRef.current = null;
                }
              }}
              delayLongPress={300}
            >
              <Text style={[styles.feedBtnLabel, !canFeedOne && styles.feedBtnTextDisabled]}>Yemle</Text>
              <Text style={[styles.feedBtnText, !canFeedOne && styles.feedBtnTextDisabled]}>+1</Text>
              {consumeMeta?.image && (
                <Image source={consumeMeta.image} style={styles.feedBtnIcon} resizeMode="contain" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.feedMaxBtn, !feedNeededForMax && styles.feedBtnDisabled]}
              activeOpacity={0.7}
              onPress={() => setShowMaxFeedConfirm(true)}
            >
              <Text style={[styles.feedBtnLabel, !feedNeededForMax && styles.feedBtnTextDisabled]}>Yemle</Text>
              <Text style={[styles.feedMaxBtnText, !feedNeededForMax && styles.feedBtnTextDisabled]}>
                Max {feedNeededForMax > 0 ? `(${feedNeededForMax})` : ""}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Upgrade selected animal button */}
          <CustomButton
            btnIcon={<ArrowUp size={20} color="#fff" strokeWidth={2.5} />}
            text={
              !selectedAnimal
                ? "Hayvan Seç"
                : selectedAnimal.level >= ANIMAL_MAX_LEVEL
                  ? `Maks Seviye (LV ${selectedAnimal.level})`
                  : `Hayvanı Geliştir → LV ${selectedAnimal.level + 1}`
            }
            subContent={
              selectedAnimal && selectedAnimal.level < ANIMAL_MAX_LEVEL ? (
                <View style={styles.upgradeCostRow}>
                  {selRes1Meta?.image && <Image source={selRes1Meta.image} style={styles.upgradeCostIcon} resizeMode="contain" />}
                  <Text style={styles.upgradeCostText}>×{selUpgCost}</Text>
                  {selRes2Meta?.image && <Image source={selRes2Meta.image} style={styles.upgradeCostIcon} resizeMode="contain" />}
                  <Text style={styles.upgradeCostText}>×{selUpgCost}</Text>
                </View>
              ) : undefined
            }
            onClick={() => {
              if (selectedAnimal) {
                setUpgradeTarget(selectedAnimal);
                setShowUpgradeModal(true);
              }
            }}
            bgColor={canUpgradeSelected ? "#4a7c3f" : "#9a7040"}
            borderColor={canUpgradeSelected ? "#2d5a24" : "#7a5030"}
            disabled={!canUpgradeSelected}
          />
        </View>
      )}

      {/* Animal upgrade confirmation modal */}
      <CustomModal
        visible={showUpgradeModal}
        onClose={() => { setShowUpgradeModal(false); setUpgradeTarget(null); }}
        onConfirm={() => {
          setShowUpgradeModal(false);
          if (upgradeTarget) handleAnimalUpgrade(upgradeTarget);
          setUpgradeTarget(null);
        }}
        title={`Upgrade ${meta.label}?`}
        confirmText="Upgrade"
        confirmDisabled={false}
      >
        {upgradeTarget && (() => {
          const [r1, r2] = UPGRADE_RESOURCES[upgradeTarget.animal_type] ?? ["?", "?"];
          const cost = getUpgradeCost(upgradeTarget.level);
          const r1Meta = RESOURCE_META[r1];
          const r2Meta = RESOURCE_META[r2];
          return (
            <View style={styles.upgradeModalBody}>
              <Text style={styles.upgradeModalText}>
                Level {upgradeTarget.level} → {upgradeTarget.level + 1}
              </Text>
              <View style={styles.upgradeModalCostRow}>
                {r1Meta?.image && <Image source={r1Meta.image} style={styles.modalCostIcon} resizeMode="contain" />}
                <Text style={styles.upgradeModalCostText}>×{cost}</Text>
                {r2Meta?.image && <Image source={r2Meta.image} style={styles.modalCostIcon} resizeMode="contain" />}
                <Text style={styles.upgradeModalCostText}>×{cost}</Text>
              </View>
            </View>
          );
        })()}
      </CustomModal>

      {/* Feed max confirmation modal */}
      <CustomModal
        visible={showMaxFeedConfirm}
        onClose={() => setShowMaxFeedConfirm(false)}
        onConfirm={() => {
          setShowMaxFeedConfirm(false);
          if (!selectedAnimal) return;
          if (feedInFlightRef.current) {
            feedBufferRef.current += feedNeededForMax;
            return;
          }
          api.post(`/api/animals/${selectedAnimal.id}/feed-max`, { requestedUnits: feedNeededForMax })
            .then((res) => {
              const fresh = { ...res.data.animal, _fetched_at_ms: Date.now() };
              if (res.data.resources) setResources(res.data.resources);
              setFarm((prev) => {
                if (!prev) return prev;
                return { ...prev, animals: prev.animals.map((a) => (a.id === selectedAnimal.id ? fresh : a)) };
              });
              const { fuelSec, progressSec, pending } = interpolateAnimal(fresh);
              setLiveMap((prev) => ({
                ...prev,
                [selectedAnimal.id]: { id: selectedAnimal.id, fuelSec, progressSec, pending, initialFuelSec: fuelSec },
              }));
            })
            .catch((err: any) => alert(err.response?.data?.error ?? "Feed max failed"));
        }}
        title={`Feed ${meta.label}?`}
        confirmText="Confirm"
        confirmDisabled={!canFeedMax}
      >
        <Text style={styles.modalBody}>
          This will use{" "}
          <Text style={styles.modalCost}>
            {feedNeededForMax} {consumeMeta?.label ?? selectedAnimal?.consume_resource}
          </Text>
          {"\n"}to fill feed storage.
        </Text>
        {!canFeedMax && (
          <Text style={styles.modalWarning}>
            Not enough {consumeMeta?.label} (have {availableFeed}, need {feedNeededForMax})
          </Text>
        )}
      </CustomModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5e9cc" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: "#d4b896",
    backgroundColor: "#f5e9cc",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#ede0c4",
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#3a1e00" },

  // Sticky block
  stickyBlock: {
    backgroundColor: "#ede0c4",
    borderBottomWidth: 1.5,
    borderBottomColor: "#d4b896",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  stickyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stickyLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  stickyRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  pendingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillIcon: { width: 16, height: 16 },
  pillText: { fontSize: 13, fontWeight: "800", color: "#fff" },
  slotPill: {
    backgroundColor: "#d4b896",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  slotPillText: { fontSize: 11, fontWeight: "700", color: "#3a1e00" },
  farmLevelBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: "#e8c87a",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderColor: "#c8a040",
    gap: 3,
  },
  farmLevelLabel: { fontSize: 9, fontWeight: "700", color: "#7a5020" },
  farmLevelNum: { fontSize: 14, fontWeight: "900", color: "#3a1e00" },
  // List
  listScroll: { flex: 1 },
  listContent: { padding: 14, gap: 10 },

  // Animal row outer (card + collect button side by side)
  animalRowOuter: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  // Animal row
  animalRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5edd8",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#d4b896",
    padding: 12,
    gap: 12,
  },
  animalRowSelected: {
    borderWidth: 3,
    backgroundColor: "#fffef8",
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    transform: [{ scale: 1.025 }],
    zIndex: 2,
  },
  selectedBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    borderTopLeftRadius: 11,
    borderBottomLeftRadius: 11,
  },
  animalImageWrap: { position: "relative", width: 52, height: 52 },
  animalRowImage: { width: 52, height: 52 },
  animalLvBadge: {
    position: "absolute",
    top: -4,
    left: -4,
    backgroundColor: "#e8c87a",
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#c8a040",
    paddingHorizontal: 4,
    paddingVertical: 1,
    zIndex: 2,
  },
  animalLvBadgeText: { fontSize: 9, fontWeight: "900", color: "#3a1e00" },
  animalMid: { flex: 1, gap: 5 },

  // AnimalDrawer-style timer row
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ede0c4",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 5,
    overflow: "hidden",
    position: "relative",
  },
  timerFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 8,
  },
  timerLabel: { fontSize: 11, fontWeight: "700", color: "#2a1a00", flex: 1 },
  timerLabelFull: { color: "#c0392b" },
  timerCountdown: { fontSize: 12, fontWeight: "800", color: "#4a2e0a", letterSpacing: 0.5 },

  // Capacity row
  capacityRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  capacityBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  capacityText: { fontSize: 10, fontWeight: "800" },
  animalRateBlock: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
  },
  animalRateValue: { fontSize: 16, fontWeight: "900", color: "#3a1e00" },
  animalRateUnit: { fontSize: 9, fontWeight: "700", color: "#8a6a40" },

  // Collect side button (right of selected animal row)
  collectSideBtn: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minWidth: 58,
    alignSelf: "stretch",
  },
  collectSideBtnIcon: { width: 20, height: 20 },
  collectSideBtnNum: { fontSize: 11, fontWeight: "900", color: "#fff" },
  collectSideBtnLabel: { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.85)" },

  // Empty slot
  emptySlotRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ede0c4",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#d4b896",
    borderStyle: "dashed",
    padding: 16,
    gap: 12,
  },
  emptySlotIcon: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#d4b896",
    alignItems: "center",
    justifyContent: "center",
  },
  emptySlotText: { fontSize: 15, fontWeight: "700", color: "#7a5030", flex: 1 },
  emptySlotHint: { fontSize: 11, color: "#9a7040" },

  // Farm upgrade section (bottom of list)
  farmUpgradeSection: {
    marginTop: 6,
    paddingBottom: 4,
  },
  upgradeCostRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  upgradeCostIcon: { width: 16, height: 16 },
  upgradeCostText: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.85)" },

  // Bottom feed section
  feedSection: {
    backgroundColor: "#ede0c4",
    borderTopWidth: 1.5,
    borderTopColor: "#d4b896",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 8,
  },
  feedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  feedHeaderText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#9a7040",
    letterSpacing: 0.5,
    flex: 1,
  },
  feedAvailableText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7a5030",
  },
  feedBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  feedBtnsRow: { flexDirection: "row", gap: 12 },
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
    gap: 5,
  },
  feedMaxBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#c8781a",
    borderWidth: 2,
    borderColor: "#9a5010",
    borderRadius: 12,
    paddingVertical: 11,
    gap: 5,
  },
  feedBtnDisabled: { opacity: 0.4 },
  feedBtnText: { fontSize: 16, fontWeight: "900", color: "#fff" },
  feedMaxBtnText: { fontSize: 14, fontWeight: "900", color: "#fff" },
  feedBtnLabel: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.8)" },
  feedBtnTextDisabled: { color: "#fff" },
  feedBtnIcon: { width: 18, height: 18 },
  feedInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#e4d4b0",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  feedInfoText: {
    flex: 1,
    fontSize: 10,
    fontWeight: "600",
    color: "#7a5030",
    lineHeight: 14,
  },

  // Fuel dropdown panel — appears below the selected animal card
  fuelDropdown: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e4d4b0",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    marginHorizontal: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
    overflow: "hidden",
    position: "relative",
    marginTop: -2,
  },
  fuelFill: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    opacity: 0.35,
  },
  fuelRowIcon: { width: 11, height: 11 },
  fuelRowLabel: { fontSize: 10, fontWeight: "600", color: "#5a3a10", flex: 1 },
  fuelRowCountdown: { fontSize: 10, fontWeight: "800", color: "#4a2e0a", letterSpacing: 0.3 },

  // Modals
  upgradeModalBody: { gap: 8 },
  upgradeModalText: { fontSize: 14, fontWeight: "600", color: "#5a3a10" },
  upgradeModalCostRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  modalCostIcon: { width: 20, height: 20 },
  upgradeModalCostText: { fontSize: 14, fontWeight: "800", color: "#3a1e00" },
  modalBody: { fontSize: 14, fontWeight: "600", color: "#5a3a10", lineHeight: 22 },
  modalCost: { fontWeight: "900", color: "#3a1e00" },
  modalWarning: { fontSize: 12, fontWeight: "700", color: "#c0392b", marginTop: 8 },
});
