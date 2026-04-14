import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
  Animated,
  useWindowDimensions,
} from "react-native";
import { Text } from "../../components/StyledText";
import { AlertTriangle, Trophy, Settings } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import api from "../../lib/api";
import music from "../../lib/music";
import { useLanguage } from "../../lib/i18n";
import { connectSocket, disconnectSocket } from "../../lib/socket";
import {
  Resources,
  ResourceKey,
  AdvancedResourceKey,
  Champion,
  Farmer,
  Animal,
  Farm,
  Player,
  DungeonRun,
  PvpBattle,
  ClaimResult,
} from "../../types";
import {
  usePlayerQuery,
  useResourcesQuery,
  useChampionsQuery,
  useFarmersQuery,
  useFarmsQuery,
  useDungeonRunsQuery,
  usePvpStatusQuery,
} from "../../lib/query/queries";
import {
  useCollectFarmerMutation,
  useUpgradeFarmerMutation,
  useFillFarmerStorageMutation,
  useCollectAnimalMutation,
  useUpgradeAnimalMutation,
  useFillAnimalStorageMutation,
  useCollectFarmMutation,
  useUpgradeFarmMutation,
  useHealChampionMutation,
  useReviveChampionMutation,
  useSpendStatMutation,
  useSetDefenderMutation,
  useCoinReviveChampionMutation,
  useCoinHealChampionMutation,
  useClaimRunMutation,
  useSkipMissionMutation,
  useSkipPvpMutation,
  useUpgradeResourceCapMutation,
  useUpgradeAnimalStorageMutation,
} from "../../lib/query/mutations";
import { queryKeys } from "../../lib/query/queryKeys";
import { useFeedQueue } from "../../lib/store/useFeedQueue";
import ResourceBar from "../../components/ResourceBar";
import { getLeagueMeta } from "../../constants/leagues";
import { SafeAreaView } from "react-native-safe-area-context";
import ChampionCard from "../../components/ChampionCard";
import ChampionDrawer from "../../components/ChampionDrawer";
import FarmerCard from "../../components/FarmerCard";
import FarmerDrawer from "../../components/FarmerDrawer";
import AnimalCard from "../../components/AnimalCard";
import AnimalDrawer from "../../components/AnimalDrawer";
import FarmCard from "../../components/FarmCard";
import FarmDrawer from "../../components/FarmDrawer";
import ResourceCollectAnimation from "../../components/ResourceCollectAnimation";
import { RESOURCE_META } from "../../constants/resources";
import CapUpgradeModal from "../../components/CapUpgradeModal";
import AdvancedCapUpgradeModal from "../../components/AdvancedCapUpgradeModal";
import ClaimResultModal from "../../components/ClaimResultModal";
import PvpResultModal from "../../components/PvpResultModal";

const TAB_BACKGROUNDS = {
  champions: require("../../assets/fighters-bg.webp"),
  farmers: require("../../assets/farmers-bg.webp"),
  animals: require("../../assets/animals-bg.webp"),
} as const;
const ICON_SETTINGS = require("../../assets/icons/icon-settings.webp");
const ICON_FIGHTERS = require("../../assets/icons/icon-fighters.webp");
const ICON_FARMERS = require("../../assets/icons/icon-farmers.webp");
const ICON_ANIMALS = require("../../assets/icons/icon-animals.webp");
const ICON_BOILER = require("../../assets/boiler.webp");
const COIN_IMG = require("../../assets/icons/icon-coin.webp");

