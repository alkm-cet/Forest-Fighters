import { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Image,
  ImageBackground,
  Animated,
  ScrollView,
  TouchableOpacity,
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
  RefreshCw,
} from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import api from "../../lib/api";
import { CLASS_META } from "../../constants/resources";
import { LEAGUE_META } from "../../constants/leagues";
import CustomButton from "../../components/CustomButton";

const CHAMP_CARD_BG = require("../../assets/dungeon/dungeon-champion-card-bg.webp");
const PVP_BG = require("../../assets/pvp-screen-bg.webp");

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
  preview_strawberry: number;
  preview_pinecone: number;
  preview_blueberry: number;
};

type Phase = "searching" | "found" | "fighting";

const LEAGUE_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(LEAGUE_META).map(([key, val]) => [key, val.color])
);

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
    myTrophies,
    myLeague,
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
    myTrophies: string;
    myLeague: string;
  }>();

  const [phase, setPhase] = useState<Phase>("searching");
  const [opponent, setOpponent] = useState<OpponentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDot, setActiveDot] = useState(0);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const fightFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase !== "searching") return;
    const id = setInterval(() => setActiveDot((d) => (d + 1) % DOT_COUNT), 500);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    doSearch();
  }, []);

  async function doSearch() {
    setPhase("searching");
    setOpponent(null);
    setError(null);
    const searchStart = Date.now();
    try {
      const res = await api.get(
        `/api/pvp/find-opponent?champion_id=${championId}`,
      );
      const elapsed = Date.now() - searchStart;
      const remaining = MIN_SEARCH_MS - elapsed;
      if (remaining > 0) await sleep(remaining);
      setOpponent(res.data);
      setPhase("found");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Rakip bulunamadı");
      setPhase("found");
    }
  }

  async function handleAttack() {
    if (!opponent) return;
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(async () => {
      setPhase("fighting");
      Animated.timing(fightFade, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
      try {
        await api.post("/api/pvp/attack", {
          champion_id: championId,
          opponent_id: opponent.opponentId,
        });
      } catch {
        /* logged server-side */
      }
      await sleep(1200);
      router.back();
    });
  }

  const atk = parseInt(championAttack ?? "0");
  const def = parseInt(championDefense ?? "0");
  const chc = parseInt(championChance ?? "0");
  const hp = parseInt(championCurrentHp ?? "0");
  const maxHp = parseInt(championMaxHp ?? "0");
  const hpPct = maxHp > 0 ? hp / maxHp : 0;
  const hpColor = hpPct > 0.6 ? "#4caf50" : hpPct > 0.3 ? "#f39c12" : "#e57373";

  const myLeagueLabel = myLeague ?? "Bronz";
  const myLeagueColor = LEAGUE_COLORS[myLeagueLabel] ?? "#cd7f32";

  const myMeta = CLASS_META[championClass ?? ""] ?? {
    image: null,
    color: "#888",
  };
  const oppMeta = opponent
    ? (CLASS_META[opponent.opponentChampionClass] ?? {
        image: null,
        color: "#888",
      })
    : null;
  const oppLeagueColor = opponent
    ? (LEAGUE_COLORS[opponent.opponentLeague] ?? "#cd7f32")
    : "#cd7f32";

  return (
    <ImageBackground source={PVP_BG} style={styles.root} resizeMode="cover">
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <ChevronLeft size={26} color="#b0c4de" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.title}>
            {phase === "fighting"
              ? ""
              : phase === "found" && opponent
                ? "Rakip Bulundu!"
                : "Maç Aranıyor..."}
          </Text>
          <View style={styles.backBtn} />
        </View>

        {/* Fighting overlay */}
        {phase === "fighting" && (
          <Animated.View
            style={[styles.fightingOverlay, { opacity: fightFade }]}
          >
            <Text style={styles.fightingTitle}>Savaş Başladı!</Text>
            <Text style={styles.fightingSubtitle}>{championName}</Text>
          </Animated.View>
        )}

        {phase !== "fighting" && (
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            {phase === "searching" && (
              <View style={styles.searchingContainer}>
                <View style={styles.dotsRow}>
                  {Array.from({ length: DOT_COUNT }).map((_, i) => (
                    <View
                      key={i}
                      style={[styles.dot, i === activeDot && styles.dotActive]}
                    />
                  ))}
                </View>
                <Text style={styles.searchingText}>
                  Uygun rakip aranıyor...
                </Text>
                <ChampionCard
                  name={championName ?? ""}
                  className={championClass ?? ""}
                  meta={myMeta}
                  atk={atk}
                  def={def}
                  chc={chc}
                  hp={hp}
                  maxHp={maxHp}
                  hpColor={hpColor}
                  label="SEN"
                  labelColor="#81c784"
                  trophyLabel={myLeagueLabel}
                  trophyColor={myLeagueColor}
                />
              </View>
            )}

            {phase === "found" && (
              <ScrollView
                style={styles.foundScroll}
                contentContainerStyle={styles.foundContainer}
                showsVerticalScrollIndicator={false}
              >
                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : (
                  opponent && (
                    <>
                      {/* My champion */}
                      <ChampionCard
                        name={championName ?? ""}
                        className={championClass ?? ""}
                        meta={myMeta}
                        atk={atk}
                        def={def}
                        chc={chc}
                        hp={hp}
                        maxHp={maxHp}
                        hpColor={hpColor}
                        label="SEN"
                        labelColor="#81c784"
                      />

                      {/* VS badge */}
                      <View style={styles.vsBadge}>
                        <Text style={styles.vsText}>VS</Text>
                      </View>

                      {/* Loot preview */}
                      {(opponent.preview_strawberry > 0 || opponent.preview_pinecone > 0 || opponent.preview_blueberry > 0) && (
                        <View style={styles.lootRow}>
                          <Text style={styles.lootLabel}>Kazanılacak:</Text>
                          {opponent.preview_strawberry > 0 && (
                            <View style={styles.lootPill}>
                              <Image source={require("../../assets/resource-images/strawberry.webp")} style={styles.lootIcon} />
                              <Text style={[styles.lootVal, { color: "#e8534a" }]}>+{opponent.preview_strawberry}</Text>
                            </View>
                          )}
                          {opponent.preview_pinecone > 0 && (
                            <View style={styles.lootPill}>
                              <Image source={require("../../assets/resource-images/pinecone.webp")} style={styles.lootIcon} />
                              <Text style={[styles.lootVal, { color: "#5a8a3c" }]}>+{opponent.preview_pinecone}</Text>
                            </View>
                          )}
                          {opponent.preview_blueberry > 0 && (
                            <View style={styles.lootPill}>
                              <Image source={require("../../assets/resource-images/blueberry.webp")} style={styles.lootIcon} />
                              <Text style={[styles.lootVal, { color: "#5b6bbf" }]}>+{opponent.preview_blueberry}</Text>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Opponent */}
                      <ChampionCard
                        name={opponent.opponentName}
                        className={opponent.opponentChampionClass}
                        meta={oppMeta ?? { image: null, color: "#888" }}
                        atk={opponent.opponentStats.attack}
                        def={opponent.opponentStats.defense}
                        chc={opponent.opponentStats.chance}
                        hp={opponent.opponentStats.max_hp}
                        maxHp={opponent.opponentStats.max_hp}
                        hpColor="#4caf50"
                        trophyLabel={opponent.opponentLeague}
                        trophyColor={oppLeagueColor}
                        isEnemy
                      />

                      {/* Action buttons */}
                      <View style={styles.actionRow}>
                        <CustomButton
                          text="Yeniden Ara"
                          onClick={doSearch}
                          btnIcon={
                            <RefreshCw
                              size={15}
                              color="#fff"
                              strokeWidth={2.5}
                            />
                          }
                          bgColor="#2c3347"
                          borderColor="#3e4a62"
                          style={styles.reSearchBtnStyle}
                        />
                        <CustomButton
                          text="Savaş!"
                          onClick={handleAttack}
                          btnImage={require("../../assets/cross-swords.png")}
                          bgColor="#c0392b"
                          borderColor="#922b21"
                          style={styles.fightBtnStyle}
                        />
                      </View>
                    </>
                  )
                )}
              </ScrollView>
            )}
          </Animated.View>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}

// ── Reusable champion card (dungeon strip style) ──────────────────────────────
type CardProps = {
  name: string;
  className: string;
  meta: { image: any; color: string };
  atk: number;
  def: number;
  chc: number;
  hp: number;
  maxHp: number;
  hpColor: string;
  label?: string;
  labelColor?: string;
  trophyLabel?: string;
  trophyColor?: string;
  isEnemy?: boolean;
};

function ChampionCard({
  name,
  className,
  meta,
  atk,
  def,
  chc,
  hp,
  maxHp,
  hpColor,
  label,
  labelColor,
  trophyLabel,
  trophyColor,
  isEnemy,
}: CardProps) {
  const hpPct = maxHp > 0 ? hp / maxHp : 0;
  return (
    <ImageBackground
      source={CHAMP_CARD_BG}
      style={[cardStyles.bg, isEnemy && cardStyles.bgEnemy]}
      resizeMode="stretch"
    >
      <View style={cardStyles.content}>
        {meta.image && (
          <Image
            source={meta.image}
            style={cardStyles.image}
            resizeMode="contain"
          />
        )}
        <View style={cardStyles.right}>
          {/* Name + class + label */}
          <View style={cardStyles.nameRow}>
            <Text style={cardStyles.name}>{name}</Text>
            <View style={cardStyles.badgeRow}>
              <Text style={[cardStyles.className, { color: meta.color }]}>
                {className.toUpperCase()}
              </Text>
              {label && (
                <View
                  style={[
                    cardStyles.labelBadge,
                    { borderColor: labelColor ?? "#81c784" },
                  ]}
                >
                  <Text
                    style={[
                      cardStyles.labelText,
                      { color: labelColor ?? "#81c784" },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              )}
              {trophyLabel && (
                <View
                  style={[
                    cardStyles.labelBadge,
                    { borderColor: trophyColor ?? "#cd7f32" },
                  ]}
                >
                  <Trophy
                    size={9}
                    color={trophyColor ?? "#cd7f32"}
                    strokeWidth={2}
                  />
                  <Text
                    style={[
                      cardStyles.labelText,
                      { color: trophyColor ?? "#cd7f32" },
                    ]}
                  >
                    {trophyLabel}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* HP bar */}
          <View style={cardStyles.hpRow}>
            <HeartPulse size={11} color={hpColor} strokeWidth={2.5} />
            <View style={cardStyles.hpTrack}>
              <View
                style={[
                  cardStyles.hpFill,
                  {
                    width: `${Math.round(hpPct * 100)}%` as any,
                    backgroundColor: hpColor,
                  },
                ]}
              />
            </View>
            <Text style={[cardStyles.hpVal, { color: hpColor }]}>
              {hp}/{maxHp}
            </Text>
          </View>

          {/* Stats */}
          <View style={cardStyles.statsRow}>
            <View style={cardStyles.pill}>
              <Swords size={10} color="#e57373" strokeWidth={2.5} />
              <Text style={cardStyles.pillLabel}>ATK</Text>
              <Text style={cardStyles.pillVal}>{atk}</Text>
            </View>
            <View style={cardStyles.pill}>
              <Shield size={10} color="#90a4ae" strokeWidth={2.5} />
              <Text style={cardStyles.pillLabel}>DEF</Text>
              <Text style={cardStyles.pillVal}>{def}</Text>
            </View>
            <View style={cardStyles.pill}>
              <Zap size={10} color="#ce93d8" strokeWidth={2.5} />
              <Text style={cardStyles.pillLabel}>CHC</Text>
              <Text style={cardStyles.pillVal}>{chc}%</Text>
            </View>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const cardStyles = StyleSheet.create({
  bg: { width: "100%" },
  bgEnemy: {
    shadowColor: "#c0392b",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
    elevation: 12,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 40,
    paddingTop: 22,
    paddingBottom: 22,
    gap: 12,
  },
  image: { width: 52, height: 52 },
  right: { flex: 1, gap: 12, paddingVertical: 30 },
  nameRow: { gap: 3 },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: "#3a2a10",
    textShadowColor: "rgba(255,255,255,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  className: { fontSize: 12, fontWeight: "700", letterSpacing: 1.4 },
  labelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  labelText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  hpRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  hpTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 3,
    overflow: "hidden",
  },
  hpFill: { height: "100%", borderRadius: 3 },
  hpVal: { fontSize: 14, fontWeight: "700", minWidth: 48, textAlign: "right" },
  statsRow: { flexDirection: "row", gap: 5 },
  pill: {
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
  pillLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(58,42,16,0.7)",
    letterSpacing: 0.5,
  },
  pillVal: { fontSize: 12, fontWeight: "800", color: "#3a2a10" },
});

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: { width: 40 },
  title: {
    color: "#ecf0f1",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
    textAlign: "center",
  },

  content: { flex: 1 },

  // Searching phase
  searchingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 16,
  },
  dotsRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#3e4a62" },
  dotActive: { backgroundColor: "#ecf0f1" },
  searchingText: {
    color: "#7f8c9a",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // Found phase
  foundScroll: { flex: 1 },
  foundContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 12,
  },

  vsBadge: {
    alignSelf: "center",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#c0392b",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
    shadowColor: "#c0392b",
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  vsText: { fontSize: 13, fontWeight: "900", color: "#fff" },

  lootRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lootLabel: { fontSize: 12, fontWeight: "700", color: "#aab0be", marginRight: 2 },
  lootPill: { flexDirection: "row", alignItems: "center", gap: 4 },
  lootIcon: { width: 16, height: 16, resizeMode: "contain" },
  lootVal: { fontSize: 13, fontWeight: "800" },

  actionRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  reSearchBtnStyle: { flex: 1 },
  fightBtnStyle: { flex: 2 },

  errorBox: {
    backgroundColor: "#2c3347",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  errorText: { fontSize: 14, color: "#ef9a9a", textAlign: "center" },

  // Fighting phase
  fightingOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  fightingTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#ecf0f1",
    letterSpacing: 2,
    textShadowColor: "#c0392b",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  fightingSubtitle: { fontSize: 16, color: "#7f8c9a", fontWeight: "700" },
});
