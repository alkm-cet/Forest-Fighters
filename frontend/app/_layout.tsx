import { useEffect, useState, useCallback } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { getToken } from "../lib/auth";
import music from "../lib/music";
import { isMusicEnabled } from "../lib/settings";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [token, setToken] = useState<string | null | undefined>(undefined);

  const [fontsLoaded] = useFonts({
    "Fredoka-Light": require("../assets/fonts/Fredoka/static/Fredoka-Light.ttf"),
    "Fredoka-Regular": require("../assets/fonts/Fredoka/static/Fredoka-Regular.ttf"),
    "Fredoka-Medium": require("../assets/fonts/Fredoka/static/Fredoka-Medium.ttf"),
    "Fredoka-SemiBold": require("../assets/fonts/Fredoka/static/Fredoka-SemiBold.ttf"),
    "Fredoka-Bold": require("../assets/fonts/Fredoka/static/Fredoka-Bold.ttf"),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    getToken().then(setToken);
    isMusicEnabled().then((enabled) => {
      if (enabled) music.play("MAIN_MUSIC");
    });
  }, []);

  useEffect(() => {
    if (token === undefined) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inGameGroup = segments[0] === "(game)";

    if (!token && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (token && !inGameGroup) {
      router.replace("/(game)/");
    }
  }, [token, segments]);

  useEffect(() => {
    if (fontsLoaded) {
      onLayoutRootView();
    }
  }, [fontsLoaded, onLayoutRootView]);

  if (!fontsLoaded) return null;

  return <Slot />;
}