export default function MainScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // ── React Query — server state ───────────────────────────────────────────
  const queryClient = useQueryClient();
  const { data: player = null } = usePlayerQuery();
  const { data: resources = {
    strawberry: 0, pinecone: 0, blueberry: 0,
    strawberry_cap: 10, pinecone_cap: 10, blueberry_cap: 10,
    egg: 0, wool: 0, milk: 0,
    egg_cap: 10, wool_cap: 10, milk_cap: 10,
  } } = useResourcesQuery();
  const { data: champions = [] } = useChampionsQuery();
  const { data: farmers = [] } = useFarmersQuery();
  const { data: farms = [] } = useFarmsQuery();
  const { data: dungeonRuns = [] } = useDungeonRunsQuery();
  const { data: pvpStatus } = usePvpStatusQuery();

  // Derived from server state
  const coins = (player as Player | null)?.coins ?? 0;
  const animals = useMemo(() => farms.flatMap(f => f.animals ?? []), [farms]);
  const runMap = useMemo(() => {
    const m: Record<string, DungeonRun> = {};
    for (const r of dungeonRuns) {
      if (r.status === 'active') m[r.champion_id] = r;
    }
    return m;
  }, [dungeonRuns]);
  const pvpDefenderId = pvpStatus?.defender_champion_id ?? null;
  const pvpTrophies = pvpStatus?.trophies ?? 10;
  const pvpLeague = pvpStatus?.league ?? 'Bronz';
  const pvpUnlocked = pvpStatus?.pvp_unlocked ?? false;
  const pvpPendingChampionId = pvpStatus?.pending_battle?.attacker_champion_id ?? null;
  const pvpBattleEndsAt = pvpStatus?.pending_battle?.result_available_at ?? null;
  // ─────────────────────────────────────────────────────────────────────────

  const [capUpgradeConfirm, setCapUpgradeConfirm] = useState<{
    resource: ResourceKey;
    currentCap: number;
    cost: number;
    costRes1: ResourceKey;
    costRes2: ResourceKey;
  } | null>(null);
  const [advancedCapUpgradeConfirm, setAdvancedCapUpgradeConfirm] = useState<{
    resource: AdvancedResourceKey;
    currentCap: number;
    cost1: number;
    cost2: number;
    costRes1: ResourceKey;
    costRes2: ResourceKey;
    emoji: string;
  } | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(
    null,
  );
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [collectAnim, setCollectAnim] = useState<{
    amount: number;
    resourceType: string;
    startPosition: { x: number; y: number };
    targetPosition: { x: number; y: number };
    key: number;
  } | null>(null);
  const [animalCollectAnim, setAnimalCollectAnim] = useState<{
    amount: number;
    resourceType: string;
    startPosition: { x: number; y: number };
    targetPosition: { x: number; y: number };
    key: number;
  } | null>(null);

  // View refs for each HUD resource icon — measured lazily at collect-time via measureInWindow
  const resourceIconRefs = useRef<Record<string, View | null>>({});
  // Refs for each card in the current tab's row (up to 3)
  const farmerCardRefs = useRef<(View | null)[]>([null, null, null]);
  const farmCardRefs   = useRef<(View | null)[]>([null, null, null]);
  // Pulse state: which resource icon to pulse + version counter to re-trigger same key
  const [pulsingResource, setPulsingResource] = useState<{ key: string; version: number } | null>(null);
  type TabName = "champions" | "farmers" | "animals";
  const TAB_ORDER: TabName[] = ["champions", "farmers", "animals"];
  const [activeTab, setActiveTab] = useState<TabName>("champions");
  const [error, setError] = useState(false);
  const [missionTick, setMissionTick] = useState(0);
  const [expiredRunChampions, setExpiredRunChampions] = useState<Set<string>>(
    new Set(),
  );
  const [attackedBanner, setAttackedBanner] = useState<string | null>(null);
  const [resultBanner, setResultBanner] = useState(false);
  const [closedEyesCat, setClosedEyesCat] = useState<string | null>(null);
  const closedEyesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Background crossfade
  const [displayedBg, setDisplayedBg] = useState<TabName>("champions");
  const bgFadeAnim = useRef(new Animated.Value(0)).current;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const collectFarmerMut = useCollectFarmerMutation();
  const upgradeFarmerMut = useUpgradeFarmerMutation();
  const fillFarmerStorageMut = useFillFarmerStorageMutation();
  const collectAnimalMut = useCollectAnimalMutation();
  const upgradeAnimalMut = useUpgradeAnimalMutation();
  const fillAnimalStorageMut = useFillAnimalStorageMutation();
  const collectFarmMut = useCollectFarmMutation();
  const upgradeFarmMut = useUpgradeFarmMutation();
  const healChampionMut = useHealChampionMutation();
  const reviveChampionMut = useReviveChampionMutation();
  const spendStatMut = useSpendStatMutation();
  const setDefenderMut = useSetDefenderMutation();
  const coinReviveChampionMut = useCoinReviveChampionMutation();
  const coinHealChampionMut = useCoinHealChampionMutation();
  const claimRunMut = useClaimRunMutation();
  const skipMissionMut = useSkipMissionMutation();
  const skipPvpMut = useSkipPvpMutation();
  const upgradeResourceCapMut = useUpgradeResourceCapMutation();
  const upgradeAnimalStorageMut = useUpgradeAnimalStorageMutation();
  // ─────────────────────────────────────────────────────────────────────────

  // Feed queue — per-animal buffer coordinated via Zustand
  const tapFeed = useFeedQueue((s) => s.tapFeed);
  const tapFeedMax = useFeedQueue((s) => s.tapFeedMax);
  const catClickRef = useRef<{ champClass: string; count: number } | null>(
    null,
  );
  const catClickResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pvpResult, setPvpResult] = useState<PvpBattle | null>(null);

  const slideAnim = useRef(new Animated.Value(0)).current;

  // Notification dot pulse
  const dotPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, {
          toValue: 1.6,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(dotPulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Sync selected entities when the RQ cache updates ────────────────────
  // Keeps open drawer in sync with server data after mutations / invalidations.
  const selectedFarmerId = selectedFarmer?.id;
  useEffect(() => {
    if (!selectedFarmerId) return;
    const fresh = farmers.find((f) => f.id === selectedFarmerId);
    if (fresh) setSelectedFarmer(fresh);
  }, [farmers, selectedFarmerId]);

  const selectedAnimalId = selectedAnimal?.id;
  useEffect(() => {
    if (!selectedAnimalId) return;
    const fresh = animals.find((a) => a.id === selectedAnimalId);
    if (fresh) setSelectedAnimal(fresh);
  }, [animals, selectedAnimalId]);

  const selectedFarmId = selectedFarm?.id;
  useEffect(() => {
    if (!selectedFarmId) return;
    const fresh = farms.find((f) => f.id === selectedFarmId);
    if (fresh) setSelectedFarm(fresh);
  }, [farms, selectedFarmId]);

  const selectedChampionId = selectedChampion?.id;
  useEffect(() => {
    if (!selectedChampionId) return;
    const fresh = champions.find((c) => c.id === selectedChampionId);
    if (fresh) setSelectedChampion(fresh);
  }, [champions, selectedChampionId]);
  // ────────────────────────────────────────────────────────────────────────

  // ── Show result banner when pvp battle has resolved ──────────────────
  useEffect(() => {
    if (pvpBattleEndsAt && new Date(pvpBattleEndsAt) <= new Date()) {
      setResultBanner(true);
    }
  }, [pvpBattleEndsAt]);
  // ────────────────────────────────────────────────────────────────────────

  // ── Refetch only stale queries on screen focus ────────────────────────
  // refetchOnWindowFocus (AppState) handles app background→foreground.
  // This handles screen navigation within the app (e.g. returning from dungeons).
  // refetchType:'active' means only queries with mounted subscribers are touched.
  useFocusEffect(
    useCallback(() => {
      queryClient.refetchQueries({ queryKey: queryKeys.resources(),   type: 'active', stale: true });
      queryClient.refetchQueries({ queryKey: queryKeys.farmers(),     type: 'active', stale: true });
      queryClient.refetchQueries({ queryKey: queryKeys.farms(),       type: 'active' });
      queryClient.refetchQueries({ queryKey: queryKeys.dungeonRuns(), type: 'active' });
      queryClient.refetchQueries({ queryKey: queryKeys.pvpStatus(),   type: 'active' });
    }, [queryClient]),
  );

  // Socket.io — connect when player loads, disconnect on unmount
  useEffect(() => {
    if (!(player as Player | null)?.id) return;
    const sock = connectSocket((player as Player).id);
    sock.on(
      "pvp:attacked",
      ({ attackerName }: { battleId: string; attackerName: string }) => {
        setAttackedBanner(attackerName);
        setTimeout(() => setAttackedBanner(null), 4000);
      },
    );
    return () => {
      disconnectSocket();
    };
  }, [player?.id]);

  function handleCatPress(champClass: string) {
    // Track consecutive clicks on the same cat
    const prev = catClickRef.current;
    const count = prev?.champClass === champClass ? prev.count + 1 : 1;
    catClickRef.current = { champClass, count };

    // Reset click counter after 3 seconds of inactivity
    if (catClickResetTimer.current) clearTimeout(catClickResetTimer.current);
    catClickResetTimer.current = setTimeout(() => {
      catClickRef.current = null;
    }, 3000);

    // Play angry meow on 3rd+ consecutive click, otherwise random
    const MEOW_KEYS = ["MEOW_1", "MEOW_2", "MEOW_3"] as const;
    const sfxKey =
      count >= 3
        ? "MEOW_ANGRY"
        : MEOW_KEYS[Math.floor(Math.random() * MEOW_KEYS.length)];
    music.sfx(sfxKey);

    // Show closed-eyes image, reset after 1.5s
    setClosedEyesCat(champClass);
    if (closedEyesTimer.current) clearTimeout(closedEyesTimer.current);
    closedEyesTimer.current = setTimeout(() => setClosedEyesCat(null), 1500);
  }

  async function handleViewPvpResult() {
    try {
      const res = await api.get("/api/pvp/battles");
      if (res.data.length > 0) {
        // Invalidate so champions, resources, pvp trophies all refresh
        queryClient.invalidateQueries({ queryKey: queryKeys.champions() });
        queryClient.invalidateQueries({ queryKey: queryKeys.resources() });
        queryClient.invalidateQueries({ queryKey: queryKeys.pvpStatus() });
        setResultBanner(false);
        // Close drawer first so the result modal doesn't appear behind it
        setSelectedChampion(null);
        // Small delay to let the drawer dismiss before opening result modal
        setTimeout(() => setPvpResult(res.data[0]), 350);
      }
    } catch {
      // silent
    }
  }

  function switchTab(tab: TabName) {
    const idx = TAB_ORDER.indexOf(tab);
    const toValue = -idx * screenWidth;
    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: true,
      tension: 80,
      friction: 14,
    }).start();
    setActiveTab(tab);

    // Fade out old bg — new tab already rendered underneath
    bgFadeAnim.setValue(1);
    Animated.timing(bgFadeAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      setDisplayedBg(tab);
    });
  }

  const hasCards =
    champions.length > 0 ||
    farmers.length > 0 ||
    animals.length > 0 ||
    farms.length > 0;

  return (
    <View style={styles.bg}>
      {/* Back layer — new tab, pre-rendered underneath */}
      <ImageBackground
        source={TAB_BACKGROUNDS[activeTab]}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      {/* Front layer — old tab fades out, revealing new tab beneath */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { opacity: bgFadeAnim }]}
      >
        <ImageBackground
          source={TAB_BACKGROUNDS[displayedBg]}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      </Animated.View>
      <SafeAreaView style={styles.safeArea}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.playerNameRow}>
            {/* Avatar circle + name banner — unified card */}
            <TouchableOpacity
              onPress={() => router.push("/(game)/leaderboard")}
              activeOpacity={0.85}
              style={styles.profileCard}
            >
              {/* Circle sits on top (zIndex 2), overlaps the banner */}
              <View style={styles.avatarCircle}>
                <Image
                  source={ICON_FIGHTERS}
                  style={styles.avatarImg}
                  resizeMode="contain"
                />
                {/* <Image
                  source={getLeagueMeta(pvpTrophies).image}
                  style={styles.avatarLeagueBadge}
                  resizeMode="contain"
                /> */}
              </View>
              {/* Banner behind the circle */}
              <View style={styles.profileBanner}>
                <Text style={styles.playerName} numberOfLines={1}>
                  {player ? player.username : t("appName")}
                </Text>
                <View style={styles.trophyPillRow}>
                  {/* League */}
                  <Image
                    source={getLeagueMeta(pvpTrophies).image}
                    style={styles.leagueImg}
                    resizeMode="contain"
                  />
                  <Text
                    style={[
                      styles.leagueName,
                      { color: getLeagueMeta(pvpTrophies).color },
                    ]}
                  >
                    {getLeagueMeta(pvpTrophies).label}
                  </Text>
                  <View style={styles.pillDivider} />
                  {/* Trophy */}
                  <Trophy
                    size={10}
                    color="#60552f"
                    strokeWidth={2.5}
                    fill="#60552f"
                  />
                  <Text style={styles.trophyCount}>{pvpTrophies}</Text>
                  <View style={styles.pillDivider} />
                  {/* Coin */}
                  <Image
                    source={COIN_IMG}
                    style={styles.coinImg}
                    resizeMode="contain"
                  />
                  <Text style={styles.coinCount}>{coins}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(game)/settings")}
            style={styles.settingsBtn}
          >
            <Settings size={22} color="#7a5a30" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Resource pills */}
        <ResourceBar
          resources={resources}
          onUpgradeAdvanced={(resource) => {
            const ADVANCED_COSTS: Record<
              AdvancedResourceKey,
              {
                res1: ResourceKey;
                res2: ResourceKey;
                cost1: number;
                cost2: number;
                emoji: string;
              }
            > = {
              egg: {
                res1: "strawberry",
                res2: "pinecone",
                cost1: 20,
                cost2: 10,
                emoji: "🥚",
              },
              wool: {
                res1: "pinecone",
                res2: "blueberry",
                cost1: 20,
                cost2: 10,
                emoji: "🧶",
              },
              milk: {
                res1: "blueberry",
                res2: "strawberry",
                cost1: 20,
                cost2: 10,
                emoji: "🥛",
              },
            };
            const cfg = ADVANCED_COSTS[resource];
            const capKey = `${resource}_cap` as keyof Resources;
            const currentCap = (resources[capKey] as number) ?? 10;
            setAdvancedCapUpgradeConfirm({
              resource,
              currentCap,
              cost1: cfg.cost1,
              cost2: cfg.cost2,
              costRes1: cfg.res1,
              costRes2: cfg.res2,
              emoji: cfg.emoji,
            });
          }}
          onUpgrade={(resource) => {
            const CAP_COSTS: Record<ResourceKey, [ResourceKey, ResourceKey]> = {
              strawberry: ["pinecone", "blueberry"],
              pinecone: ["strawberry", "blueberry"],
              blueberry: ["strawberry", "pinecone"],
            };
            const capKey = `${resource}_cap` as keyof Resources;
            const currentCap = (resources[capKey] as number) ?? 15;
            const cost = Math.ceil((currentCap - 10) / 2 + 2);
            const [costRes1, costRes2] = CAP_COSTS[resource];
            setCapUpgradeConfirm({
              resource,
              currentCap,
              cost,
              costRes1,
              costRes2,
            });
          }}
          onIconRef={(key, ref) => { resourceIconRefs.current[key] = ref; }}
          pulsingKey={pulsingResource?.key ?? null}
          pulseVersion={pulsingResource?.version ?? 0}
        />

        {error && (
          <View style={styles.errorBanner}>
            <AlertTriangle size={14} color="#fff" strokeWidth={2} />
            <Text style={styles.errorText}>{t("cannotReachServer")}</Text>
          </View>
        )}

        {/* "Under attack" WebSocket banner */}
        {attackedBanner && (
          <View style={styles.pvpAttackedBanner}>
            <Text style={styles.pvpAttackedText}>
              ⚔️ {t("underAttack")} — {attackedBanner}
            </Text>
          </View>
        )}

        {/* "Result ready" polling banner */}
        {resultBanner && (
          <TouchableOpacity
            style={styles.pvpResultBanner}
            onPress={() => {
              setResultBanner(false);
              const pendingChamp = champions.find(
                (c) => c.id === pvpPendingChampionId,
              );
              if (pendingChamp) setSelectedChampion(pendingChamp);
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.pvpResultText}>🏆 {t("resultReady")}</Text>
          </TouchableOpacity>
        )}

        {/* Center — cats around campfire / farmer scene */}
        <View style={styles.centerFill}>
          {/* CampfireScene removed — background image now handles per-tab visuals */}
        </View>

        {/* Cards section */}
        {hasCards && (
          <View style={styles.cardsSection}>
            {/* Section header with 3-tab buttons */}
            {(() => {
              const farmerMaxCap = (level: number) => 4 + level;
              const calcFarmerPending = (f: (typeof farmers)[0]) => {
                const maxCap = farmerMaxCap(f.level);
                if (
                  !f._fetched_at_ms ||
                  !f.interval_minutes ||
                  f.next_ready_in_seconds == null
                )
                  return Math.min(f.pending ?? 0, maxCap);
                const elapsed = (Date.now() - f._fetched_at_ms) / 1000;
                const cycle = f.interval_minutes * 60;
                const rawLeft = Math.max(0, f.next_ready_in_seconds - elapsed);
                const burned = f.next_ready_in_seconds - rawLeft;
                const extra =
                  cycle > 0
                    ? Math.floor(
                        (cycle - f.next_ready_in_seconds + burned) / cycle,
                      )
                    : 0;
                return Math.min((f.pending ?? 0) + extra, maxCap);
              };
              const allFarmersFull =
                farmers.slice(0, 3).length === 3 &&
                farmers
                  .slice(0, 3)
                  .every((f) => calcFarmerPending(f) >= farmerMaxCap(f.level));
              const allAnimalsReady =
                farms.length === 3 &&
                farms.every((f) => (f.total_pending ?? 0) > 0);
              return (
                <View style={styles.tabRow}>
                  {(["champions", "farmers", "animals"] as TabName[]).map(
                    (tab) => {
                      const isActive = activeTab === tab;
                      const tabIcon =
                        tab === "champions"
                          ? ICON_FIGHTERS
                          : tab === "farmers"
                            ? ICON_FARMERS
                            : ICON_ANIMALS;
                      const tabLabel =
                        tab === "champions"
                          ? t("champions")
                          : tab === "farmers"
                            ? t("farmers")
                            : "Animals";
                      const showDot =
                        (tab === "farmers" && allFarmersFull) ||
                        (tab === "animals" && allAnimalsReady);
                      return (
                        <TouchableOpacity
                          key={tab}
                          style={[
                            styles.tabBtn,
                            isActive && styles.tabBtnActive,
                          ]}
                          onPress={() => switchTab(tab)}
                          activeOpacity={0.75}
                        >
                          <Image
                            source={tabIcon}
                            style={[
                              styles.tabBtnIcon,
                              !isActive && styles.tabBtnIconInactive,
                            ]}
                          />
                          <Text
                            style={[
                              styles.tabBtnText,
                              isActive && styles.tabBtnTextActive,
                            ]}
                          >
                            {tabLabel}
                          </Text>
                          {showDot && (
                            <Animated.View
                              style={[
                                styles.notifDot,
                                { transform: [{ scale: dotPulse }] },
                              ]}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    },
                  )}

                  {/* Kitchen button */}
                  <TouchableOpacity
                    style={styles.tabBtn}
                    onPress={() => router.push("/(game)/kitchen")}
                    activeOpacity={0.75}
                  >
                    <Image source={ICON_BOILER} style={styles.tabBtnIcon} />
                  </TouchableOpacity>
                </View>
              );
            })()}

            {/* Sliding card rows */}
            <View style={styles.slideClip}>
              <Animated.View
                style={[
                  styles.slideContainer,
                  {
                    width: screenWidth * 3,
                    transform: [{ translateX: slideAnim }],
                  },
                ]}
              >
                {/* Champions row */}
                <View style={[styles.cardsRow, { width: screenWidth }]}>
                  {champions.slice(0, 3).map((c) => (
                    <ChampionCard
                      key={c.id}
                      champion={c}
                      activeRunEndsAt={runMap[c.id]?.ends_at}
                      pvpBattleEndsAt={
                        pvpPendingChampionId === c.id
                          ? (pvpBattleEndsAt ?? undefined)
                          : undefined
                      }
                      onPress={setSelectedChampion}
                      isDefender={pvpDefenderId === c.id}
                    />
                  ))}
                </View>

                {/* Farmers row */}
                <View style={[styles.cardsRow, { width: screenWidth }]}>
                  {farmers.slice(0, 3).map((f, i) => (
                    <View
                      key={f.id}
                      ref={(el) => { farmerCardRefs.current[i] = el as any; }}
                      style={{ flex: 1 }}
                    >
                      <FarmerCard
                        farmer={f}
                        onPress={setSelectedFarmer}
                      />
                    </View>
                  ))}
                </View>

                {/* Animals row — farm cards */}
                <View style={[styles.cardsRow, { width: screenWidth }]}>
                  {farms.slice(0, 3).map((f, i) => (
                    <View
                      key={f.id}
                      ref={(el) => { farmCardRefs.current[i] = el as any; }}
                      style={{ flex: 1 }}
                    >
                      <FarmCard farm={f} onPress={setSelectedFarm} />
                    </View>
                  ))}
                </View>
              </Animated.View>
            </View>
          </View>
        )}
      </SafeAreaView>

      <ChampionDrawer
        champion={selectedChampion}
        resources={resources}
        onClose={() => setSelectedChampion(null)}
        onPvp={(champion) => {
          setSelectedChampion(null);
          router.push({
            pathname: "/(game)/pvp",
            params: {
              championId: champion.id,
              championName: champion.name,
              championClass: champion.class,
              championAttack: String(champion.attack),
              championDefense: String(champion.defense),
              championChance: String(champion.chance),
              championMaxHp: String(champion.max_hp),
              championCurrentHp: String(champion.current_hp),
              championLevel: String(champion.level),
              myTrophies: String(pvpTrophies ?? 10),
              myLeague: pvpLeague ?? "Bronz",
            },
          });
        }}
        onDungeon={() => {
          const champ = selectedChampion;
          setSelectedChampion(null);
          router.push({
            pathname: "/(game)/dungeons",
            params: {
              championId: champ?.id,
              championName: champ?.name,
              championClass: champ?.class,
              championAttack: String(champ?.attack ?? 0),
              championDefense: String(champ?.defense ?? 0),
              championChance: String(champ?.chance ?? 0),
              championBoostDefense: String(champ?.boost_defense ?? 0),
              championBoostChance: String(champ?.boost_chance ?? 0),
              championCurrentHp: String(champ?.current_hp ?? 0),
              championMaxHp: String(champ?.max_hp ?? 0),
              championBoostHp: String(champ?.boost_hp ?? 0),
            },
          });
        }}
        claimableRun={
          selectedChampion &&
          runMap[selectedChampion.id] &&
          (new Date(runMap[selectedChampion.id].ends_at) <= new Date() ||
            expiredRunChampions.has(selectedChampion.id))
            ? runMap[selectedChampion.id]
            : undefined
        }
        isOnMission={
          !!(
            selectedChampion &&
            runMap[selectedChampion.id] &&
            new Date(runMap[selectedChampion.id].ends_at) > new Date() &&
            !expiredRunChampions.has(selectedChampion.id)
          )
        }
        activeRunEndsAt={
          selectedChampion &&
          runMap[selectedChampion.id] &&
          new Date(runMap[selectedChampion.id].ends_at) > new Date() &&
          !expiredRunChampions.has(selectedChampion.id)
            ? runMap[selectedChampion.id].ends_at
            : undefined
        }
        onRevive={async (champion) => {
          setSelectedChampion(null);
          try {
            await reviveChampionMut.mutateAsync(champion.id);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Canlandırma başarısız");
          }
        }}
        onHeal={async (champion) => {
          try {
            await healChampionMut.mutateAsync(champion.id);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "İyileştirme başarısız");
          }
        }}
        onMissionExpire={() => {
          setMissionTick((t) => t + 1);
          if (selectedChampion) {
            setExpiredRunChampions(
              (prev) => new Set([...prev, selectedChampion.id]),
            );
          }
        }}
        defenderChampionId={pvpDefenderId}
        pvpTrophies={pvpTrophies}
        pvpLeague={pvpLeague}
        pvpUnlocked={pvpUnlocked}
        isPvpBattle={pvpPendingChampionId === selectedChampion?.id}
        playerHasPendingBattle={!!pvpPendingChampionId}
        pvpBattleEndsAt={
          pvpPendingChampionId === selectedChampion?.id
            ? (pvpBattleEndsAt ?? undefined)
            : undefined
        }
        onViewPvpResult={handleViewPvpResult}
        onSetDefender={async (champion) => {
          try {
            await setDefenderMut.mutateAsync(champion.id);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Savunucu ayarlanamadı");
          }
        }}
        onSpendStat={async (champion, stat) => {
          try {
            await spendStatMut.mutateAsync({ championId: champion.id, stat });
          } catch (err: any) {
            alert(
              err.response?.data?.error ?? "İstatistik güçlendirme başarısız",
            );
          }
        }}
        coins={coins}
        onCoinRevive={async (champion) => {
          try {
            await coinReviveChampionMut.mutateAsync(champion.id);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Coin ile canlandırma başarısız");
          }
        }}
        onCoinHeal={async (champion) => {
          try {
            await coinHealChampionMut.mutateAsync(champion.id);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Coin ile iyileştirme başarısız");
          }
        }}
        onFoodUsed={(updatedChampion) => {
          queryClient.setQueryData<Champion[]>(queryKeys.champions(), (old) =>
            (old ?? []).map((c) =>
              c.id === updatedChampion.id ? updatedChampion : c,
            ),
          );
        }}
        onSkipPvp={async () => {
          const battleId = pvpStatus?.pending_battle?.battleId;
          if (!battleId) return;
          try {
            await skipPvpMut.mutateAsync(battleId);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Skip başarısız");
          }
        }}
        onSkipMission={async (champion) => {
          const run = selectedChampion && runMap[selectedChampion.id];
          if (!run) return;
          try {
            const data = await skipMissionMut.mutateAsync(run.id);
            setExpiredRunChampions((prev) => new Set([...prev, champion.id]));
            queryClient.setQueryData<DungeonRun[]>(queryKeys.dungeonRuns(), (old) =>
              (old ?? []).map((r) =>
                r.champion_id === champion.id ? { ...r, ends_at: data.ends_at } : r,
              ),
            );
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Skip başarısız");
          }
        }}
        onClaim={async (run) => {
          setSelectedChampion(null);
          setExpiredRunChampions((prev) => {
            const next = new Set(prev);
            next.delete(run.champion_id);
            return next;
          });
          try {
            const data = await claimRunMut.mutateAsync(run.id);
            setClaimResult(data);
          } catch {
            setClaimResult({
              winner: "enemy",
              rewardResource: "",
              rewardAmount: 0,
              rewardResource2: null,
              rewardAmount2: 0,
              coinReward: 0,
              starsEarned: null,
              log: [],
              xpGained: 0,
              levelsGained: 0,
              newLevel: 1,
            });
          }
        }}
      />

      <FarmerDrawer
        farmer={selectedFarmer}
        resources={resources}
        coins={coins}
        onClose={() => setSelectedFarmer(null)}
        onFillStorage={async (farmer) => {
          try {
            await fillFarmerStorageMut.mutateAsync(farmer.id);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Depo doldurulamadı");
          }
        }}
        onCollect={async (farmer) => {
          const idx = farmers.findIndex((f) => f.id === farmer.id);
          try {
            const data = await collectFarmerMut.mutateAsync(farmer.id);
            setSelectedFarmer(null);
            // 200ms lets the drawer close; then measure BOTH positions lazily via measureInWindow
            setTimeout(() => {
              const cardRef  = farmerCardRefs.current[idx >= 0 ? idx : 0];
              const iconRef  = resourceIconRefs.current[farmer.resource_type];
              const fallbackStart  = { x: screenWidth / 2, y: screenHeight * 0.7 };
              const fallbackTarget = { x: screenWidth / 2, y: 80 };

              const launch = (startPos: { x: number; y: number }, targetPos: { x: number; y: number }) => {
                music.sfxRepeat("COLLECT", data.collected);
                setCollectAnim({
                  amount: data.collected,
                  resourceType: farmer.resource_type,
                  startPosition: startPos,
                  targetPosition: targetPos,
                  key: Date.now(),
                });
              };

              const measureStart = (cb: (p: { x: number; y: number }) => void) => {
                cardRef
                  ? cardRef.measureInWindow((x, y, w, h) => cb({ x: x + w / 2, y: y + h / 2 }))
                  : cb(fallbackStart);
              };
              const measureTarget = (cb: (p: { x: number; y: number }) => void) => {
                iconRef
                  ? iconRef.measureInWindow((x, y, w, h) => cb({ x: x + w / 2, y: y + h / 2 }))
                  : cb(fallbackTarget);
              };

              measureStart((startPos) => measureTarget((targetPos) => launch(startPos, targetPos)));
            }, 200);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Toplama başarısız");
          }
        }}
        onUpgrade={async (farmer) => {
          try {
            await upgradeFarmerMut.mutateAsync(farmer.id);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Geliştirme başarısız");
          }
        }}
        onFarmerUpdated={(updated) => {
          const fresh = { ...updated, _fetched_at_ms: Date.now() };
          queryClient.setQueryData<Farmer[]>(queryKeys.farmers(), (old) =>
            (old ?? []).map((f) => (f.id === updated.id ? fresh : f)),
          );
        }}
      />

      <FarmDrawer
        farm={selectedFarm}
        resources={resources}
        onClose={() => setSelectedFarm(null)}
        onCollect={async (farm) => {
          const idx = farms.findIndex((f) => f.farm_type === farm.farm_type);
          const amount = farm.total_pending ?? 1;
          try {
            await collectFarmMut.mutateAsync(farm.farm_type);
            setSelectedFarm(null);
            setTimeout(() => {
              const cardRef  = farmCardRefs.current[idx >= 0 ? idx : 0];
              const iconRef  = resourceIconRefs.current[farm.produce_resource];
              const fallbackStart  = { x: screenWidth / 2, y: screenHeight * 0.7 };
              const fallbackTarget = { x: screenWidth / 2, y: 80 };
              const launch = (startPos: { x: number; y: number }, targetPos: { x: number; y: number }) => {
                music.sfxRepeat("COLLECT", amount);
                setAnimalCollectAnim({
                  amount,
                  resourceType: farm.produce_resource,
                  startPosition: startPos,
                  targetPosition: targetPos,
                  key: Date.now(),
                });
              };
              const measureStart = (cb: (p: { x: number; y: number }) => void) => {
                cardRef
                  ? cardRef.measureInWindow((x, y, w, h) => cb({ x: x + w / 2, y: y + h / 2 }))
                  : cb(fallbackStart);
              };
              const measureTarget = (cb: (p: { x: number; y: number }) => void) => {
                iconRef
                  ? iconRef.measureInWindow((x, y, w, h) => cb({ x: x + w / 2, y: y + h / 2 }))
                  : cb(fallbackTarget);
              };
              measureStart((startPos) => measureTarget((targetPos) => launch(startPos, targetPos)));
            }, 200);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Collect failed");
          }
        }}
        onUpgrade={async (farm) => {
          try {
            await upgradeFarmMut.mutateAsync(farm.farm_type);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Farm upgrade failed");
          }
        }}
      />

      <AnimalDrawer
        animal={selectedAnimal}
        resources={resources}
        coins={coins}
        onClose={() => setSelectedAnimal(null)}
        onFillStorage={async (animal) => {
          try {
            await fillAnimalStorageMut.mutateAsync(animal.id);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Depo doldurulamadı");
          }
        }}
        onUpgrade={async (animal) => {
          try {
            await upgradeAnimalMut.mutateAsync(animal.id);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Upgrade failed");
          }
        }}
        onFeed={(animal) => {
          tapFeed(animal, queryClient);
        }}
        onFeedMax={(animal, requestedUnits) => {
          tapFeedMax(animal, requestedUnits, queryClient);
        }}
        onCollect={async (animal) => {
          // Find which farm card (by index) contains this animal
          const farmIdx = farms.findIndex(
            (fm) => fm.animals?.some((a: any) => a.id === animal.id),
          );
          try {
            const data = await collectAnimalMut.mutateAsync(animal.id);
            setSelectedAnimal(null);
            setTimeout(() => {
              const cardRef  = farmCardRefs.current[farmIdx >= 0 ? farmIdx : 0];
              const iconRef  = resourceIconRefs.current[animal.produce_resource];
              const fallbackStart  = { x: screenWidth / 2, y: screenHeight * 0.7 };
              const fallbackTarget = { x: screenWidth / 2, y: 80 };

              const launch = (startPos: { x: number; y: number }, targetPos: { x: number; y: number }) => {
                music.sfxRepeat("COLLECT", data.collected);
                setAnimalCollectAnim({
                  amount: data.collected,
                  resourceType: animal.produce_resource,
                  startPosition: startPos,
                  targetPosition: targetPos,
                  key: Date.now(),
                });
              };

              const measureStart = (cb: (p: { x: number; y: number }) => void) => {
                cardRef
                  ? cardRef.measureInWindow((x, y, w, h) => cb({ x: x + w / 2, y: y + h / 2 }))
                  : cb(fallbackStart);
              };
              const measureTarget = (cb: (p: { x: number; y: number }) => void) => {
                iconRef
                  ? iconRef.measureInWindow((x, y, w, h) => cb({ x: x + w / 2, y: y + h / 2 }))
                  : cb(fallbackTarget);
              };

              measureStart((startPos) => measureTarget((targetPos) => launch(startPos, targetPos)));
            }, 200);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Collect failed");
          }
        }}
      />

      <CapUpgradeModal
        confirm={capUpgradeConfirm}
        resources={resources}
        onClose={() => setCapUpgradeConfirm(null)}
        onConfirm={upgradeResourceCapMut.mutateAsync}
      />

      <AdvancedCapUpgradeModal
        confirm={advancedCapUpgradeConfirm}
        resources={resources}
        onClose={() => setAdvancedCapUpgradeConfirm(null)}
        onConfirm={upgradeAnimalStorageMut.mutateAsync}
      />

      <ClaimResultModal
        result={claimResult}
        onClose={() => setClaimResult(null)}
      />

      <PvpResultModal
        result={pvpResult}
        onClose={() => setPvpResult(null)}
      />

      {/* Particle collect animations — full-screen overlay so particles can fly from cards → HUD */}
      {collectAnim && (
        <ResourceCollectAnimation
          key={collectAnim.key}
          startPosition={collectAnim.startPosition}
          targetPosition={collectAnim.targetPosition}
          amount={collectAnim.amount}
          icon={RESOURCE_META[collectAnim.resourceType]?.image as any}
          onDone={() => { setCollectAnim(null); setPulsingResource(null); }}
          onArrival={() => setPulsingResource((p) => ({
            key: collectAnim.resourceType,
            version: (p?.version ?? 0) + 1,
          }))}
        />
      )}
      {animalCollectAnim && (
        <ResourceCollectAnimation
          key={animalCollectAnim.key}
          startPosition={animalCollectAnim.startPosition}
          targetPosition={animalCollectAnim.targetPosition}
          amount={animalCollectAnim.amount}
          icon={RESOURCE_META[animalCollectAnim.resourceType]?.image as any}
          onDone={() => { setAnimalCollectAnim(null); setPulsingResource(null); }}
          onArrival={() => setPulsingResource((p) => ({
            key: animalCollectAnim.resourceType,
            version: (p?.version ?? 0) + 1,
          }))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  playerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "#c8a96e",
    backgroundColor: "#f5edd8",
    overflow: "visible",
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {
    width: 45,
    height: 45,
  },
  avatarLeagueBadge: {
    position: "absolute",
    width: 34,
    height: 34,
    bottom: -10,
    alignSelf: "center",
  },
  profileBanner: {
    flex: 1,
    height: 46,
    marginLeft: -14,
    paddingLeft: 20,
    paddingRight: 10,
    backgroundColor: "#f5edd8",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    zIndex: 1,
    justifyContent: "center",
    gap: 2,
  },
  playerName: {
    color: "#000",
    fontSize: 13,
    fontWeight: "700",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  trophyPillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  leagueImg: {
    width: 16,
    height: 16,
  },
  leagueName: {
    fontSize: 11,
    fontWeight: "800",
  },
  trophyCount: {
    color: "#60552f",
    fontSize: 12,
    fontWeight: "800",
  },
  pillDivider: {
    width: 1,
    height: 10,
    backgroundColor: "#a08050",
    opacity: 0.6,
    marginHorizontal: 2,
  },
  coinImg: {
    width: 13,
    height: 13,
  },
  coinCount: {
    color: "#60552f",
    fontSize: 12,
    fontWeight: "800",
  },
  settingsBtn: {
    backgroundColor: "#f5edd8",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    width: 46,
    height: 46,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsBtnIcon: {
    width: 26,
    height: 26,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: "rgba(220,50,50,0.85)",
    borderRadius: 10,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  errorText: {
    color: "#fff",
    fontSize: 13,
  },
  pvpAttackedBanner: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: "rgba(192, 57, 43, 0.92)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  pvpAttackedText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  pvpLogScroll: {
    maxHeight: 200,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  pvpLogRound: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9a7040",
    textAlign: "center",
    marginVertical: 4,
    letterSpacing: 1,
  },
  pvpLogRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: "#f0e4c8",
    borderRadius: 6,
    marginBottom: 2,
  },
  pvpLogActor: {
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },
  pvpLogChamp: { color: "#2d5a24" },
  pvpLogEnemy: { color: "#c0392b" },
  pvpLogDmg: {
    fontSize: 12,
    fontWeight: "800",
    color: "#3a2a10",
    minWidth: 50,
    textAlign: "center",
  },
  pvpLogHp: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7a5a30",
    minWidth: 45,
    textAlign: "right",
  },
  pvpResultBanner: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: "rgba(74, 124, 63, 0.92)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  pvpResultText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  centerFill: {
    flex: 1,
    justifyContent: "flex-end",
    overflow: "visible",
  },
  cardsSection: {
    paddingBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tabRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 12,
    justifyContent: "flex-end",
  },
  tabBtn: {
    position: "relative",
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(245,237,216,0.65)",
    borderWidth: 1.5,
    borderColor: "#d4b896",
    alignItems: "center",
    gap: 3,
  },
  tabBtnActive: {
    backgroundColor: "rgba(245,237,216,0.97)",
    borderColor: "#9a7040",
    shadowColor: "#9a7040",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  tabBtnIcon: {
    width: 32,
    height: 32,
  },
  tabBtnIconInactive: {
    opacity: 0.55,
  },
  tabBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7a5030",
  },
  tabBtnTextActive: {
    color: "#3a1e00",
    fontWeight: "900",
  },
  notifDot: {
    position: "absolute",
    right: -2,
    top: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e67e22",
    borderWidth: 1,
    borderColor: "#fff",
    marginLeft: 2,
  },
  slideClip: {
    overflow: "hidden",
  },
  slideContainer: {
    flexDirection: "row",
  },
  cardsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
});
