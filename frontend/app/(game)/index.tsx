import { useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  SafeAreaView,
  Animated,
  useWindowDimensions,
  Modal,
  ScrollView,
} from "react-native";
import { Text } from "../../components/StyledText";
import { Leaf, Settings, AlertTriangle, Sprout, Swords } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../lib/api";
import { useLanguage } from "../../lib/i18n";
import { Resources, Champion, Farmer, Player, DungeonRun } from "../../types";
import ResourceBar from "../../components/ResourceBar";
import ChampionCard from "../../components/ChampionCard";
import ChampionDrawer from "../../components/ChampionDrawer";
import FarmerCard from "../../components/FarmerCard";
import FarmerDrawer from "../../components/FarmerDrawer";
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
  });
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
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(null);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [collectAnim, setCollectAnim] = useState<{ farmerId: string; amount: number; resourceType: string; farmerIndex: number; key: number } | null>(null);
  const [showFarmers, setShowFarmers] = useState(false);
  const [error, setError] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        api.get("/api/auth/me").then((r) => setPlayer(r.data)),
        api.get("/api/resources").then((r) => setResources(r.data)),
        api.get("/api/champions").then((r) => setChampions(r.data)),
        api.get("/api/farmers").then((r) => setFarmers(r.data)),
        api.get("/api/dungeons/runs").then((r) => {
          const map: Record<string, DungeonRun> = {};
          for (const run of r.data) {
            if (run.status === "active") map[run.champion_id] = run;
          }
          setRunMap(map);
        }),
      ]).catch(() => setError(true));
    }, [])
  );

  function toggleView() {
    const toValue = showFarmers ? 0 : -screenWidth;
    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: true,
      tension: 80,
      friction: 14,
    }).start();
    setShowFarmers(!showFarmers);
  }

  const hasCards = champions.length > 0 || farmers.length > 0;

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
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(game)/settings")}
            style={styles.settingsBtn}
          >
            <Settings size={18} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Resource pills */}
        <ResourceBar resources={resources} />

        {error && (
          <View style={styles.errorBanner}>
            <AlertTriangle size={14} color="#fff" strokeWidth={2} />
            <Text style={styles.errorText}>{t("cannotReachServer")}</Text>
          </View>
        )}

        {/* Center — cats around campfire / farmer scene */}
        <View style={styles.centerFill}>
          {(champions.length > 0 || farmers.length > 0) && (
            <CampfireScene
              champions={champions}
              farmers={farmers}
              showFarmers={showFarmers}
            />
          )}
        </View>

        {/* Cards section */}
        {hasCards && (
          <View style={styles.cardsSection}>
            {/* Section header with toggle */}
            <View style={styles.cardsSectionHeader}>
              <View style={styles.sectionTitleRow}>
                {showFarmers ? (
                  <Sprout size={13} color="#a8e6a3" strokeWidth={2.5} />
                ) : (
                  <Swords size={13} color="#a8e6a3" strokeWidth={2.5} />
                )}
                <Text style={styles.sectionTitle}>
                  {showFarmers ? t("farmersUpper") : t("championsUpper")}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.toggleBtn}
                onPress={toggleView}
                activeOpacity={0.75}
              >
                {showFarmers ? (
                  <Swords size={12} color="#3a2a10" strokeWidth={2.5} />
                ) : (
                  <Sprout size={12} color="#3a2a10" strokeWidth={2.5} />
                )}
                <Text style={styles.toggleBtnText}>
                  {showFarmers ? t("champions") : t("farmers")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Collect floater — rendered outside slideClip to avoid overflow:hidden clipping */}
            {collectAnim && showFarmers && (
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
                  { transform: [{ translateX: slideAnim }] },
                ]}
              >
                {/* Champions row */}
                <View style={[styles.cardsRow, { width: screenWidth }]}>
                  {champions.slice(0, 3).map((c) => (
                    <ChampionCard
                      key={c.id}
                      champion={c}
                      activeRunEndsAt={runMap[c.id]?.ends_at}
                      onPress={setSelectedChampion}
                    />
                  ))}
                </View>

                {/* Farmers row */}
                <View style={[styles.cardsRow, { width: screenWidth }]}>
                  {farmers.slice(0, 3).map((f) => (
                    <FarmerCard key={f.id} farmer={f} onPress={setSelectedFarmer} />
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
        onPvp={() => {
          setSelectedChampion(null);
          router.push("/(game)/pvp");
        }}
        onDungeon={() => {
          const championId = selectedChampion?.id;
          setSelectedChampion(null);
          router.push({
            pathname: "/(game)/dungeons",
            params: { championId },
          });
        }}
        claimableRun={
          selectedChampion && runMap[selectedChampion.id] &&
          new Date(runMap[selectedChampion.id].ends_at) <= new Date()
            ? runMap[selectedChampion.id]
            : undefined
        }
        isOnMission={
          !!(selectedChampion && runMap[selectedChampion.id] &&
          new Date(runMap[selectedChampion.id].ends_at) > new Date())
        }
        activeRunEndsAt={
          selectedChampion && runMap[selectedChampion.id] &&
          new Date(runMap[selectedChampion.id].ends_at) > new Date()
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
        onSpendStat={async (champion, stat) => {
          try {
            const res = await api.post(`/api/champions/${champion.id}/spend-stat`, { stat });
            setChampions((prev) => prev.map((c) => (c.id === champion.id ? res.data : c)));
            setSelectedChampion(res.data);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "İstatistik güçlendirme başarısız");
          }
        }}
        onClaim={async (run) => {
          setSelectedChampion(null);
          try {
            const res = await api.post(`/api/dungeons/runs/${run.id}/claim`);
            setClaimResult(res.data);
            // Refresh champions (HP updated) and resources and runs
            Promise.all([
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
          } catch (err: any) {
            setClaimResult({ winner: "enemy", rewardResource: "", rewardAmount: 0, log: [], xpGained: 0, levelsGained: 0, newLevel: 1 });
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
            api.get("/api/farmers").then((r) => setFarmers(r.data));
            setSelectedFarmer(null);
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
            setResources(res.data.resources);
            setFarmers((prev) =>
              prev.map((f) => (f.id === farmer.id ? res.data.farmer : f))
            );
            setSelectedFarmer(res.data.farmer);
          } catch (err: any) {
            alert(err.response?.data?.error ?? "Geliştirme başarısız");
          }
        }}
      />

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
            <View style={[
              styles.modalHeader,
              claimResult?.winner === "champion" ? styles.modalHeaderWin : styles.modalHeaderLose
            ]}>
              <Text style={styles.modalTitle}>
                {claimResult?.winner === "champion" ? "⚔️ Zafer!" : "💀 Yenilgi"}
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
                  <Text style={styles.modalXp}>+{claimResult!.xpGained} XP</Text>
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
            <ScrollView style={styles.logScroll} showsVerticalScrollIndicator={false}>
              {(claimResult?.log ?? []).map((entry: any, i: number) => {
                const isChamp = entry.actor === "attacker";
                const atkHp  = isChamp ? entry.attackerHpAfter : entry.defenderHpAfter;
                const defHp  = isChamp ? entry.defenderHpAfter : entry.attackerHpAfter;
                const blocked  = entry.damage === 0;
                const newRound = i === 0 || claimResult?.log[i - 1]?.round !== entry.round;

                return (
                  <View key={i} style={styles.logRow}>
                    {newRound && (
                      <View style={styles.roundBadge}>
                        <Text style={styles.roundBadgeText}>Tur {entry.round + 1}</Text>
                      </View>
                    )}
                    <View style={[styles.logLine, isChamp ? styles.logLineChamp : styles.logLineEnemy]}>
                      {/* Attacker */}
                      <View style={styles.logSide}>
                        <Text style={[styles.logSideName, isChamp ? styles.logActorChamp : styles.logActorEnemy]}>
                          {isChamp ? "⚔️" : "👹"} {isChamp ? "Şampiyon" : "Düşman"}
                        </Text>
                        <Text style={styles.logSideHp}>{atkHp} HP</Text>
                        <View style={styles.logSideStatRow}>
                          <Text style={styles.logAtkVal}>ATK {entry.attackValue}</Text>
                          {entry.atkBoosted && <Text style={styles.logCritBadge}>KRİT</Text>}
                        </View>
                      </View>

                      {/* Center */}
                      <View style={styles.logCenter}>
                        <Text style={styles.logArrow}>→</Text>
                        <View style={[styles.logDmgPill, blocked ? styles.logDmgPillBlock : styles.logDmgPillHit]}>
                          <Text style={[styles.logDmgText, blocked ? styles.logDmgTextBlock : styles.logDmgTextHit]}>
                            {blocked ? "BLOK" : `−${entry.damage}`}
                          </Text>
                        </View>
                      </View>

                      {/* Defender */}
                      <View style={[styles.logSide, styles.logSideRight]}>
                        <Text style={[styles.logSideName, isChamp ? styles.logActorEnemy : styles.logActorChamp]}>
                          {isChamp ? "👹" : "⚔️"} {isChamp ? "Düşman" : "Şampiyon"}
                        </Text>
                        <Text style={[styles.logSideHp, !blocked && styles.logSideHpDamaged]}>{defHp} HP</Text>
                        <View style={[styles.logSideStatRow, styles.logSideStatRight]}>
                          {entry.defBoosted && <Text style={styles.logBlockBadge}>BLOK</Text>}
                          <Text style={styles.logDefVal}>DEF {entry.defenseValue}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.modalBtn} onPress={() => setClaimResult(null)}>
              <Text style={styles.modalBtnText}>Kapat</Text>
            </TouchableOpacity>
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
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(245,237,216,0.92)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: "#d4b896",
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3a2a10",
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
});
