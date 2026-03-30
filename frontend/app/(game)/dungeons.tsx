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
  Trophy,
  HeartPulse,
} from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../lib/api";
import { useLanguage } from "../../lib/i18n";
import { Dungeon, DungeonRun } from "../../types";
import DungeonCard from "../../components/DungeonCard";
import { CLASS_META } from "../../constants/resources";
import CustomModal from "../../components/CustomModal";

const DUNGEON_BG = require("../../assets/dungeon-screen-bg.png");
const CHAMP_CARD_BG = require("../../assets/dungeon/dungeon-champion-card-bg.png");

export default function DungeonsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
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

  const [dungeons, setDungeons] = useState<Dungeon[]>([]);
  const [runs, setRuns] = useState<DungeonRun[]>([]);
  const [claimResult, setClaimResult] = useState<{
    winner: "champion" | "enemy";
    rewardResource: string;
    rewardAmount: number;
    log: any[];
    xpGained: number;
    levelsGained: number;
    newLevel: number;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  async function loadData() {
    try {
      const [dungeonsRes, runsRes] = await Promise.all([
        api.get("/api/dungeons"),
        api.get("/api/dungeons/runs"),
      ]);
      setDungeons(dungeonsRes.data);
      setRuns(runsRes.data);
    } catch {
      // silent
    }
  }

  function getRunForDungeon(dungeonId: string): DungeonRun | undefined {
    return runs.find(
      (r) => r.dungeon_id === dungeonId && r.status === "active",
    );
  }

  async function handleEnter(dungeon: Dungeon) {
    if (!championId) {
      Alert.alert("No champion selected");
      return;
    }
    try {
      await api.post(`/api/dungeons/${dungeon.id}/enter`, {
        champion_id: championId,
      });
      await loadData();
    } catch (err: any) {
      Alert.alert(err.response?.data?.error || "Failed to enter dungeon");
    }
  }

  async function handleClaim(run: DungeonRun) {
    try {
      const res = await api.post(`/api/dungeons/runs/${run.id}/claim`);
      await loadData();
      setClaimResult(res.data);
    } catch (err: any) {
      Alert.alert(err.response?.data?.error || "Failed to claim reward");
    }
  }

  const championIsBusy = runs.some(
    (r) => r.champion_id === championId && r.status === "active",
  );

  const classMeta = CLASS_META[championClass ?? ""] ?? {
    image: null,
    color: "#888",
  };
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
  const hpColor = hpPct > 0.6 ? "#4caf50" : hpPct > 0.3 ? "#f39c12" : "#e57373";

  return (
    <ImageBackground
      source={DUNGEON_BG}
      style={styles.dungeonBg}
      resizeMode="stretch"
    >
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
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
              {/* Champion image — left */}
              {classMeta.image && (
                <Image
                  source={classMeta.image}
                  style={styles.champImage}
                  resizeMode="contain"
                />
              )}

              {/* Info — right */}
              <View style={styles.champRight}>
                {/* Name + class */}
                <View style={styles.champNameRow}>
                  <Text style={styles.champName}>{championName}</Text>
                  <Text style={[styles.champClass, { color: classMeta.color }]}>
                    {championClass?.toUpperCase()}
                  </Text>
                </View>

                {/* HP bar */}
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

                {/* Stat pills */}
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

        {/* Dungeon list */}
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {dungeons.length === 0 ? (
            <Text style={styles.empty}>{t("noDungeons")}</Text>
          ) : (
            dungeons.map((dungeon) => {
              const run = getRunForDungeon(dungeon.id);
              const enterDisabled =
                championIsBusy && (!run || run.champion_id !== championId);
              return (
                <DungeonCard
                  key={dungeon.id}
                  dungeon={dungeon}
                  activeRun={run}
                  onEnter={handleEnter}
                  onClaim={handleClaim}
                  disabled={enterDisabled}
                />
              );
            })
          )}
        </ScrollView>

        {/* Claim result modal */}
        <CustomModal
          visible={claimResult !== null}
          onClose={() => setClaimResult(null)}
          onConfirm={() => setClaimResult(null)}
          title={
            claimResult?.winner === "champion" ? t("victory") : t("defeat")
          }
          confirmText="OK"
          cancelText={t("cancelBtn")}
        >
          <View style={styles.resultBody}>
            {claimResult?.rewardAmount && claimResult.rewardAmount > 0 ? (
              <View style={styles.resultRewardRow}>
                <Trophy
                  size={18}
                  color="#ffd54f"
                  strokeWidth={2}
                  fill="#ffd54f"
                />
                <Text style={styles.resultReward}>
                  +{claimResult.rewardAmount} {claimResult.rewardResource}
                </Text>
              </View>
            ) : (
              <Text style={styles.resultNoReward}>Bu sefer ödül yok</Text>
            )}
            {(claimResult?.xpGained ?? 0) > 0 && (
              <Text style={styles.resultXp}>+{claimResult!.xpGained} XP</Text>
            )}
            {(claimResult?.levelsGained ?? 0) > 0 && (
              <Text style={styles.resultLevelUp}>
                ⬆️ SEVİYE ATLADI! LV {claimResult!.newLevel}
              </Text>
            )}
            {/* Battle log */}
            {(claimResult?.log?.length ?? 0) > 0 && (
              <ScrollView
                style={styles.logScroll}
                showsVerticalScrollIndicator={false}
              >
                {claimResult!.log.map((entry: any, i: number) => {
                  const isChamp = entry.actor === "attacker";
                  const newRound =
                    i === 0 || claimResult!.log[i - 1]?.round !== entry.round;
                  return (
                    <View key={i}>
                      {newRound && (
                        <Text style={styles.logRound}>
                          — Tur {entry.round + 1} —
                        </Text>
                      )}
                      <View style={styles.logRow}>
                        <Text
                          style={[
                            styles.logActor,
                            isChamp ? styles.logChamp : styles.logEnemy,
                          ]}
                        >
                          {isChamp ? "⚔️ Şampiyon" : "👹 Düşman"}
                        </Text>
                        <Text style={styles.logDmg}>
                          {entry.damage === 0 ? "BLOK" : `−${entry.damage}`}
                          {entry.atkBoosted ? " 💥" : ""}
                        </Text>
                        <Text style={styles.logHp}>
                          {isChamp
                            ? entry.defenderHpAfter
                            : entry.attackerHpAfter}{" "}
                          HP
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </CustomModal>
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
    marginBottom: 12,
  },
  champCardContent: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 40,
    paddingTop: 26,
    paddingBottom: 26,
    gap: 12,
  },
  champImage: {
    width: 72,
    height: 72,
  },
  champRight: {
    flex: 1,
    gap: 7,
  },
  champNameRow: {
    gap: 2,
  },
  champName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#3a2a10",
    textShadowColor: "rgba(255,255,255,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
  resultBody: {
    alignItems: "center",
    gap: 8,
    paddingBottom: 4,
  },
  resultSub: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7a5a30",
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
    maxHeight: 180,
    marginTop: 10,
    width: "100%",
  },
  logRound: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9a7040",
    textAlign: "center",
    marginVertical: 4,
    letterSpacing: 1,
  },
  logRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: "#f0e4c8",
    borderRadius: 6,
    marginBottom: 2,
  },
  logActor: {
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  logChamp: {
    color: "#2d5a24",
  },
  logEnemy: {
    color: "#c0392b",
  },
  logDmg: {
    fontSize: 12,
    fontWeight: "800",
    color: "#3a2a10",
    minWidth: 50,
    textAlign: "center",
  },
  logHp: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7a5a30",
    minWidth: 45,
    textAlign: "right",
  },
});
