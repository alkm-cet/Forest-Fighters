import { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  SafeAreaView,
  Animated,
  useWindowDimensions,
} from "react-native";
import { Text } from "../../components/StyledText";
import { Leaf, Settings, AlertTriangle, Sprout, Swords } from "lucide-react-native";
import { useRouter } from "expo-router";
import api from "../../lib/api";
import { Resources, Champion, Farmer, Player } from "../../types";
import ResourceBar from "../../components/ResourceBar";
import ChampionCard from "../../components/ChampionCard";
import ChampionDrawer from "../../components/ChampionDrawer";
import FarmerCard from "../../components/FarmerCard";
import FarmerDrawer from "../../components/FarmerDrawer";
import CampfireScene from "../../components/CampfireScene";

const BG = require("../../assets/home-assets/background-image-3.png");

export default function MainScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  const [player, setPlayer] = useState<Player | null>(null);
  const [resources, setResources] = useState<Resources>({
    strawberry: 0,
    pinecone: 0,
    blueberry: 0,
  });
  const [champions, setChampions] = useState<Champion[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(null);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [showFarmers, setShowFarmers] = useState(false);
  const [error, setError] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Promise.all([
      api.get("/api/auth/me").then((r) => setPlayer(r.data)),
      api.get("/api/resources").then((r) => setResources(r.data)),
      api.get("/api/champions").then((r) => setChampions(r.data)),
      api.get("/api/farmers").then((r) => setFarmers(r.data)),
    ]).catch(() => setError(true));
  }, []);

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
              {player ? player.username : "Forest Fighters"}
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
            <Text style={styles.errorText}>Cannot reach server</Text>
          </View>
        )}

        {/* Center — cats around campfire */}
        <View style={styles.centerFill}>
          {champions.length > 0 && <CampfireScene champions={champions} />}
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
                  {showFarmers ? "FARMERS" : "CHAMPIONS"}
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
                  {showFarmers ? "Champions" : "Farmers"}
                </Text>
              </TouchableOpacity>
            </View>

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
                      onPress={setSelectedChampion}
                    />
                  ))}
                </View>

                {/* Farmers row */}
                <View style={[styles.cardsRow, { width: screenWidth }]}>
                  {farmers.slice(0, 3).map((f) => (
                    <FarmerCard
                      key={f.id}
                      farmer={f}
                      onPress={setSelectedFarmer}
                    />
                  ))}
                </View>
              </Animated.View>
            </View>
          </View>
        )}
      </SafeAreaView>

      <ChampionDrawer
        champion={selectedChampion}
        onClose={() => setSelectedChampion(null)}
        onPvp={() => {
          setSelectedChampion(null);
          router.push("/(game)/pvp");
        }}
        onDungeon={() => {
          setSelectedChampion(null);
          router.push("/(game)/dungeons");
        }}
      />

      <FarmerDrawer
        farmer={selectedFarmer}
        onClose={() => setSelectedFarmer(null)}
        onUpgrade={() => {
          // upgrade logic to be wired up
          setSelectedFarmer(null);
        }}
      />
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
});
