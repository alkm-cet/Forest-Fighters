import { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/StyledText";
import { ChevronLeft, Swords, Shield, Zap, Trophy } from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import api from "../../lib/api";
import { CLASS_META } from "../../constants/resources";

type OpponentInfo = {
  opponentId: string;
  opponentName: string;
  opponentChampionClass: string;
  opponentStats: {
    attack: number;
    defense: number;
    chance: number;
    max_hp: number;
  };
  opponentTrophies: number;
  opponentLeague: string;
};

type Phase = "searching" | "found" | "fighting";

const LEAGUE_COLORS: Record<string, string> = {
  Bronz:  "#cd7f32",
  Gumus:  "#aaaaaa",
  Altin:  "#ffd700",
  Platin: "#a0c4ff",
  Elmas:  "#b9f2ff",
};

const DOT_COUNT = 3;
const MIN_SEARCH_MS = 2000;

export default function PvpScreen() {
  const router = useRouter();
  const {
    championId,
    championName,
    championClass,
    championAttack,
    championDefense,
    championChance,
    championMaxHp,
    championCurrentHp,
    championLevel,
  } = useLocalSearchParams<{
    championId: string;
    championName: string;
    championClass: string;
    championAttack: string;
    championDefense: string;
    championChance: string;
    championMaxHp: string;
    championCurrentHp: string;
    championLevel: string;
  }>();

  const [phase, setPhase] = useState<Phase>("searching");
  const [opponent, setOpponent] = useState<OpponentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDot, setActiveDot] = useState(0);

  // Animated values
  const fadeAnim    = useRef(new Animated.Value(1)).current;
  const fightFade   = useRef(new Animated.Value(0)).current;

  // Dot animation ticker
  useEffect(() => {
    if (phase !== "searching") return;
    const id = setInterval(() => setActiveDot((d) => (d + 1) % DOT_COUNT), 500);
    return () => clearInterval(id);
  }, [phase]);

  // Start searching on mount
  useEffect(() => {
    doSearch();
  }, []);

  async function doSearch() {
    setPhase("searching");
    setOpponent(null);
    setError(null);
    const searchStart = Date.now();
    try {
      const res = await api.get(`/api/pvp/find-opponent?champion_id=${championId}`);
      const elapsed = Date.now() - searchStart;
      const remaining = MIN_SEARCH_MS - elapsed;
      if (remaining > 0) await sleep(remaining);
      setOpponent(res.data);
      setPhase("found");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Rakip bulunamadı");
      setPhase("found"); // show error state still in "found" area
    }
  }

  async function handleAttack() {
    if (!opponent) return;
    // Fade out current UI
    Animated.timing(fadeAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start(async () => {
      setPhase("fighting");
      Animated.timing(fightFade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      try {
        await api.post("/api/pvp/attack", {
          champion_id: championId,
          opponent_id: opponent.opponentId,
        });
      } catch {
        // even on error we go back — the attack attempt is logged
      }
      await sleep(1200);
      router.back();
    });
  }

  const atk = parseInt(championAttack ?? "0");
  const def = parseInt(championDefense ?? "0");
  const chc = parseInt(championChance ?? "0");
  const hp  = parseInt(championCurrentHp ?? "0");
  const maxHp = parseInt(championMaxHp ?? "0");
  const myMeta = CLASS_META[championClass ?? ""] ?? { image: null, color: "#888" };

  const oppMeta = opponent ? (CLASS_META[opponent.opponentChampionClass] ?? { image: null, color: "#888" }) : null;
  const oppLeagueColor = opponent ? (LEAGUE_COLORS[opponent.opponentLeague] ?? "#cd7f32") : "#cd7f32";

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={26} color="#b0c4de" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.title}>
            {phase === "fighting" ? "" : phase === "found" && opponent ? "Rakip Bulundu!" : "Maç Aranıyor..."}
          </Text>
          <View style={styles.backBtn} />
        </View>

        {/* Fighting overlay */}
        {phase === "fighting" && (
          <Animated.View style={[styles.fightingOverlay, { opacity: fightFade }]}>
            <Text style={styles.fightingTitle}>Savaş Başladı!</Text>
            <Text style={styles.fightingSubtitle}>{championName}</Text>
          </Animated.View>
        )}

        {/* Main content fades out on fight */}
        {phase !== "fighting" && (
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            {phase === "searching" && (
              <View style={styles.searchingContainer}>
                <View style={styles.dotsRow}>
                  {Array.from({ length: DOT_COUNT }).map((_, i) => (
                    <View key={i} style={[styles.dot, i === activeDot && styles.dotActive]} />
                  ))}
                </View>
                <Text style={styles.searchingText}>Uygun rakip aranıyor...</Text>

                {/* My champion preview while searching */}
                <View style={styles.myChampPreview}>
                  {myMeta.image && <Image source={myMeta.image} style={styles.previewImage} resizeMode="contain" />}
                  <Text style={styles.previewName}>{championName}</Text>
                  <View style={styles.previewStats}>
                    <StatChip icon="atk" value={atk} color="#e57373" />
                    <StatChip icon="def" value={def} color="#90a4ae" />
                    <StatChip icon="chc" value={`${chc}%`} color="#ce93d8" />
                  </View>
                </View>
              </View>
            )}

            {phase === "found" && (
              <View style={styles.foundContainer}>
                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : opponent && (
                  <>
                    {/* VS layout */}
                    <View style={styles.vsRow}>
                      {/* My champion */}
                      <View style={styles.champSide}>
                        {myMeta.image && <Image source={myMeta.image} style={styles.vsImage} resizeMode="contain" />}
                        <Text style={styles.vsChampName}>{championName}</Text>
                        <Text style={[styles.vsClass, { color: myMeta.color }]}>{(championClass ?? "").toUpperCase()}</Text>
                        <View style={styles.vsStats}>
                          <StatChip icon="atk" value={atk} color="#e57373" />
                          <StatChip icon="def" value={def} color="#90a4ae" />
                          <StatChip icon="chc" value={`${chc}%`} color="#ce93d8" />
                        </View>
                        <View style={styles.hpBar}>
                          <View style={[styles.hpFill, { width: `${maxHp > 0 ? Math.round(hp / maxHp * 100) : 0}%` as any }]} />
                        </View>
                        <Text style={styles.vsHp}>{hp}/{maxHp}</Text>
                        <Text style={styles.vsYouLabel}>SEN</Text>
                      </View>

                      {/* VS badge */}
                      <View style={styles.vsBadge}>
                        <Text style={styles.vsText}>VS</Text>
                      </View>

                      {/* Opponent */}
                      <View style={styles.champSide}>
                        {oppMeta?.image && <Image source={oppMeta.image} style={styles.vsImage} resizeMode="contain" />}
                        <Text style={styles.vsChampName}>{opponent.opponentName}</Text>
                        <Text style={[styles.vsClass, { color: oppMeta?.color ?? "#888" }]}>{opponent.opponentChampionClass.toUpperCase()}</Text>
                        <View style={styles.vsStats}>
                          <StatChip icon="atk" value={opponent.opponentStats.attack} color="#e57373" />
                          <StatChip icon="def" value={opponent.opponentStats.defense} color="#90a4ae" />
                          <StatChip icon="chc" value={`${opponent.opponentStats.chance}%`} color="#ce93d8" />
                        </View>
                        <View style={styles.hpBar}>
                          <View style={[styles.hpFill, { width: "100%" as any }]} />
                        </View>
                        <Text style={styles.vsHp}>{opponent.opponentStats.max_hp}/{opponent.opponentStats.max_hp}</Text>
                        <View style={styles.oppTrophyRow}>
                          <Trophy size={10} color={oppLeagueColor} strokeWidth={2} />
                          <Text style={[styles.oppLeague, { color: oppLeagueColor }]}>{opponent.opponentLeague}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Action buttons */}
                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.reSearchBtn} onPress={doSearch} activeOpacity={0.8}>
                        <Text style={styles.reSearchText}>Yeniden Ara</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.fightBtn} onPress={handleAttack} activeOpacity={0.8}>
                        <Swords size={18} color="#fff" strokeWidth={2.5} />
                        <Text style={styles.fightBtnText}>Savaş!</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
}

function StatChip({ icon, value, color }: { icon: string; value: number | string; color: string }) {
  return (
    <View style={chipStyles.chip}>
      {icon === "atk" && <Swords size={9} color={color} strokeWidth={2.5} />}
      {icon === "def" && <Shield size={9} color={color} strokeWidth={2.5} />}
      {icon === "chc" && <Zap size={9} color={color} strokeWidth={2.5} />}
      <Text style={[chipStyles.val, { color }]}>{value}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: "#1e2433", borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 3,
    borderWidth: 1, borderColor: "#3e4a62",
  },
  val: { fontSize: 10, fontWeight: "800" },
});

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1a1f2e" },
  safe: { flex: 1 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 10,
  },
  backBtn: { width: 40 },
  title: { color: "#ecf0f1", fontSize: 18, fontWeight: "800", letterSpacing: 0.5, textAlign: "center" },

  content: { flex: 1, paddingHorizontal: 20 },

  // Searching phase
  searchingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24 },
  dotsRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  dot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: "#3e4a62",
  },
  dotActive: { backgroundColor: "#ecf0f1" },
  searchingText: { color: "#7f8c9a", fontSize: 14, fontWeight: "700", letterSpacing: 0.5 },

  myChampPreview: {
    alignItems: "center", gap: 6,
    backgroundColor: "#2c3347", borderRadius: 16, borderWidth: 1.5, borderColor: "#3e4a62",
    paddingVertical: 20, paddingHorizontal: 32, marginTop: 10,
  },
  previewImage: { width: 72, height: 72 },
  previewName:  { fontSize: 15, fontWeight: "800", color: "#ecf0f1" },
  previewStats: { flexDirection: "row", gap: 6 },

  // Found phase
  foundContainer: { flex: 1, justifyContent: "center", gap: 24 },

  vsRow: { flexDirection: "row", alignItems: "center", gap: 0 },
  champSide: {
    flex: 1, alignItems: "center", gap: 4,
    backgroundColor: "#2c3347", borderRadius: 16, borderWidth: 1.5, borderColor: "#3e4a62",
    paddingVertical: 16, paddingHorizontal: 8,
  },
  vsImage:    { width: 72, height: 72 },
  vsChampName: { fontSize: 12, fontWeight: "800", color: "#ecf0f1", textAlign: "center" },
  vsClass:    { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  vsStats:    { flexDirection: "row", flexWrap: "wrap", gap: 4, justifyContent: "center", marginTop: 4 },
  hpBar: {
    width: "80%", height: 5, backgroundColor: "#3e4a62", borderRadius: 3, overflow: "hidden", marginTop: 4,
  },
  hpFill: { height: "100%", backgroundColor: "#e05050", borderRadius: 3 },
  vsHp:   { fontSize: 9, color: "#7f8c9a", fontWeight: "700" },
  vsYouLabel: { fontSize: 9, color: "#81c784", fontWeight: "800", letterSpacing: 1, marginTop: 2 },
  oppTrophyRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  oppLeague: { fontSize: 9, fontWeight: "700" },

  vsBadge: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#c0392b", alignItems: "center", justifyContent: "center",
    marginHorizontal: 8,
    shadowColor: "#c0392b", shadowOpacity: 0.6, shadowRadius: 8, elevation: 6,
  },
  vsText: { fontSize: 13, fontWeight: "900", color: "#fff" },

  actionRow: { flexDirection: "row", gap: 12 },
  reSearchBtn: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#2c3347", borderRadius: 14, borderWidth: 1.5, borderColor: "#3e4a62",
    paddingVertical: 14,
  },
  reSearchText: { fontSize: 14, fontWeight: "800", color: "#b0c4de" },
  fightBtn: {
    flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#c0392b", borderRadius: 14, paddingVertical: 14,
  },
  fightBtnText: { fontSize: 16, fontWeight: "900", color: "#fff", letterSpacing: 1 },

  errorBox: {
    backgroundColor: "#2c3347", borderRadius: 12, padding: 20, alignItems: "center",
  },
  errorText: { fontSize: 14, color: "#ef9a9a", textAlign: "center" },

  // Fighting phase
  fightingOverlay: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 12,
  },
  fightingTitle: {
    fontSize: 32, fontWeight: "900", color: "#ecf0f1", letterSpacing: 2,
    textShadowColor: "#c0392b", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20,
  },
  fightingSubtitle: { fontSize: 16, color: "#7f8c9a", fontWeight: "700" },
});
