import { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/StyledText";
import { ChevronLeft, Scroll, Clock } from "lucide-react-native";
import { useRouter } from "expo-router";
import QuestCard from "../../components/QuestCard";
import QuestBonusBar from "../../components/QuestBonusBar";
import ResourceCollectAnimation from "../../components/ResourceCollectAnimation";
import { useQuestsQuery } from "../../lib/query/queries";
import { useClaimQuestMutation } from "../../lib/query/mutations";
import { usePlayerQuery } from "../../lib/query/queries";

type Tab = "daily" | "weekly";
type Position = { x: number; y: number };

const COIN_IMG = require("../../assets/icons/icon-coin.webp");

// ─── Countdown helpers ────────────────────────────────────────────────────────

function getNextDailyResetMs(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.getTime();
}

function getNextWeeklyResetMs(): number {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon...
  const daysUntil = day === 1 ? 7 : (8 - day) % 7 || 7;
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntil));
  return next.getTime();
}

function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function useCountdown(targetMs: number) {
  const [msLeft, setMsLeft] = useState(() => Math.max(0, targetMs - Date.now()));
  useEffect(() => {
    const iv = setInterval(() => setMsLeft(Math.max(0, targetMs - Date.now())), 1000);
    return () => clearInterval(iv);
  }, [targetMs]);
  return msLeft;
}

// ─── Countdown banner ─────────────────────────────────────────────────────────

function ResetCountdown({ type }: { type: "daily" | "weekly" }) {
  const targetMs = type === "daily" ? getNextDailyResetMs() : getNextWeeklyResetMs();
  const msLeft = useCountdown(targetMs);
  const label = type === "daily" ? "Daily quests reset in" : "Weekly quests reset in";

  return (
    <View style={styles.countdownBanner}>
      <Clock size={14} color="#8a7060" strokeWidth={2} />
      <Text style={styles.countdownText}>
        {label}{" "}
        <Text style={styles.countdownTime}>{formatCountdown(msLeft)}</Text>
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function QuestsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("daily");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [coinAnim, setCoinAnim] = useState<{
    coins: number;
    startPos: Position;
    targetPos: Position;
    key: number;
  } | null>(null);

  const coinIconRef = useRef<View | null>(null);

  const { data, isLoading } = useQuestsQuery();
  const { data: player } = usePlayerQuery();
  const claimMutation = useClaimQuestMutation();

  const daily = data?.daily ?? [];
  const weekly = data?.weekly ?? [];
  const dailyBonus = data?.dailyBonus;
  const coins = player?.coins ?? 0;

  const allDailyClaimed = daily.length > 0 && daily.every((q) => q.status === "claimed");
  const allWeeklyClaimed = weekly.length > 0 && weekly.every((q) => q.status === "claimed");

  function handleClaim(questId: string, startPos: Position) {
    if (claimingId) return;
    setClaimingId(questId);

    claimMutation.mutate(questId, {
      onSuccess: (data) => {
        coinIconRef.current?.measureInWindow((x, y, w, h) => {
          const totalCoins = data.coins_awarded + (data.bonus?.awarded ? (data.bonus.coins ?? 0) : 0);
          setCoinAnim({
            coins: totalCoins,
            startPos,
            targetPos: { x: x + w / 2, y: y + h / 2 },
            key: Date.now(),
          });
        });
      },
      onSettled: () => setClaimingId(null),
    });
  }

  const quests = activeTab === "daily" ? daily : weekly;
  const allClaimed = activeTab === "daily" ? allDailyClaimed : allWeeklyClaimed;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#7a5a30" strokeWidth={2.5} />
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <Scroll size={18} color="#7a5a30" strokeWidth={2} />
          <Text style={styles.title}>Quests</Text>
        </View>

        {/* Coin counter — animation target */}
        <View
          ref={coinIconRef}
          style={styles.coinBadge}
          collapsable={false}
        >
          <Image source={COIN_IMG} style={styles.coinImg} resizeMode="contain" />
          <Text style={styles.coinText}>{coins}</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "daily" && styles.tabActive]}
          onPress={() => setActiveTab("daily")}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, activeTab === "daily" && styles.tabTextActive]}>
            Daily
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "weekly" && styles.tabActive]}
          onPress={() => setActiveTab("weekly")}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, activeTab === "weekly" && styles.tabTextActive]}>
            Weekly
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#c87820" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {quests.length === 0 ? (
            <Text style={styles.emptyText}>No quests available.</Text>
          ) : (
            quests.map((quest) => (
              <QuestCard
                key={quest.id}
                quest={quest}
                onClaim={handleClaim}
                isClaiming={claimingId === quest.id}
              />
            ))
          )}

          {activeTab === "daily" && daily.length > 0 && dailyBonus && (
            <QuestBonusBar bonus={dailyBonus} />
          )}

          {allClaimed && (
            <ResetCountdown type={activeTab} />
          )}

          <View style={styles.bottomPad} />
        </ScrollView>
      )}

      {/* Coin fly animation */}
      {coinAnim && (
        <ResourceCollectAnimation
          key={coinAnim.key}
          startPosition={coinAnim.startPos}
          targetPosition={coinAnim.targetPos}
          amount={coinAnim.coins}
          icon={COIN_IMG}
          onDone={() => setCoinAnim(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fdf6e9",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e8dcc8",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f5edd8",
    borderWidth: 1,
    borderColor: "#c8a96e",
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#3d2c1e",
  },
  coinBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f5edd8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c8a96e",
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 60,
    justifyContent: "center",
  },
  coinImg: {
    width: 16,
    height: 16,
  },
  coinText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#60552f",
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: "#ede8df",
    borderRadius: 12,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#a09080",
  },
  tabTextActive: {
    color: "#3d2c1e",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  emptyText: {
    textAlign: "center",
    color: "#a09080",
    fontSize: 14,
    marginTop: 40,
  },
  countdownBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#f5edd8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e8dcc8",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  countdownText: {
    fontSize: 12,
    color: "#8a7060",
  },
  countdownTime: {
    fontSize: 13,
    fontWeight: "700",
    color: "#c87820",
  },
  bottomPad: {
    height: 24,
  },
});
