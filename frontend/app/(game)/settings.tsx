import { useEffect, useState } from "react";
import {
  View,
  Switch,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { Text } from "../../components/StyledText";
import { ChevronLeft, Music2, LogOut, Globe } from "lucide-react-native";
import { useRouter } from "expo-router";
import { deleteToken } from "../../lib/auth";
import music from "../../lib/music";
import { isMusicEnabled, setMusicEnabled } from "../../lib/settings";
import { useLanguage, Language } from "../../lib/i18n";

export default function SettingsScreen() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const [musicOn, setMusicOn] = useState(true);

  useEffect(() => {
    isMusicEnabled().then(setMusicOn);
  }, []);

  async function handleMusicToggle(value: boolean) {
    setMusicOn(value);
    await setMusicEnabled(value);
    if (value) {
      music.play("MAIN_MUSIC");
    } else {
      music.stop();
    }
  }

  async function handleLogout() {
    await music.stop();
    await deleteToken();
    router.replace("/(auth)/login");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <ChevronLeft size={28} color="#a8e6a3" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.title}>{t("settings")}</Text>
          <View style={styles.backBtn} />
        </View>

        {/* Settings card */}
        <View style={styles.card}>
          {/* Music row */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Music2 size={20} color="#4a7c3f" strokeWidth={2} />
              <View>
                <Text style={styles.rowLabel}>{t("music")}</Text>
                <Text style={styles.rowSub}>{t("backgroundMusic")}</Text>
              </View>
            </View>
            <Switch
              value={musicOn}
              onValueChange={handleMusicToggle}
              trackColor={{ false: "#ccc", true: "#4caf50" }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.divider} />

          {/* Language row */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Globe size={20} color="#4a7c3f" strokeWidth={2} />
              <Text style={styles.rowLabel}>{t("language")}</Text>
            </View>
            <View style={styles.langToggle}>
              <TouchableOpacity
                style={[
                  styles.langBtn,
                  language === "en" && styles.langBtnActive,
                ]}
                onPress={() => setLanguage("en")}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.langBtnText,
                    language === "en" && styles.langBtnTextActive,
                  ]}
                >
                  EN
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.langBtn,
                  language === "tr" && styles.langBtnActive,
                ]}
                onPress={() => setLanguage("tr")}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.langBtnText,
                    language === "tr" && styles.langBtnTextActive,
                  ]}
                >
                  TR
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={18} color="#e74c3c" strokeWidth={2} />
            <Text style={styles.logoutText}>{t("logout")}</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  backBtn: {
    width: 64,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  rowSub: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginHorizontal: 16,
  },
  langToggle: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#d0d0d0",
    overflow: "hidden",
  },
  langBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f5f5f5",
  },
  langBtnActive: {
    backgroundColor: "#4caf50",
  },
  langBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666",
  },
  langBtnTextActive: {
    color: "#fff",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e74c3c",
  },
});
