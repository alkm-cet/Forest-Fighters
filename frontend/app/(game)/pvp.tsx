import React, { useState, useEffect, useRef } from "react";
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
import { useQueryClient } from "@tanstack/react-query";
import api from "../../lib/api";
import { CLASS_META } from "../../constants/resources";
import { LEAGUE_META } from "../../constants/leagues";
import CustomButton from "../../components/CustomButton";
import { queryKeys } from "../../lib/query/queryKeys";

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
  Object.entries(LEAGUE_META).map(([key, val]) => [key, val.color]),
);

const DOT_COUNT = 3;
const MIN_SEARCH_MS = 2000;

export default function PvpScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
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
  const overlayAnim = useRef(new Animated.Value(1)).current;
  const screenExitAnim = useRef(new Animated.Value(0)).current;

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

    // Fade out the cards
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Show "Savaş Başlıyor..." immediately
    setPhase("fighting");
    Animated.timing(fightFade, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();

    // Bring background to full brightness (remove dark overlay)
    Animated.timing(overlayAnim, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Fire API — keep the promise so we can await it before navigating
    const attackPromise = api
      .post("/api/pvp/attack", {
        champion_id: championId,
        opponent_id: opponent.opponentId,
      })
      .catch(() => null);

    // After a beat, fade the whole screen to black then navigate
    await sleep(900);

    // Wait for API to settle (it's had 900ms already, typically done by now)
    await attackPromise;

    // Invalidate pvpStatus so ChampionCard shows "Savaşta!" immediately on return
    queryClient.invalidateQueries({ queryKey: queryKeys.pvpStatus() });

    Animated.timing(screenExitAnim, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    }).start(() => {
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
  const trophyChange = getTrophyChange(parseInt(myTrophies ?? "0"));

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
      {/* Persistent dark overlay – fades away when fight starts */}
      <Animated.View
        style={[styles.bgOverlay, { opacity: overlayAnim }]}
        pointerEvents="none"
      />

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
                <View style={styles.dotsWrap}>
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
                </View>
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
                  trophies={parseInt(myTrophies ?? "0")}
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
                      {/* Rewards card — top */}
                      <View style={styles.lootCard}>
                        {/* Header */}
                        <View style={styles.lootHeader}>
                          <Text style={styles.lootHeaderEmoji}>🏆</Text>
                          <Text style={styles.lootTitle}>Kazanılacak Ödüller</Text>
                        </View>

                        {/* Divider */}
                        <View style={styles.lootDivider} />

                        {/* Trophy change */}
                        <View style={styles.trophyRow}>
                          <View style={styles.trophyHalf}>
                            <Text style={styles.trophyWinLabel}>Galibiyet</Text>
                            <Text style={styles.trophyWin}>+{trophyChange.win} 🏆</Text>
                          </View>
                          <View style={styles.trophyDividerV} />
                          <View style={styles.trophyHalf}>
                            <Text style={styles.trophyLoseLabel}>Mağlubiyet</Text>
                            <Text style={styles.trophyLose}>-{trophyChange.lose} 🏆</Text>
                          </View>
                        </View>

                        {/* Resource loot */}
                        {(opponent.preview_strawberry > 0 ||
                          opponent.preview_pinecone > 0 ||
                          opponent.preview_blueberry > 0) && (
                          <>
                            <View style={styles.lootDivider} />
                            <View style={styles.lootPillsRow}>
                              {opponent.preview_strawberry > 0 && (
                                <View style={styles.lootPill}>
                                  <Image source={require("../../assets/resource-images/strawberry.webp")} style={styles.lootIcon} />
                                  <Text style={[styles.lootVal, { color: "#e8534a" }]}>+{opponent.preview_strawberry}</Text>
                                </View>
                              )}
                              {opponent.preview_pinecone > 0 && (
                                <View style={styles.lootPill}>
                                  <Image source={require("../../assets/resource-images/pinecone.webp")} style={styles.lootIcon} />
                                  <Text style={[styles.lootVal, { color: "#6dbf67" }]}>+{opponent.preview_pinecone}</Text>
                                </View>
                              )}
                              {opponent.preview_blueberry > 0 && (
                                <View style={styles.lootPill}>
                                  <Image source={require("../../assets/resource-images/blueberry.webp")} style={styles.lootIcon} />
                                  <Text style={[styles.lootVal, { color: "#8b9cf7" }]}>+{opponent.preview_blueberry}</Text>
                                </View>
                              )}
                            </View>
                          </>
                        )}
                      </View>

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
                        trophies={parseInt(myTrophies ?? "0")}
                        trophyLabel={myLeagueLabel}
                        trophyColor={myLeagueColor}
                      />

                      {/* VS badge */}
                      <View style={styles.vsBadge}>
                        <Text style={styles.vsText}>VS</Text>
                      </View>

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
                        trophies={opponent.opponentTrophies}
                        trophyLabel={opponent.opponentLeague}
                        trophyColor={oppLeagueColor}
                        isEnemy
                      />

                      {/* Action buttons */}
                      <View style={styles.actionRow}>
                        <CustomButton
                          text="Yeniden Ara"
                          onClick={doSearch}
                          btnIcon={<RefreshCw size={15} color="#fff" strokeWidth={2.5} />}
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

      {/* Full-screen black fade for exit transition */}
      <Animated.View
        style={[styles.screenExit, { opacity: screenExitAnim }]}
        pointerEvents="none"
      />
    </ImageBackground>
  );
}

// ── Reusable champion card ────────────────────────────────────────────────────
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
  trophies?: number;
  trophyLabel?: string;
  trophyColor?: string;
  isEnemy?: boolean;
};

