import { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/StyledText";
import { ChevronLeft } from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../lib/api";
import { useLanguage } from "../../lib/i18n";
import { Dungeon, DungeonRun } from "../../types";
import DungeonCard from "../../components/DungeonCard";

export default function DungeonsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { championId } = useLocalSearchParams<{ championId: string }>();

  const [dungeons, setDungeons] = useState<Dungeon[]>([]);
  const [runs, setRuns] = useState<DungeonRun[]>([]);
  const [claimResult, setClaimResult] = useState<{
    winner: "champion" | "enemy";
    rewardResource: string;
    rewardAmount: number;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
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
      // silent — user sees empty state
    }
  }

  function getRunForDungeon(dungeonId: string): DungeonRun | undefined {
    return runs.find((r) => r.dungeon_id === dungeonId && r.status === "active");
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
      setClaimResult(res.data);
      await loadData();
    } catch (err: any) {
      Alert.alert(err.response?.data?.error || "Failed to claim reward");
    }
  }

  // A champion is "busy" if it has an active run — disable enter for other dungeons if same champion
  const championIsBusy = runs.some(
    (r) => r.champion_id === championId && r.status === "active"
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={28} color="#a8e6a3" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.title}>{t("dungeons")}</Text>
          <View style={styles.backBtn} />
        </View>

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
              const isExpired = run && new Date(run.ends_at) <= new Date();
              // Disable entering if champion is busy AND this dungeon has no active run for this champion
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
      </View>

      {/* Claim result modal */}
      <Modal
        visible={claimResult !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setClaimResult(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {claimResult?.winner === "champion" ? t("victory") : t("defeat")}
            </Text>
            <Text style={styles.modalSub}>{t("missionComplete")}</Text>
            {claimResult?.rewardAmount && claimResult.rewardAmount > 0 ? (
              <Text style={styles.modalReward}>
                +{claimResult.rewardAmount} {claimResult.rewardResource}
              </Text>
            ) : (
              <Text style={styles.modalNoReward}>No reward this time.</Text>
            )}
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => setClaimResult(null)}
            >
              <Text style={styles.modalBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#1a3d1a",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    marginBottom: 4,
  },
  backBtn: {
    width: 44,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },
  listContent: {
    paddingBottom: 32,
  },
  empty: {
    color: "#a8e6a3",
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    width: "100%",
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#3a2a10",
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 14,
    color: "#7a6040",
    marginBottom: 16,
  },
  modalReward: {
    fontSize: 20,
    fontWeight: "800",
    color: "#4a7c3f",
    marginBottom: 20,
  },
  modalNoReward: {
    fontSize: 15,
    color: "#c0392b",
    marginBottom: 20,
  },
  modalBtn: {
    backgroundColor: "#4a7c3f",
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 12,
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
});
