import { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
  Animated,
  useWindowDimensions,
  Modal,
  ScrollView,
} from "react-native";
import { Text } from "../../components/StyledText";
import {
  Leaf,
  Settings,
  AlertTriangle,
  Sprout,
  Swords,
  Trophy,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
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
  Player,
  DungeonRun,
  PvpBattle,
} from "../../types";
import ResourceBar from "../../components/ResourceBar";
import { RESOURCE_META } from "../../constants/resources";
import { SafeAreaView } from "react-native-safe-area-context";
import ChampionCard from "../../components/ChampionCard";
import ChampionDrawer from "../../components/ChampionDrawer";
import FarmerCard from "../../components/FarmerCard";
import FarmerDrawer from "../../components/FarmerDrawer";
import AnimalCard from "../../components/AnimalCard";
import AnimalDrawer from "../../components/AnimalDrawer";
import CollectFloater from "../../components/CollectFloater";
import CampfireScene from "../../components/CampfireScene";

const BG = require("../../assets/home-assets/background-image-3.png");

export default function MainScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { width: screenWidth } = useWindowDimensions();

  const [player, setPlayer] = useState<Player | null>(null);
  const [resources, setResources] = useState<Resources>({
    strawberry: 0,
    pinecone: 0,
    blueberry: 0,
    strawberry_cap: 10,
    pinecone_cap: 10,
    blueberry_cap: 10,
    egg: 0,
    wool: 0,
    milk: 0,
    egg_cap: 10,
    wool_cap: 10,
    milk_cap: 10,
  });
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
  const [champions, setChampions] = useState<Champion[]>([]);
  const [runMap, setRunMap] = useState<Record<string, DungeonRun>>({});
  const [claimResult, setClaimResult] = useState<{
    winner: "champion" | "enemy";
    rewardResource: string;
    rewardAmount: number;
    log: any[];
    xpGained: number;
    levelsGained: number;
    newLevel: number;
  } | null>(null);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(
    null,
  );
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [collectAnim, setCollectAnim] = useState<{
    farmerId: string;
    amount: number;
    resourceType: string;
    farmerIndex: number;
    key: number;
  } | null>(null);
  type TabName = "champions" | "farmers" | "animals";
  const TAB_ORDER: TabName[] = ["champions", "farmers", "animals"];
  const [activeTab, setActiveTab] = useState<TabName>("champions");
  const [error, setError] = useState(false);
  const [missionTick, setMissionTick] = useState(0);
  const [expiredRunChampions, setExpiredRunChampions] = useState<Set<string>>(new Set());
  const [attackedBanner, setAttackedBanner] = useState<string | null>(null);
  const [resultBanner, setResultBanner] = useState(false);
  const [pvpDefenderId, setPvpDefenderId] = useState<string | null>(null);
  const [pvpTrophies, setPvpTrophies] = useState<number>(10);
  const [closedEyesCat, setClosedEyesCat] = useState<string | null>(null);
  const closedEyesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catClickRef = useRef<{ champClass: string; count: number } | null>(null);
  const catClickResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pvpLeague, setPvpLeague] = useState<string>("Bronz");
  const [pvpUnlocked, setPvpUnlocked] = useState<boolean>(false);
  const [pvpPendingChampionId, setPvpPendingChampionId] = useState<string | null>(null);
  const [pvpBattleEndsAt, setPvpBattleEndsAt] = useState<string | null>(null);
  const [pvpResult, setPvpResult] = useState<PvpBattle | null>(null);

  const slideAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        api.get("/api/auth/me").then((r) => setPlayer(r.data)),
        api.get("/api/resources").then((r) => setResources(r.data)),
        api.get("/api/champions").then((r) => setChampions(r.data)),
        api.get("/api/farmers").then((r) => {
          const now = Date.now();
          const stamped = r.data.map((f: Farmer) => ({ ...f, _fetched_at_ms: now }));
          setFarmers(stamped);
        }),
        api.get("/api/animals").then((r) => {
          const now = Date.now();
          const stamped = r.data.map((a: Animal) => ({ ...a, _fetched_at_ms: now }));
          setAnimals(stamped);
          setSelectedAnimal((prev) =>
            prev ? (stamped.find((a: Animal) => a.id === prev.id) ?? prev) : null
          );
        }),
        api.get("/api/dungeons/runs").then((r) => {
          const map: Record<string, DungeonRun> = {};
          for (const run of r.data) {
            if (run.status === "active") map[run.champion_id] = run;
          }
          setRunMap(map);
        }),
      ]).catch(() => setError(true));

      // Check PvP status on focus
      api.get("/api/pvp/status").then((r) => {
        setPvpDefenderId(r.data.defender_champion_id ?? null);
        setPvpTrophies(r.data.trophies ?? 10);
        setPvpLeague(r.data.league ?? "Bronz");
        setPvpUnlocked(r.data.pvp_unlocked ?? false);
        const pending = r.data.pending_battle;
        if (pending) {
          setPvpPendingChampionId(pending.attacker_champion_id ?? null);
          setPvpBattleEndsAt(pending.result_available_at ?? null);
          if (new Date(pending.result_available_at) <= new Date()) {
            setResultBanner(true);
          }
        } else {
          setPvpPendingChampionId(null);
          setPvpBattleEndsAt(null);
        }
      }).catch(() => {});
    }, []),
  );

  // Socket.io — connect when player loads, disconnect on unmount
  useEffect(() => {
    if (!player?.id) return;
    const sock = connectSocket(player.id);
    sock.on("pvp:attacked", ({ attackerName }: { battleId: string; attackerName: string }) => {
      setAttackedBanner(attackerName);
      setTimeout(() => setAttackedBanner(null), 4000);
    });
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
        // Refresh data first
        const [champRes, resRes] = await Promise.all([
          api.get("/api/champions"),
          api.get("/api/resources"),
        ]);
        setChampions(champRes.data);
        setResources(resRes.data);
        setPvpPendingChampionId(null);
        setPvpBattleEndsAt(null);
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
  }

  const hasCards = champions.length > 0 || farmers.length > 0 || animals.length > 0;

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <SafeAreaView style={styles.safeArea}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.playerNameRow}>
            <Leaf size={16} color="#a8e6a3" strokeWidth={2} />
            <Text style={styles.playerName}>
              {player ? player.username : t("appName")}
            </Text>
            <View style={styles.trophyPill}>
              <Trophy size={11} color="#ffd54f" strokeWidth={2.5} fill="#ffd54f" />
              <Text style={styles.trophyCount}>{pvpTrophies}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(game)/settings")}
            style={styles.settingsBtn}
          >
            <Settings size={18} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Resource pills */}
        <ResourceBar
          resources={resources}
          onUpgradeAdvanced={(resource) => {
            const ADVANCED_COSTS: Record<AdvancedResourceKey, { res1: ResourceKey; res2: ResourceKey; cost1: number; cost2: number; emoji: string }> = {
              egg:  { res1: "strawberry", res2: "pinecone",  cost1: 20, cost2: 10, emoji: "🥚" },
              wool: { res1: "pinecone",   res2: "blueberry", cost1: 20, cost2: 10, emoji: "🧶" },
              milk: { res1: "blueberry",  res2: "strawberry", cost1: 20, cost2: 10, emoji: "🥛" },
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
              const pendingChamp = champions.find((c) => c.id === pvpPendingChampionId);
              if (pendingChamp) setSelectedChampion(pendingChamp);
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.pvpResultText}>🏆 {t("resultReady")}</Text>
          </TouchableOpacity>
        )}

        {/* Center — cats around campfire / farmer scene */}
        <View style={styles.centerFill}>
          {(champions.length > 0 || farmers.length > 0) && (
            <CampfireScene
              champions={champions}
              farmers={farmers}
              animals={animals}
              activeTab={activeTab}
              closedEyesCat={closedEyesCat}
              onCatPress={handleCatPress}
            />
          )}
        </View>

        {/* Cards section */}
        {hasCards && (
          <View style={styles.cardsSection}>
            {/* Section header with 3-tab buttons */}
            <View style={styles.cardsSectionHeader}>
              <View style={styles.sectionTitleRow}>
                {activeTab === "farmers" ? (
                  <Sprout size={13} color="#a8e6a3" strokeWidth={2.5} />
                ) : (
                  <Swords size={13} color="#a8e6a3" strokeWidth={2.5} />
                )}
                <Text style={styles.sectionTitle}>
                  {activeTab === "farmers"
                    ? t("farmersUpper")
                    : activeTab === "animals"
                    ? "ANIMALS"
                    : t("championsUpper")}
                </Text>
              </View>
              <View style={styles.tabRow}>
                {(["champions", "farmers", "animals"] as TabName[]).map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                    onPress={() => switchTab(tab)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
                      {tab === "champions" ? t("champions") : tab === "farmers" ? t("farmers") : "Animals"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Collect floater — rendered outside slideClip to avoid overflow:hidden clipping */}
            {collectAnim && activeTab === "farmers" && (
              <CollectFloater
                key={collectAnim.key}
                amount={collectAnim.amount}
                resourceType={collectAnim.resourceType}
                farmerIndex={collectAnim.farmerIndex}
                screenWidth={screenWidth}
                onDone={() => setCollectAnim(null)}
              />
            )}

            {/* Sliding card rows */}
            <View style={styles.slideClip}>
              <Animated.View
                style={[
                  styles.slideContainer,
                  { width: screenWidth * 3, transform: [{ translateX: slideAnim }] },
                ]}
              >
                {/* Champions row */}
                <View style={[styles.cardsRow, { width: screenWidth }]}>
                  {champions.slice(0, 3).map((c) => (
                    <ChampionCard
                      key={c.id}
                      champion={c}
                      activeRunEndsAt={runMap[c.id]?.ends_at}
                      pvpBattleEndsAt={pvpPendingChampionId === c.id ? pvpBattleEndsAt ?? undefined : undefined}
                      onPress={setSelectedChampion}
                      isDefender={pvpDefenderId === c.id}
                    />
                  ))}
                </View>

                {/* Farmers row */}
                <View style={[styles.cardsRow, { width: screenWidth }]}>
                  {farmers.slice(0, 3).map((f) => (
                    <FarmerCard
                      key={f.id}
                      farmer={f}
                      onPress={setSelectedFarmer}
                    />
                  ))}
                </View>

                {/* Animals row */}
                <View style={[styles.cardsRow, { width: screenWidth }]}>
                  {animals.slice(0, 3).map((a) => (
                    <AnimalCard
                      key={a.id}
                      animal={a}
                      onPress={setSelectedAnimal}
                    />
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
              championId:      champion.id,
              championName:    champion.name,
              championClass:   champion.class,
              championAttack:  String(champion.attack),
              championDefense: String(champion.defense),
              championChance:  String(champion.chance),
              championMaxHp:   String(champion.max_hp),
              championCurrentHp: String(champion.current_hp),
              championLevel:   String(champion.level),
              myTrophies:      String(pvpTrophies ?? 10),
              myLeague:        pvpLeague ?? "Bronz",
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
            const res = await api.post(`/api/champions/${champion.id}/revive`);
            setResources((r) => ({ ...r, strawberry: res.data.strawberry }));
            api.get("/api/champions").then((r) => setChampions(r.data));
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Canlandırma başarısız");
          }
        }}
        onHeal={async (champion) => {
          setSelectedChampion(null);
          try {
            const res = await api.post(`/api/champions/${champion.id}/heal`);
            setResources((r) => ({ ...r, strawberry: res.data.strawberry }));
            api.get("/api/champions").then((r) => setChampions(r.data));
          } catch (err: any) {
            alert(err.response?.data?.error ?? "İyileştirme başarısız");
          }
        }}
        onMissionExpire={() => {
          setMissionTick((t) => t + 1);
          if (selectedChampion) {
            setExpiredRunChampions((prev) => new Set([...prev, selectedChampion.id]));
          }
        }}
        defenderChampionId={pvpDefenderId}
        pvpTrophies={pvpTrophies}
        pvpLeague={pvpLeague}
        pvpUnlocked={pvpUnlocked}
        isPvpBattle={pvpPendingChampionId === selectedChampion?.id}
        pvpBattleEndsAt={pvpPendingChampionId === selectedChampion?.id ? pvpBattleEndsAt ?? undefined : undefined}
        onViewPvpResult={handleViewPvpResult}
        onSetDefender={async (champion) => {
          try {
            const res = await api.post("/api/pvp/set-defender", { champion_id: champion.id });
            setPvpDefenderId(res.data.defender_champion_id);
            setPvpTrophies(res.data.trophies);
            setPvpLeague(res.data.league);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Savunucu ayarlanamadı");
          }
        }}
        onBoost={async (champion, type) => {
          try {
            const res = await api.post(`/api/champions/${champion.id}/boost`, { type });
            setResources(res.data.resources);
            setChampions((prev) =>
              prev.map((c) => (c.id === champion.id ? res.data.champion : c)),
            );
            setSelectedChampion(res.data.champion);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Boost başarısız");
          }
        }}
        onSpendStat={async (champion, stat) => {
          try {
            const res = await api.post(
              `/api/champions/${champion.id}/spend-stat`,
              { stat },
            );
            setChampions((prev) =>
              prev.map((c) => (c.id === champion.id ? res.data : c)),
            );
            setSelectedChampion(res.data);
          } catch (err: any) {
            alert(
              err.response?.data?.error ?? "İstatistik güçlendirme başarısız",
            );
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
            const res = await api.post(`/api/dungeons/runs/${run.id}/claim`);
            // Refresh all state before showing modal so UI is consistent when modal closes
            await Promise.all([
              api.get("/api/resources").then((r) => setResources(r.data)),
              api.get("/api/champions").then((r) => setChampions(r.data)),
              api.get("/api/dungeons/runs").then((r) => {
                const map: Record<string, DungeonRun> = {};
                for (const r2 of r.data) {
                  if (r2.status === "active") map[r2.champion_id] = r2;
                }
                setRunMap(map);
              }),
            ]).catch(() => {});
            setClaimResult(res.data);
          } catch (err: any) {
            setClaimResult({
              winner: "enemy",
              rewardResource: "",
              rewardAmount: 0,
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
        onClose={() => setSelectedFarmer(null)}
        onCollect={async (farmer) => {
          try {
            const res = await api.post(`/api/farmers/${farmer.id}/collect`);
            setResources(res.data.resources);
            api.get("/api/farmers").then((r) => {
              const now = Date.now();
              setFarmers(r.data.map((f: Farmer) => ({ ...f, _fetched_at_ms: now })));
            });
            setSelectedFarmer(null);
            music.sfx("COLLECT");
            const idx = farmers.findIndex((f) => f.id === farmer.id);
            setCollectAnim({
              farmerId: farmer.id,
              amount: res.data.collected,
              resourceType: farmer.resource_type,
              farmerIndex: idx >= 0 ? idx : 0,
              key: Date.now(),
            });
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Toplama başarısız");
          }
        }}
        onUpgrade={async (farmer) => {
          try {
            const res = await api.post(`/api/farmers/${farmer.id}/upgrade`);
            const fresh = { ...res.data.farmer, _fetched_at_ms: Date.now() };
            setResources(res.data.resources);
            setFarmers((prev) => prev.map((f) => (f.id === farmer.id ? fresh : f)));
            setSelectedFarmer(fresh);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Geliştirme başarısız");
          }
        }}
      />

      <AnimalDrawer
        animal={selectedAnimal}
        resources={resources}
        onClose={() => setSelectedAnimal(null)}
        onUpgrade={async (animal) => {
          try {
            const res = await api.post(`/api/animals/${animal.id}/upgrade`);
            const fresh = { ...res.data.animal, _fetched_at_ms: Date.now() };
            setResources(res.data.resources);
            setAnimals((prev) => prev.map((a) => (a.id === animal.id ? fresh : a)));
            setSelectedAnimal(fresh);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Upgrade failed");
          }
        }}
        onFeed={async (animal) => {
          try {
            const res = await api.post(`/api/animals/${animal.id}/feed`);
            const fresh = { ...res.data.animal, _fetched_at_ms: Date.now() };
            setResources(res.data.resources);
            setAnimals((prev) => prev.map((a) => (a.id === animal.id ? fresh : a)));
            setSelectedAnimal(fresh);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Feed failed");
          }
        }}
        onFeedMax={async (animal, requestedUnits) => {
          try {
            const res = await api.post(`/api/animals/${animal.id}/feed-max`, { requestedUnits });
            const fresh = { ...res.data.animal, _fetched_at_ms: Date.now() };
            setResources(res.data.resources);
            setAnimals((prev) => prev.map((a) => (a.id === animal.id ? fresh : a)));
            setSelectedAnimal(fresh);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Feed max failed");
          }
        }}
        onCollect={async (animal) => {
          try {
            const res = await api.post(`/api/animals/${animal.id}/collect`);
            const fresh = { ...res.data.animal, _fetched_at_ms: Date.now() };
            setResources(res.data.resources);
            setAnimals((prev) => prev.map((a) => (a.id === animal.id ? fresh : a)));
            setSelectedAnimal(fresh);
            music.sfx("COLLECT");
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Collect failed");
          }
        }}
      />

      {/* Capacity upgrade confirmation modal */}
      <Modal
        visible={capUpgradeConfirm !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCapUpgradeConfirm(null)}
      >
        <View style={styles.capModalOverlay}>
          <View style={styles.capModalCard}>
            {capUpgradeConfirm &&
              (() => {
                const { resource, currentCap, cost, costRes1, costRes2 } =
                  capUpgradeConfirm;
                const meta = RESOURCE_META[resource];
                const meta1 = RESOURCE_META[costRes1];
                const meta2 = RESOURCE_META[costRes2];
                const canAfford =
                  resources[costRes1] >= cost && resources[costRes2] >= cost;
                return (
                  <>
                    <Text style={styles.capModalTitle}>
                      {t("upgradeCapacityTitle")}
                    </Text>
                    {/* Resource icon + cap change */}
                    <View style={styles.capModalResourceRow}>
                      <Image
                        source={meta.image}
                        style={styles.capModalResIcon}
                        resizeMode="contain"
                      />
                      <Text style={styles.capModalCapChange}>
                        {currentCap}
                        <Text style={styles.capModalArrow}> → </Text>
                        <Text style={styles.capModalNewCap}>
                          {currentCap + 2}
                        </Text>
                      </Text>
                    </View>
                    <Text style={styles.capModalInfo}>
                      {t("upgradeCapacityInfo")}
                    </Text>
                    {/* Cost row */}
                    <View style={styles.capModalCostRow}>
                      <View style={styles.capModalCostItem}>
                        <Image
                          source={meta1.image}
                          style={styles.capModalCostIcon}
                          resizeMode="contain"
                        />
                        <Text
                          style={[
                            styles.capModalCostText,
                            resources[costRes1] < cost &&
                              styles.capModalCostLow,
                          ]}
                        >
                          ×{cost}
                        </Text>
                      </View>
                      <Text style={styles.capModalPlus}>+</Text>
                      <View style={styles.capModalCostItem}>
                        <Image
                          source={meta2.image}
                          style={styles.capModalCostIcon}
                          resizeMode="contain"
                        />
                        <Text
                          style={[
                            styles.capModalCostText,
                            resources[costRes2] < cost &&
                              styles.capModalCostLow,
                          ]}
                        >
                          ×{cost}
                        </Text>
                      </View>
                    </View>
                    {/* Buttons */}
                    <View style={styles.capModalBtns}>
                      <TouchableOpacity
                        style={styles.capModalCancelBtn}
                        onPress={() => setCapUpgradeConfirm(null)}
                      >
                        <Text style={styles.capModalCancelText}>
                          {t("cancelBtn")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.capModalConfirmBtn,
                          !canAfford && styles.capModalConfirmDisabled,
                        ]}
                        activeOpacity={canAfford ? 0.75 : 1}
                        onPress={async () => {
                          if (!canAfford) return;
                          setCapUpgradeConfirm(null);
                          try {
                            const res = await api.post(
                              "/api/resources/upgrade-capacity",
                              { resource },
                            );
                            setResources(res.data);
                          } catch (err: any) {
                            alert(
                              err.response?.data?.error ??
                                "Kapasite artırılamadı",
                            );
                          }
                        }}
                      >
                        <Text style={styles.capModalConfirmText}>
                          {t("confirmUpgradeBtn")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                );
              })()}
          </View>
        </View>
      </Modal>

      {/* Advanced resource (egg/wool/milk) storage upgrade confirmation modal */}
      <Modal
        visible={advancedCapUpgradeConfirm !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAdvancedCapUpgradeConfirm(null)}
      >
        <View style={styles.capModalOverlay}>
          <View style={styles.capModalCard}>
            {advancedCapUpgradeConfirm &&
              (() => {
                const { resource, currentCap, cost1, cost2, costRes1, costRes2, emoji } =
                  advancedCapUpgradeConfirm;
                const meta1 = RESOURCE_META[costRes1];
                const meta2 = RESOURCE_META[costRes2];
                const canAfford =
                  resources[costRes1] >= cost1 && resources[costRes2] >= cost2;
                return (
                  <>
                    <Text style={styles.capModalTitle}>
                      {t("upgradeCapacityTitle")}
                    </Text>
                    {/* Resource emoji + cap change */}
                    <View style={styles.capModalResourceRow}>
                      <Text style={{ fontSize: 32 }}>{emoji}</Text>
                      <Text style={styles.capModalCapChange}>
                        {currentCap}
                        <Text style={styles.capModalArrow}> → </Text>
                        <Text style={styles.capModalNewCap}>
                          {currentCap + 2}
                        </Text>
                      </Text>
                    </View>
                    <Text style={styles.capModalInfo}>
                      {t("upgradeCapacityInfo")}
                    </Text>
                    {/* Cost row */}
                    <View style={styles.capModalCostRow}>
                      <View style={styles.capModalCostItem}>
                        <Image
                          source={meta1.image!}
                          style={styles.capModalCostIcon}
                          resizeMode="contain"
                        />
                        <Text
                          style={[
                            styles.capModalCostText,
                            resources[costRes1] < cost1 &&
                              styles.capModalCostLow,
                          ]}
                        >
                          ×{cost1}
                        </Text>
                      </View>
                      <Text style={styles.capModalPlus}>+</Text>
                      <View style={styles.capModalCostItem}>
                        <Image
                          source={meta2.image!}
                          style={styles.capModalCostIcon}
                          resizeMode="contain"
                        />
                        <Text
                          style={[
                            styles.capModalCostText,
                            resources[costRes2] < cost2 &&
                              styles.capModalCostLow,
                          ]}
                        >
                          ×{cost2}
                        </Text>
                      </View>
                    </View>
                    {/* Buttons */}
                    <View style={styles.capModalBtns}>
                      <TouchableOpacity
                        style={styles.capModalCancelBtn}
                        onPress={() => setAdvancedCapUpgradeConfirm(null)}
                      >
                        <Text style={styles.capModalCancelText}>
                          {t("cancelBtn")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.capModalConfirmBtn,
                          !canAfford && styles.capModalConfirmDisabled,
                        ]}
                        activeOpacity={canAfford ? 0.75 : 1}
                        onPress={async () => {
                          if (!canAfford) return;
                          setAdvancedCapUpgradeConfirm(null);
                          try {
                            const res = await api.post(
                              "/api/animals/upgrade-storage",
                              { resource },
                            );
                            setResources(res.data);
                          } catch (err: any) {
                            alert(
                              err.response?.data?.error ??
                                "Kapasite artırılamadı",
                            );
                          }
                        }}
                      >
                        <Text style={styles.capModalConfirmText}>
                          {t("confirmUpgradeBtn")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                );
              })()}
          </View>
        </View>
      </Modal>

      {/* Battle log modal */}
      <Modal
        visible={claimResult !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setClaimResult(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Result header */}
            <View
              style={[
                styles.modalHeader,
                claimResult?.winner === "champion"
                  ? styles.modalHeaderWin
                  : styles.modalHeaderLose,
              ]}
            >
              <Text style={styles.modalTitle}>
                {claimResult?.winner === "champion"
                  ? "⚔️ Zafer!"
                  : "💀 Yenilgi"}
              </Text>
              <View style={styles.modalRewardRow}>
                {claimResult?.rewardAmount && claimResult.rewardAmount > 0 ? (
                  <Text style={styles.modalReward}>
                    +{claimResult.rewardAmount} {claimResult.rewardResource}
                  </Text>
                ) : (
                  <Text style={styles.modalNoReward}>Ödül yok</Text>
                )}
                {(claimResult?.xpGained ?? 0) > 0 && (
                  <Text style={styles.modalXp}>
                    +{claimResult!.xpGained} XP
                  </Text>
                )}
              </View>
              {(claimResult?.levelsGained ?? 0) > 0 && (
                <View style={styles.levelUpBadge}>
                  <Text style={styles.levelUpText}>
                    ⬆️ SEVİYE ATLADI! LV {claimResult!.newLevel}
                  </Text>
                </View>
              )}
            </View>

            {/* Battle log */}
            <Text style={styles.logTitle}>Savaş Günlüğü</Text>
            <ScrollView
              style={styles.logScroll}
              showsVerticalScrollIndicator={false}
            >
              {(claimResult?.log ?? []).map((entry: any, i: number) => {
                const isChamp = entry.actor === "attacker";
                const atkHp = isChamp
                  ? entry.attackerHpAfter
                  : entry.defenderHpAfter;
                const defHp = isChamp
                  ? entry.defenderHpAfter
                  : entry.attackerHpAfter;
                const blocked = entry.damage === 0;
                const newRound =
                  i === 0 || claimResult?.log[i - 1]?.round !== entry.round;

                return (
                  <View key={i} style={styles.logRow}>
                    {newRound && (
                      <View style={styles.roundBadge}>
                        <Text style={styles.roundBadgeText}>
                          Tur {entry.round + 1}
                        </Text>
                      </View>
                    )}
                    <View
                      style={[
                        styles.logLine,
                        isChamp ? styles.logLineChamp : styles.logLineEnemy,
                      ]}
                    >
                      {/* Attacker */}
                      <View style={styles.logSide}>
                        <Text
                          style={[
                            styles.logSideName,
                            isChamp
                              ? styles.logActorChamp
                              : styles.logActorEnemy,
                          ]}
                        >
                          {isChamp ? "⚔️" : "👹"}{" "}
                          {isChamp ? "Şampiyon" : "Düşman"}
                        </Text>
                        <Text style={styles.logSideHp}>{atkHp} HP</Text>
                        <View style={styles.logSideStatRow}>
                          <Text style={styles.logAtkVal}>
                            ATK {entry.attackValue}
                          </Text>
                          {entry.atkBoosted && (
                            <Text style={styles.logCritBadge}>KRİT</Text>
                          )}
                        </View>
                      </View>

                      {/* Center */}
                      <View style={styles.logCenter}>
                        <Text style={styles.logArrow}>→</Text>
                        <View
                          style={[
                            styles.logDmgPill,
                            blocked
                              ? styles.logDmgPillBlock
                              : styles.logDmgPillHit,
                          ]}
                        >
                          <Text
                            style={[
                              styles.logDmgText,
                              blocked
                                ? styles.logDmgTextBlock
                                : styles.logDmgTextHit,
                            ]}
                          >
                            {blocked ? "BLOK" : `−${entry.damage}`}
                          </Text>
                        </View>
                      </View>

                      {/* Defender */}
                      <View style={[styles.logSide, styles.logSideRight]}>
                        <Text
                          style={[
                            styles.logSideName,
                            isChamp
                              ? styles.logActorEnemy
                              : styles.logActorChamp,
                          ]}
                        >
                          {isChamp ? "👹" : "⚔️"}{" "}
                          {isChamp ? "Düşman" : "Şampiyon"}
                        </Text>
                        <Text
                          style={[
                            styles.logSideHp,
                            !blocked && styles.logSideHpDamaged,
                          ]}
                        >
                          {defHp} HP
                        </Text>
                        <View
                          style={[
                            styles.logSideStatRow,
                            styles.logSideStatRight,
                          ]}
                        >
                          {entry.defBoosted && (
                            <Text style={styles.logBlockBadge}>BLOK</Text>
                          )}
                          <Text style={styles.logDefVal}>
                            DEF {entry.defenseValue}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => setClaimResult(null)}
            >
              <Text style={styles.modalBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PvP Result modal */}
      <Modal
        visible={pvpResult !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPvpResult(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {pvpResult && (() => {
              const won = pvpResult.winner_id === pvpResult.attacker_id;
              const trophyDelta = pvpResult.attacker_trophies_delta;
              return (
                <>
                  <View style={[styles.modalHeader, won ? styles.modalHeaderWin : styles.modalHeaderLose]}>
                    <Text style={styles.modalTitle}>{won ? "⚔️ Zafer!" : "💀 Yenilgi"}</Text>
                    <View style={styles.modalRewardRow}>
                      <Text style={won ? styles.modalReward : styles.modalNoReward}>
                        {trophyDelta >= 0 ? "+" : ""}{trophyDelta} 🏆
                      </Text>
                      <Text style={styles.modalXp}>vs {pvpResult.defender_name}</Text>
                    </View>
                  </View>
                  <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
                    {(["strawberry", "pinecone", "blueberry"] as const).map((r) => {
                      const amt = (pvpResult as any)[`transferred_${r}`] ?? 0;
                      if (amt === 0) return null;
                      const meta = RESOURCE_META[r];
                      return (
                        <View key={r} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          {meta.image ? <Image source={meta.image} style={{ width: 22, height: 22 }} resizeMode="contain" /> : null}
                          <Text style={[styles.modalReward, { color: won ? "#4a7c3f" : "#c0392b" }]}>
                            {won ? "+" : "-"}{amt}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  {/* Battle log */}
                  {(pvpResult.combat_log?.length ?? 0) > 0 && (
                    <ScrollView
                      style={styles.pvpLogScroll}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled
                    >
                      {pvpResult.combat_log.map((entry: any, i: number) => {
                        const isAtk = entry.actor === "attacker";
                        const newRound = i === 0 || pvpResult.combat_log[i - 1]?.round !== entry.round;
                        return (
                          <View key={i}>
                            {newRound && (
                              <Text style={styles.pvpLogRound}>— Tur {entry.round + 1} —</Text>
                            )}
                            <View style={styles.pvpLogRow}>
                              <Text style={[styles.pvpLogActor, isAtk ? styles.pvpLogChamp : styles.pvpLogEnemy]}>
                                {isAtk ? `⚔️ ${pvpResult.attacker_champion_name}` : `🛡️ ${pvpResult.defender_champion_name}`}
                              </Text>
                              <Text style={styles.pvpLogDmg}>
                                {entry.damage === 0 ? "BLOK" : `−${entry.damage}`}
                                {entry.isCrit ? " 💥" : ""}
                              </Text>
                              <Text style={styles.pvpLogHp}>
                                {isAtk ? entry.defenderHpAfter : entry.attackerHpAfter} HP
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                  )}
                  <TouchableOpacity style={styles.modalBtn} onPress={() => setPvpResult(null)}>
                    <Text style={styles.modalBtnText}>Kapat</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </ImageBackground>
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
    gap: 6,
  },
  playerName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  trophyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  trophyCount: {
    color: "#ffd54f",
    fontSize: 12,
    fontWeight: "800",
  },
  settingsBtn: {
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
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
  cardsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 6,
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
    gap: 4,
  },
  tabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "rgba(245,237,216,0.75)",
    borderWidth: 1.5,
    borderColor: "#d4b896",
  },
  tabBtnActive: {
    backgroundColor: "rgba(245,237,216,0.97)",
    borderColor: "#9a7040",
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7a5030",
  },
  tabBtnTextActive: {
    color: "#3a1e00",
    fontWeight: "900",
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#f5edd8",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: "#d4b896",
    maxHeight: "80%",
    paddingBottom: 32,
  },
  modalHeader: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    marginBottom: 4,
  },
  modalHeaderWin: {
    backgroundColor: "#c8e6c9",
  },
  modalHeaderLose: {
    backgroundColor: "#ffcdd2",
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#3a2a10",
    marginBottom: 4,
  },
  modalRewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  modalReward: {
    fontSize: 18,
    fontWeight: "800",
    color: "#4a7c3f",
  },
  modalNoReward: {
    fontSize: 14,
    color: "#c0392b",
  },
  modalXp: {
    fontSize: 16,
    fontWeight: "800",
    color: "#b8860b",
  },
  levelUpBadge: {
    marginTop: 8,
    backgroundColor: "#3a1e00",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  levelUpText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f5c842",
    letterSpacing: 0.5,
  },
  logTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9a7040",
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  logScroll: {
    maxHeight: 340,
    paddingHorizontal: 16,
  },
  logRow: {
    marginBottom: 6,
  },
  roundBadge: {
    alignSelf: "center",
    backgroundColor: "#ede0c4",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 3,
    marginBottom: 5,
    marginTop: 8,
  },
  roundBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9a7040",
    letterSpacing: 0.8,
  },
  logLine: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1.5,
  },
  logLineChamp: {
    backgroundColor: "#f0faf0",
    borderColor: "#b2d8b2",
  },
  logLineEnemy: {
    backgroundColor: "#fdf0f0",
    borderColor: "#e0b8b8",
  },
  logSide: {
    flex: 1,
    gap: 2,
  },
  logSideRight: {
    alignItems: "flex-end",
  },
  logSideName: {
    fontSize: 12,
    fontWeight: "800",
  },
  logActorChamp: {
    color: "#2d6e24",
  },
  logActorEnemy: {
    color: "#a02020",
  },
  logSideHp: {
    fontSize: 12,
    fontWeight: "700",
    color: "#555",
  },
  logSideHpDamaged: {
    color: "#c0392b",
  },
  logSideStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  logSideStatRight: {
    justifyContent: "flex-end",
  },
  logAtkVal: {
    fontSize: 11,
    fontWeight: "600",
    color: "#888",
  },
  logDefVal: {
    fontSize: 11,
    fontWeight: "600",
    color: "#888",
  },
  logCritBadge: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
    backgroundColor: "#e67e22",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  logBlockBadge: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
    backgroundColor: "#2980b9",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  logCenter: {
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 4,
  },
  logArrow: {
    fontSize: 16,
    color: "#aaa",
  },
  logDmgPill: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  logDmgPillHit: {
    backgroundColor: "#c0392b",
  },
  logDmgPillBlock: {
    backgroundColor: "#bbb",
  },
  logDmgText: {
    fontSize: 12,
    fontWeight: "800",
  },
  logDmgTextHit: {
    color: "#fff",
  },
  logDmgTextBlock: {
    color: "#fff",
  },
  modalBtn: {
    backgroundColor: "#4a7c3f",
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },

  // Capacity upgrade modal
  capModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  capModalCard: {
    backgroundColor: "#f5edd8",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#d4b896",
    marginHorizontal: 32,
    padding: 24,
    alignItems: "center",
  },
  capModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#3a2a10",
    marginBottom: 16,
    textAlign: "center",
  },
  capModalResourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  capModalResIcon: {
    width: 36,
    height: 36,
  },
  capModalCapChange: {
    fontSize: 22,
    fontWeight: "800",
    color: "#3a2a10",
  },
  capModalArrow: {
    color: "#9a7040",
    fontSize: 20,
  },
  capModalNewCap: {
    color: "#4a7c3f",
    fontSize: 22,
  },
  capModalInfo: {
    fontSize: 12,
    color: "#9a7040",
    marginBottom: 16,
  },
  capModalCostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ede0c4",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  capModalCostItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  capModalCostIcon: {
    width: 24,
    height: 24,
  },
  capModalCostText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#3a2a10",
  },
  capModalCostLow: {
    color: "#c0392b",
  },
  capModalPlus: {
    fontSize: 16,
    fontWeight: "700",
    color: "#9a7040",
  },
  capModalBtns: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  capModalCancelBtn: {
    flex: 1,
    backgroundColor: "#ede0c4",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#d4b896",
  },
  capModalCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6a4010",
  },
  capModalConfirmBtn: {
    flex: 1,
    backgroundColor: "#4a7c3f",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  capModalConfirmDisabled: {
    backgroundColor: "#9ab89a",
  },
  capModalConfirmText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
});