function StatPill({
  icon,
  label,
  val,
}: {
  icon: React.ReactNode;
  label: string;
  val: string;
}) {
  return (
    <View style={cardStyles.pill}>
      {icon}
      <Text style={cardStyles.pillLabel}>{label}</Text>
      <Text style={cardStyles.pillVal}>{val}</Text>
    </View>
  );
}

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
  isEnemy,
  trophies,
  trophyLabel,
  trophyColor,
}: CardProps) {
  const hpPct = maxHp > 0 ? hp / maxHp : 0;
  const borderAccent = isEnemy ? "rgba(192,57,43,0.55)" : "rgba(46,125,50,0.45)";

  return (
    <View style={[cardStyles.card, { borderColor: borderAccent }]}>
      {/* Identity tag */}
      <View style={[cardStyles.identityTag, isEnemy && cardStyles.identityTagEnemy]}>
        <Text style={cardStyles.identityText}>{isEnemy ? "⚔️ DÜŞMAN" : "🛡️ SEN"}</Text>
      </View>

      {/* Card body */}
      <View style={cardStyles.body}>
        {/* Champion image */}
        <View style={[cardStyles.imageWrap, { backgroundColor: meta.color + "18" }]}>
          {meta.image && (
            <Image source={meta.image} style={cardStyles.image} resizeMode="contain" />
          )}
        </View>

        {/* Info */}
        <View style={cardStyles.right}>
          {/* Top row: class badge + trophy */}
          <View style={cardStyles.topRow}>
            <View style={[cardStyles.classBadge, { backgroundColor: meta.color + "22", borderColor: meta.color + "66" }]}>
              <Text style={[cardStyles.classText, { color: meta.color }]}>{className.toUpperCase()}</Text>
            </View>
            {trophyLabel && (
              <View style={[cardStyles.leagueBadge, { borderColor: (trophyColor ?? "#cd7f32") + "88" }]}>
                <Trophy size={9} color={trophyColor ?? "#cd7f32"} strokeWidth={2.5} />
                <Text style={[cardStyles.leagueText, { color: trophyColor ?? "#cd7f32" }]}>{trophyLabel}</Text>
                {trophies != null && (
                  <Text style={[cardStyles.trophiesText, { color: trophyColor ?? "#cd7f32" }]}>{trophies}</Text>
                )}
              </View>
            )}
          </View>

          {/* Name */}
          <Text style={cardStyles.name} numberOfLines={1}>{name}</Text>

          {/* HP bar */}
          <View style={cardStyles.hpRow}>
            <HeartPulse size={10} color={hpColor} strokeWidth={2.5} />
            <View style={cardStyles.hpTrack}>
              <View style={[cardStyles.hpFill, { width: `${Math.round(hpPct * 100)}%` as any, backgroundColor: hpColor }]} />
            </View>
            <Text style={[cardStyles.hpVal, { color: hpColor }]}>{hp}/{maxHp}</Text>
          </View>

          {/* Stats */}
          <View style={cardStyles.statsRow}>
            <StatPill icon={<Swords size={9} color="#e57373" strokeWidth={2.5} />} label="ATK" val={String(atk)} />
            <StatPill icon={<Shield size={9} color="#90a4ae" strokeWidth={2.5} />} label="DEF" val={String(def)} />
            <StatPill icon={<Zap    size={9} color="#ce93d8" strokeWidth={2.5} />} label="CHC" val={`${chc}%`} />
          </View>
        </View>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fdf3dc",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#a07030",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 2,
  },
  // Small corner identity tag
  identityTag: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "rgba(46,125,50,0.15)",
    borderBottomLeftRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    zIndex: 2,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: "rgba(46,125,50,0.3)",
  },
  identityTagEnemy: {
    backgroundColor: "rgba(192,57,43,0.12)",
    borderColor: "rgba(192,57,43,0.3)",
  },
  identityText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#3a1e00",
    letterSpacing: 0.8,
  },
  body: { flexDirection: "row" },
  imageWrap: {
    width: 68,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  image: { width: 50, height: 50 },
  right: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 6,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    paddingRight: 70, // leave room for identity tag
  },
  classBadge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  classText: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  leagueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  leagueText: { fontSize: 9, fontWeight: "800" },
  trophiesText: { fontSize: 9, fontWeight: "700", opacity: 0.8 },
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
  name: { fontSize: 15, fontWeight: "800", color: "#3a1e00" },
  hpRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  hpTrack: {
    flex: 1,
    height: 5,
    backgroundColor: "rgba(58,30,0,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  hpFill: { height: "100%", borderRadius: 3 },
  hpVal: { fontSize: 11, fontWeight: "700", minWidth: 40, textAlign: "right" },
  statsRow: { flexDirection: "row", gap: 5 },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    backgroundColor: "rgba(58,30,0,0.06)",
    borderRadius: 7,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(58,30,0,0.1)",
  },
  pillLabel: { fontSize: 9, fontWeight: "700", color: "#7a5a30", letterSpacing: 0.5 },
  pillVal:  { fontSize: 11, fontWeight: "800", color: "#3a1e00" },
});

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Mirrors backend getTrophyChange — must stay in sync with pvpController.js */
function getTrophyChange(trophies: number): { win: number; lose: number } {
  if (trophies >= 1600) return { win: 8, lose: 6 };
  if (trophies >= 1300) return { win: 10, lose: 8 };
  if (trophies >= 1000) return { win: 12, lose: 10 };
  if (trophies >= 750) return { win: 15, lose: 12 };
  if (trophies >= 500) return { win: 18, lose: 14 };
  if (trophies >= 300) return { win: 22, lose: 18 };
  if (trophies >= 150) return { win: 26, lose: 22 };
  return { win: 30, lose: 25 };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  screenExit: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },

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
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 16,
  },
  dotsWrap: {
    alignItems: "center",
    gap: 8,
  },
  dotsRow: { flexDirection: "row", gap: 10 },
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
    paddingVertical: 12,
    gap: 6,
  },

  vsBadge: {
    alignSelf: "center",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#c0392b",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#c0392b",
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  vsText: { fontSize: 11, fontWeight: "900", color: "#fff" },

  lootCard: {
    backgroundColor: "#fdf3dc",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(200,160,80,0.35)",
    overflow: "hidden",
    shadowColor: "#a07030",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  lootHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(160,112,48,0.1)",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  lootHeaderEmoji: { fontSize: 16 },
  lootTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#7a5a30",
    letterSpacing: 0.8,
  },
  lootDivider: {
    height: 1,
    backgroundColor: "rgba(160,112,48,0.18)",
  },
  trophyRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  trophyHalf: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    gap: 3,
  },
  trophyDividerV: {
    width: 1,
    backgroundColor: "rgba(160,112,48,0.18)",
    marginVertical: 10,
  },
  trophyWinLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7a5a30",
    letterSpacing: 0.5,
  },
  trophyLoseLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7a5a30",
    letterSpacing: 0.5,
  },
  trophyWin: {
    fontSize: 20,
    fontWeight: "900",
    color: "#b87820",
  },
  trophyLose: {
    fontSize: 18,
    fontWeight: "900",
    color: "#c0392b",
  },
  lootPillsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  lootPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(58,30,0,0.06)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(58,30,0,0.1)",
  },
  lootIcon: { width: 22, height: 22, resizeMode: "contain" },
  lootVal: { fontSize: 16, fontWeight: "900" },

  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  reSearchBtnStyle: { flex: 1 },
  fightBtnStyle: { flex: 1 },

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
