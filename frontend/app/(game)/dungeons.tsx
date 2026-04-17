import { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/StyledText";
import {
  ChevronLeft,
  Swords,
  Shield,
  Zap,
  HeartPulse,
  Star,
} from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import api from "../../lib/api";
import { queryKeys } from "../../lib/query/queryKeys";
import { useDungeonRunsQuery, usePlayerQuery } from "../../lib/query/queries";
import { useSkipMissionMutation } from "../../lib/query/mutations";
import { useCoinConfirm } from "../../lib/coin-confirm-context";
import InGameCoinConfirmModal from "../../components/InGameCoinConfirmModal";
import { useLanguage } from "../../lib/i18n";
import {
  Dungeon,
  DungeonRun,
  HarvestDungeon,
  AdventureDungeon,
  EventDungeon,
  AdventureProgress,
  HarvestCooldown,
  AdventureMilestone,
  ClaimResult,
} from "../../types";
import DungeonCard from "../../components/DungeonCard";
import AdventureTab from "../../components/dungeon/AdventureTab";
import { CLASS_META, RESOURCE_META } from "../../constants/resources";
import CustomModal from "../../components/CustomModal";
import BattleHistoryDrawer from "../../components/BattleHistoryDrawer";
import CountdownTimer from "../../components/CountdownTimer";

const DUNGEON_BG = require("../../assets/dungeon/dungeon-screen-bg.webp");
const CHAMP_CARD_BG = require("../../assets/dungeon/dungeon-champion-card-bg.webp");
const DUNGEON_TAB_IMG = require("../../assets/icons/icon-dungeon.webp");
const COIN_IMG = require("../../assets/icons/icon-coin.webp");

type TabKey = "harvest" | "adventure" | "event";

export default function DungeonsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const {
    championId,
    championName,
    championClass,
    championAttack,
    championDefense,
    championChance,
    championBoostDefense,
    championBoostChance,
    championCurrentHp,
    championMaxHp,
    championBoostHp,
  } = useLocalSearchParams<{
    championId: string;
    championName: string;
    championClass: string;
    championAttack: string;
    championDefense: string;
    championChance: string;
    championBoostDefense: string;
    championBoostChance: string;
    championCurrentHp: string;
    championMaxHp: string;
    championBoostHp: string;
  }>();

  const { data: runs = [] } = useDungeonRunsQuery();
  const { data: player } = usePlayerQuery();
  const coins = (player as any)?.coins ?? 0;
  const skipMissionMut = useSkipMissionMutation();
  const { triggerCoinConfirm } = useCoinConfirm();

  const [activeTab, setActiveTab] = useState<TabKey>("adventure");
  const [harvestDungeons, setHarvestDungeons] = useState<HarvestDungeon[]>([]);
  const [adventureDungeons, setAdventureDungeons] = useState<AdventureDungeon[]>([]);
  const [eventDungeons, setEventDungeons] = useState<EventDungeon[]>([]);
  const [adventureProgress, setAdventureProgress] = useState<AdventureProgress[]>([]);
  const [harvestCooldowns, setHarvestCooldowns] = useState<HarvestCooldown[]>([]);
  const [milestones, setMilestones] = useState<AdventureMilestone[]>([]);
  const [totalStars, setTotalStars] = useState(0);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [claimingRun, setClaimingRun] = useState<{ name: string; class: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    try {
      const [dungeonsRes, progressRes, cooldownRes, milestoneRes] =
        await Promise.all([
          api.get("/api/dungeons"),
          api.get("/api/dungeons/adventure/progress"),
          api.get("/api/dungeons/harvest/cooldowns"),
          api.get("/api/dungeons/milestones"),
        ]);

      const all: Dungeon[] = dungeonsRes.data;
      setHarvestDungeons(
        all.filter((d) => d.dungeon_type === "harvest") as HarvestDungeon[]
      );
      setAdventureDungeons(
        (all.filter((d) => d.dungeon_type === "adventure") as AdventureDungeon[]).sort(
          (a, b) => (a.stage_number ?? 0) - (b.stage_number ?? 0)
        )
      );
      setEventDungeons(
        all.filter((d) => d.dungeon_type === "event") as EventDungeon[]
      );

      setAdventureProgress(progressRes.data);
      setHarvestCooldowns(cooldownRes.data);
      setMilestones(milestoneRes.data.milestones ?? []);
      setTotalStars(milestoneRes.data.total_stars ?? 0);
    } catch {
      // silent
    }
  }

  function getRunForDungeon(dungeonId: string): DungeonRun | undefined {
    // Prefer the selected champion's run so the countdown matches ChampionDrawer.
    // Stale active runs from other champions are used as a fallback.
    return (
      runs.find((r) => r.dungeon_id === dungeonId && r.champion_id === championId && r.status === "active") ??
      runs.find((r) => r.dungeon_id === dungeonId && r.status === "active")
    );
  }

  function getHarvestCooldown(dungeonId: string): HarvestCooldown | undefined {
    return harvestCooldowns.find((c) => c.dungeon_id === dungeonId);
  }

  async function handleEnter(dungeon: Dungeon) {
    if (!championId) {
      Alert.alert("No champion selected");
      return;
    }
    try {
      const res = await api.post(`/api/dungeons/${dungeon.id}/enter`, {
        champion_id: championId,
      });
      // Immediately put the new run in the cache so that when loadData() triggers
      // a re-render with fresh cooldown data, getRunForDungeon already finds it.
      // Without this, there's a flicker: cooldown block shows briefly before the
      // background dungeonRuns refetch returns.
      queryClient.setQueryData<DungeonRun[]>(queryKeys.dungeonRuns(), (old) => [
        ...(old ?? []),
        res.data,
      ]);
      await loadData();
      queryClient.invalidateQueries({ queryKey: queryKeys.dungeonRuns() });
    } catch (err: any) {
      Alert.alert(err.response?.data?.error || "Failed to enter dungeon");
    }
  }

  async function handleClaim(run: DungeonRun) {
    setClaimingRun({ name: run.champion_name, class: run.champion_class ?? "Warrior" });
    try {
      const res = await api.post(`/api/dungeons/runs/${run.id}/claim`);
      await loadData();
      setClaimResult(res.data);
      queryClient.invalidateQueries({ queryKey: queryKeys.dungeonRuns() });
      queryClient.invalidateQueries({ queryKey: queryKeys.resources() });
      queryClient.invalidateQueries({ queryKey: queryKeys.champions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.gearInventory() });
    } catch (err: any) {
      Alert.alert(err.response?.data?.error || "Failed to claim reward");
    }
  }

  function handleSkipMission(run: DungeonRun) {
    const secsLeft = Math.max(0, Math.ceil((new Date(run.ends_at).getTime() - Date.now()) / 1000));
    const cost = Math.max(1, Math.ceil(secsLeft / 60));
    triggerCoinConfirm({
      transactionCost: cost,
      transactionTitle: t("skipMissionNow"),
      transactionDesc: t("skipMissionNow"),
      onConfirm: async () => {
        try {
          const data = await skipMissionMut.mutateAsync(run.id);
          queryClient.setQueryData<DungeonRun[]>(queryKeys.dungeonRuns(), (old) =>
            (old ?? []).map((r) =>
              r.id === run.id ? { ...r, ends_at: data.ends_at } : r
            )
          );
        } catch (err: any) {
          Alert.alert(err.response?.data?.error ?? "Skip başarısız");
        }
      },
    });
  }

  async function handleMilestoneClaim(requiredStars: number) {
    try {
      await api.post(`/api/dungeons/milestones/${requiredStars}/claim`);
      await loadData();
      Alert.alert("Milestone claimed!");
    } catch (err: any) {
      Alert.alert(err.response?.data?.error || "Failed to claim milestone");
    }
  }

  const championIsBusy = runs.some(
    (r) => r.champion_id === championId && r.status === "active"
  );

  const classMeta = CLASS_META[championClass ?? ""] ?? { image: null, color: "#888" };
  const atk = parseInt(championAttack ?? "0");
  const def =
    parseInt(championDefense ?? "0") + parseInt(championBoostDefense ?? "0");
  const chc =
    parseInt(championChance ?? "0") + parseInt(championBoostChance ?? "0");
  const boostDef = parseInt(championBoostDefense ?? "0");
  const boostChc = parseInt(championBoostChance ?? "0");
  const currentHp = parseInt(championCurrentHp ?? "0");
  const maxHp = parseInt(championMaxHp ?? "0");
  const boostHp = parseInt(championBoostHp ?? "0");
  const effectiveMaxHp = maxHp + boostHp;
  const hpPct = effectiveMaxHp > 0 ? currentHp / effectiveMaxHp : 0;
  const hpColor =
    hpPct > 0.6 ? "#4caf50" : hpPct > 0.3 ? "#f39c12" : "#e57373";

  // Compute harvest cooldown info for each dungeon
  function getHarvestCardProps(dungeon: HarvestDungeon) {
    const cooldown = getHarvestCooldown(dungeon.id);
    let isOnCooldown = false;
    let remainingCooldownSeconds: number | undefined;
    let runsToday: number | undefined;

    if (cooldown) {
      if (dungeon.cooldown_minutes) {
        const cooldownMs = dungeon.cooldown_minutes * 60 * 1000;
        const elapsed = Date.now() - new Date(cooldown.last_run_at).getTime();
        if (elapsed < cooldownMs) {
          isOnCooldown = true;
          remainingCooldownSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
        }
      }
      const today = new Date().toISOString().slice(0, 10);
      const rowDate = String(cooldown.day_reset_at).slice(0, 10);
      if (rowDate === today) {
        runsToday = cooldown.runs_today;
      } else {
        runsToday = 0;
      }
    }
    return { isOnCooldown, remainingCooldownSeconds, runsToday };
  }

  return (
    <ImageBackground
      source={DUNGEON_BG}
      style={styles.dungeonBg}
      resizeMode="stretch"
    >
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={26} color="#b0c4de" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.title}>{t("dungeons")}</Text>
          <View style={styles.backBtn} />
        </View>

        {/* Sticky champion strip */}
        {championName ? (
          <ImageBackground
            source={CHAMP_CARD_BG}
            style={styles.champCardBg}
            resizeMode="stretch"
          >
            <View style={styles.champCardContent}>
              {classMeta.image && (
                <Image
                  source={classMeta.image}
                  style={styles.champImage}
                  resizeMode="contain"
                />
              )}
              <View style={styles.champRight}>
                <View style={styles.champNameRow}>
                  <Text style={styles.champName}>{championName}</Text>
                  <Text style={[styles.champClass, { color: classMeta.color }]}>
                    {championClass?.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.champHpRow}>
                  <HeartPulse size={11} color={hpColor} strokeWidth={2.5} />
                  <View style={styles.champHpTrack}>
                    <View
                      style={[
                        styles.champHpFill,
                        {
                          width: `${Math.round(hpPct * 100)}%` as any,
                          backgroundColor: hpColor,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.champHpVal, { color: hpColor }]}>
                    {currentHp}/{effectiveMaxHp}
                    {boostHp > 0 && (
                      <Text style={styles.champStatBoosted}> +{boostHp}</Text>
                    )}
                  </Text>
                </View>
                <View style={styles.champStats}>
                  <View style={styles.champStatPill}>
                    <Swords size={10} color="#e57373" strokeWidth={2.5} />
                    <Text style={styles.champStatLabel}>ATK</Text>
                    <Text style={styles.champStatVal}>{atk}</Text>
                  </View>
                  <View style={styles.champStatPill}>
                    <Shield size={10} color="#90a4ae" strokeWidth={2.5} />
                    <Text style={styles.champStatLabel}>DEF</Text>
                    <Text
                      style={[
                        styles.champStatVal,
                        boostDef > 0 && styles.champStatBoosted,
                      ]}
                    >
                      {def}
                    </Text>
                  </View>
                  <View style={styles.champStatPill}>
                    <Zap size={10} color="#ce93d8" strokeWidth={2.5} />
                    <Text style={styles.champStatLabel}>CHC</Text>
                    <Text
                      style={[
                        styles.champStatVal,
                        boostChc > 0 && styles.champStatBoosted,
                      ]}
                    >
                      {chc}%
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </ImageBackground>
        ) : null}

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {(["adventure", "harvest", "event"] as TabKey[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabPill, activeTab === tab && styles.tabPillActive]}
              onPress={() => setActiveTab(tab)}
            >
              {tab === "adventure" ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Image
                    source={DUNGEON_TAB_IMG}
                    style={{ width: 16, height: 16 }}
                    resizeMode="contain"
                  />
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                    {t("adventureTab")}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === "harvest" ? `🌾 ${t("harvestTab")}` : `✨ ${t("eventsTab")}`}
                </Text>
              )}
              {tab === "event" && eventDungeons.length > 0 && (
                <View style={styles.eventDot} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {activeTab === "harvest" && (
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {harvestDungeons.length === 0 ? (
              <Text style={styles.empty}>{t("noDungeons")}</Text>
            ) : (
              harvestDungeons.map((dungeon) => {
                const run = getRunForDungeon(dungeon.id);
                const { isOnCooldown, remainingCooldownSeconds, runsToday } =
                  getHarvestCardProps(dungeon);
                const enterDisabled =
                  championIsBusy && (!run || run.champion_id !== championId);
                return (
                  <DungeonCard
                    key={dungeon.id}
                    dungeon={dungeon}
                    activeRun={run}
                    onEnter={handleEnter}
                    onClaim={handleClaim}
                    disabled={enterDisabled || isOnCooldown}
                    isOnCooldown={isOnCooldown}
                    remainingCooldownSeconds={remainingCooldownSeconds}
                    runsToday={runsToday}
                    dailyRunLimit={dungeon.daily_run_limit}
                    rewardResource2={dungeon.reward_resource_2}
                    rewardAmount2={dungeon.reward_amount_2}
                    coins={coins}
                    onSkipMission={handleSkipMission}
                  />
                );
              })
            )}
          </ScrollView>
        )}

        {activeTab === "adventure" && (
          <AdventureTab
            dungeons={adventureDungeons}
            progress={adventureProgress}
            milestones={milestones}
            totalStars={totalStars}
            runs={runs}
            championId={championId}
            championClass={championClass}
            championIsBusy={championIsBusy}
            onEnter={handleEnter}
            onClaim={handleClaim}
            onMilestoneClaim={handleMilestoneClaim}
          />
        )}

        {activeTab === "event" && (
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {eventDungeons.length === 0 ? (
              <View style={styles.emptyEvents}>
                <Text style={styles.emptyEventsText}>{t("noActiveEvents")}</Text>
              </View>
            ) : (
              eventDungeons.map((dungeon) => {
                const run = getRunForDungeon(dungeon.id);
                const enterDisabled =
                  championIsBusy && (!run || run.champion_id !== championId);
                return (
                  <View key={dungeon.id}>
                    {dungeon.event_ends_at && (
                      <View style={styles.eventTimerRow}>
                        <Text style={styles.eventTimerLabel}>
                          {t("eventEndsIn")}:{" "}
                        </Text>
                        <CountdownTimer
                          endsAt={dungeon.event_ends_at}
                          style={styles.eventTimerText}
                          onExpire={loadData}
                        />
                        {(dungeon.reward_multiplier ?? 1) > 1 && (
                          <View style={styles.multiplierBadge}>
                            <Text style={styles.multiplierText}>
                              {dungeon.reward_multiplier}x REWARDS
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    <DungeonCard
                      dungeon={dungeon}
                      activeRun={run}
                      onEnter={handleEnter}
                      onClaim={handleClaim}
                      disabled={enterDisabled}
                    />
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        <InGameCoinConfirmModal coins={coins} />

        <BattleHistoryDrawer
          visible={claimResult !== null}
          onClose={() => { setClaimResult(null); setClaimingRun(null); }}
          mode="pve"
          result={claimResult!}
          championName={claimingRun?.name ?? ""}
          championClass={claimingRun?.class ?? "Warrior"}
        />
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  dungeonBg: {
    width: "100%",
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
  },
  title: {
    color: "#ecf0f1",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  champCardBg: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  champCardContent: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 40,
    paddingTop: 22,
    paddingBottom: 22,
    gap: 12,
  },
  champImage: {
    width: 64,
    height: 64,
  },
  champRight: {
    flex: 1,
    gap: 6,
  },
  champNameRow: {
    gap: 2,
  },
  champName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#3a2a10",
  },
  champClass: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  champHpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  champHpTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 3,
    overflow: "hidden",
  },
  champHpFill: {
    height: "100%",
    borderRadius: 3,
  },
  champHpVal: {
    fontSize: 10,
    fontWeight: "700",
    minWidth: 48,
    textAlign: "right",
  },
  champStats: {
    flexDirection: "row",
    gap: 5,
  },
  champStatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  champStatLabel: {
    fontSize: 8,
    fontWeight: "700",
    color: "rgba(58,42,16,0.7)",
    letterSpacing: 0.5,
  },
  champStatVal: {
    fontSize: 12,
    fontWeight: "800",
    color: "#3a2a10",
  },
  champStatBoosted: {
    color: "#7a30c0",
  },
  // Tab bar
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  tabPillActive: {
    backgroundColor: "#f5e9cc",
  },
  tabText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 0.3,
  },
  tabTextActive: {
    color: "#3a2a10",
  },
  eventDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#e67e22",
    marginLeft: -2,
  },
  // Dungeon list
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  empty: {
    color: "#7f8c9a",
    textAlign: "center",
    marginTop: 60,
    fontSize: 15,
  },
  // Event tab
  emptyEvents: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 80,
    paddingHorizontal: 32,
  },
  emptyEventsText: {
    color: "#b0c4de",
    fontSize: 15,
    textAlign: "center",
    fontWeight: "600",
    lineHeight: 22,
  },
  eventTimerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  eventTimerLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b0c4de",
  },
  eventTimerText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#81c784",
  },
  multiplierBadge: {
    backgroundColor: "#e67e22",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  multiplierText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
  },
  // Claim modal
  resultBody: {
    alignItems: "center",
    gap: 8,
    paddingBottom: 4,
  },
  starsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  resultRewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resultReward: {
    fontSize: 20,
    fontWeight: "800",
    color: "#4a7c3f",
  },
  resultCoinRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resultCoinImg: {
    width: 22,
    height: 22,
  },
  resultCoin: {
    fontSize: 18,
    fontWeight: "800",
    color: "#c8900a",
  },
  resultNoReward: {
    fontSize: 14,
    color: "#c0392b",
    fontWeight: "600",
  },
  resultXp: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4a7c3f",
    marginTop: 4,
  },
  resultLevelUp: {
    fontSize: 14,
    fontWeight: "800",
    color: "#d4a017",
    marginTop: 4,
  },
  logScroll: {
    maxHeight: 260,
    marginTop: 10,
    width: "100%",
  },
  logEntryWrapper: {
    marginBottom: 2,
  },
  roundBadge: {
    alignSelf: "center",
    backgroundColor: "#ede0c4",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginVertical: 4,
  },
  roundBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7a5030",
    letterSpacing: 0.8,
  },
  logLine: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
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
    gap: 3,
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
    backgroundColor: "#5d7f8a",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  logCenter: {
    alignItems: "center",
    gap: 3,
    minWidth: 52,
  },
  logArrow: {
    fontSize: 14,
    color: "#aaa",
  },
  logDmgPill: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  logDmgPillHit: {
    backgroundColor: "#c0392b",
  },
  logDmgPillBlock: {
    backgroundColor: "#5d7f8a",
  },
  logDmgText: {
    fontSize: 13,
    fontWeight: "800",
  },
  logDmgTextHit: {
    color: "#fff",
  },
  logDmgTextBlock: {
    color: "#fff",
  },
});
