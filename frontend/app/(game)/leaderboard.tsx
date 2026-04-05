import { useEffect, useState } from "react";
import { useLanguage } from "../../lib/i18n";
import {
  View,
  Image,
  ImageBackground,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Trophy } from "lucide-react-native";
import { Text } from "../../components/StyledText";
import api from "../../lib/api";
import { getLeagueMeta } from "../../constants/leagues";

const BG = require("../../assets/home-assets/background-image-3.png");

type LeaderboardEntry = {
  id: string;
  username: string;
  trophies: number;
  league: string;
  highest_champion_level: number;
};

const MEDALS = ["🥇", "🥈", "🥉"];

const TOP3_BORDER  = ["#f5c400", "#a8a8b8", "#b87040"];
const TOP3_BG      = [
  "rgba(255,243,180,0.98)",
  "rgba(236,236,244,0.97)",
  "rgba(255,234,210,0.97)",
];
const TOP3_GLOW    = [
  "rgba(255,210,0,0.18)",
  "rgba(180,180,200,0.18)",
  "rgba(200,120,50,0.18)",
];

export default function LeaderboardScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/players/leaderboard")
      .then((r) => setEntries(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <ChevronLeft size={20} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
          <Trophy size={20} color="#ffd54f" fill="#ffd54f" strokeWidth={2} />
          <Text style={styles.headerTitle}>{t("leaderboard")}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#ffd54f" size="large" style={{ marginTop: 60 }} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {entries.map((entry, index) => {
              const leagueMeta = getLeagueMeta(entry.trophies);
              const isTop3 = index < 3;

              return (
                <View
                  key={entry.id}
                  style={[
                    styles.card,
                    isTop3 && {
                      borderColor: TOP3_BORDER[index],
                      backgroundColor: TOP3_BG[index],
                      borderWidth: 2.5,
                      shadowColor: TOP3_GLOW[index],
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 1,
                      shadowRadius: 8,
                      elevation: 4,
                    },
                  ]}
                >
                  {/* Rank */}
                  {isTop3 ? (
                    <Text style={[styles.medal, index === 0 && styles.medalFirst]}>
                      {MEDALS[index]}
                    </Text>
                  ) : (
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>{index + 1}</Text>
                    </View>
                  )}

                  {/* League image */}
                  <Image
                    source={leagueMeta.image}
                    style={[styles.leagueImg, isTop3 && styles.leagueImgTop3]}
                    resizeMode="contain"
                  />

                  {/* Name + champion level */}
                  <View style={styles.playerInfo}>
                    <Text
                      style={[styles.username, isTop3 && styles.usernameTop3]}
                      numberOfLines={1}
                    >
                      {entry.username}
                    </Text>
                    <Text style={styles.champLevel}>
                      {t("highestChampLv")} {entry.highest_champion_level}
                    </Text>
                  </View>

                  {/* Trophy pill + league */}
                  <View style={styles.trophyBlock}>
                    <View style={styles.trophyPill}>
                      <Trophy size={12} color="#ffd54f" fill="#ffd54f" strokeWidth={2} />
                      <Text style={styles.trophyCount}>{entry.trophies}</Text>
                    </View>
                    <Text style={[styles.leagueLabel, { color: leagueMeta.color }]}>
                      {leagueMeta.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  safe: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#fff",
    fontFamily: "Fredoka-Bold",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  list: {
    paddingHorizontal: 14,
    paddingBottom: 32,
    gap: 8,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(245,233,204,0.92)",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#c8a96e",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  /* Top 3 rank medal */
  medal: {
    fontSize: 26,
    lineHeight: 30,
    width: 34,
    textAlign: "center",
  },
  medalFirst: {
    fontSize: 30,
    lineHeight: 34,
  },

  /* Regular rank badge (4th+) */
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#b0906a",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  rankText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#7a5030",
    fontFamily: "Fredoka-Bold",
  },

  /* League image */
  leagueImg: {
    width: 42,
    height: 42,
  },
  leagueImgTop3: {
    width: 52,
    height: 52,
  },

  /* Player info */
  playerInfo: {
    flex: 1,
    gap: 2,
  },
  username: {
    fontSize: 14,
    fontWeight: "800",
    color: "#3a1e00",
    fontFamily: "Fredoka-Bold",
  },
  usernameTop3: {
    fontSize: 15,
    color: "#2a1000",
  },
  champLevel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7a5030",
    fontFamily: "Fredoka-Regular",
  },

  /* Trophy */
  trophyBlock: {
    alignItems: "flex-end",
    gap: 4,
  },
  trophyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(30,15,0,0.55)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  trophyCount: {
    fontSize: 14,
    fontWeight: "900",
    color: "#ffd54f",
    fontFamily: "Fredoka-Bold",
  },
  leagueLabel: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Fredoka-Bold",
  },
});
