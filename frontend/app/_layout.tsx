import { useEffect, useCallback } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import music from "../lib/music";
import { isMusicEnabled } from "../lib/settings";
import { LanguageProvider } from "../lib/i18n";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { GameDataProvider } from "../lib/game-data-context";
import { CoinConfirmProvider } from "../lib/coin-confirm-context";
import { queryClient } from "../lib/query/queryClient";

SplashScreen.preventAutoHideAsync();

// Handles redirect logic — must be inside AuthProvider to use useAuth()
function AuthGuard() {
  const { token } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (token === undefined) return; // still loading from storage

    const inAuthGroup = segments[0] === "(auth)";
    const inGameGroup = segments[0] === "(game)";
    const inSplash = segments[0] === undefined;
    const inLoading = segments[0] === "loading";

    if (inSplash) return;   // splash handles its own navigation
    if (inLoading) return;  // loading screen handles its own navigation

    if (!token && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (token && !inGameGroup) {
      router.replace("/(game)/");
    }
  }, [token, segments]);

  return <Slot />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Fredoka-Light": require("../assets/fonts/Fredoka/static/fredoka_light.ttf"),
    "Fredoka-Regular": require("../assets/fonts/Fredoka/static/fredoka_regular.ttf"),
    "Fredoka-Medium": require("../assets/fonts/Fredoka/static/fredoka_medium.ttf"),
    "Fredoka-SemiBold": require("../assets/fonts/Fredoka/static/fredoka_semibold.ttf"),
    "Fredoka-Bold": require("../assets/fonts/Fredoka/static/fredoka_bold.ttf"),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    isMusicEnabled().then((enabled) => {
      if (enabled) music.play("MAIN_MUSIC");
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded) onLayoutRootView();
  }, [fontsLoaded, onLayoutRootView]);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <LanguageProvider>
          <AuthProvider>
            <GameDataProvider>
              <CoinConfirmProvider>
                <AuthGuard />
              </CoinConfirmProvider>
            </GameDataProvider>
          </AuthProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
