import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import api from "../../lib/api";
import { deleteToken } from "../../lib/auth";
import { Resources, Champion, Farmer, Player } from "../../types";
import ResourceBar from "../../components/ResourceBar";
import ChampionCard from "../../components/ChampionCard";
import CampfireScene from "../../components/CampfireScene";

const BG = require("../../assets/home-assets/background-image-3.png");

export default function MainScreen() {
  const router = useRouter();

  const [player, setPlayer] = useState<Player | null>(null);
  const [resources, setResources] = useState<Resources>({
    strawberry: 0,
    pinecone: 0,
    blueberry: 0,
  });
  const [champions, setChampions] = useState<Champion[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/api/auth/me").then((r) => setPlayer(r.data)),
      api.get("/api/resources").then((r) => setResources(r.data)),
      api.get("/api/champions").then((r) => setChampions(r.data)),
      api.get("/api/farmers").then((r) => setFarmers(r.data)),
    ]).catch(() => setError(true));
  }, []);

  async function handleLogout() {
    await deleteToken();
    router.replace("/(auth)/login");
  }

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <SafeAreaView style={styles.safeArea}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.playerName}>
            {player ? `🌿 ${player.username}` : "🌿 Forest Fighters"}
          </Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Resource pills */}
        <ResourceBar resources={resources} />

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ Cannot reach server</Text>
          </View>
        )}

        {/* Center — cats around campfire */}
        <View style={styles.centerFill}>
          {champions.length > 0 && <CampfireScene champions={champions} />}
        </View>

        {/* Champion cards row */}
        {champions.length > 0 && (
          <View style={styles.championsRow}>
            {champions.slice(0, 3).map((c) => (
              <ChampionCard key={c.id} champion={c} />
            ))}
          </View>
        )}
      </SafeAreaView>
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
  playerName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  logoutBtn: {
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  logoutText: {
    color: "#fff",
    fontSize: 13,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: "rgba(220,50,50,0.85)",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
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
  championsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
});
