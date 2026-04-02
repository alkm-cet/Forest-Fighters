import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  ImageBackground,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Text } from "../components/StyledText";
import { useGameData } from "../lib/game-data-context";

const BG = require("../assets/home-assets/background-image-3.png");

export default function LoadingScreen() {
  const router = useRouter();
  const { loadAll } = useGameData();

  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("Entering the forest…");
  const [hasError, setHasError] = useState(false);

  // Animated width: 0 → 100 (treated as a percentage)
  const progressAnim = useRef(new Animated.Value(0)).current;

  function animateTo(target: number) {
    Animated.timing(progressAnim, {
      toValue: target,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }

  const load = useCallback(async () => {
    setHasError(false);
    setProgress(0);
    setLabel("Entering the forest…");
    progressAnim.setValue(0);

    try {
      await loadAll((pct, stepLabel) => {
        setProgress(pct);
        setLabel(stepLabel);
        animateTo(pct);
      });

      // Snap to 100 % and show "Ready!" before handing off
      animateTo(100);
      setProgress(100);
      setLabel("Ready! 🌲");
      await new Promise<void>((resolve) => setTimeout(resolve, 700));
      router.replace("/(game)/");
    } catch {
      setHasError(true);
      setLabel("Could not reach the server.");
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      {/* Dim overlay so text stays readable */}
      <View style={styles.overlay} />

      <View style={styles.content}>
        {/* Logo */}
        <Image
          source={require("../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Progress track */}
        <View style={styles.trackWrapper}>
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.fill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
            {/* Leaf icon riding the bar */}
            <Animated.View
              style={[
                styles.leafWrapper,
                {
                  left: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            >
              <Text style={styles.leafIcon}>🌿</Text>
            </Animated.View>
          </View>
        </View>

        {/* Percentage */}
        <Text style={styles.pct}>{Math.round(progress)}%</Text>

        {/* Step label */}
        <Text style={styles.stepLabel}>{label}</Text>

        {/* Retry button — only visible on error */}
        {hasError && (
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.8}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  logo: {
    width: 160,
    height: 160,
    marginBottom: 24,
  },
  trackWrapper: {
    width: "100%",
    paddingBottom: 14, // room for the leaf icon below the bar
  },
  track: {
    width: "100%",
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "visible",
    position: "relative",
  },
  fill: {
    height: "100%",
    borderRadius: 7,
    backgroundColor: "#6CC97A",
    shadowColor: "#3d8b4a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  leafWrapper: {
    position: "absolute",
    top: -6,
    marginLeft: -12,
  },
  leafIcon: {
    fontSize: 22,
  },
  pct: {
    fontSize: 28,
    color: "#fff",
    fontFamily: "Fredoka-SemiBold",
    lineHeight: 32,
  },
  stepLabel: {
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Fredoka-Regular",
    textAlign: "center",
    minHeight: 22,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: "#6CC97A",
    borderRadius: 24,
  },
  retryText: {
    color: "#fff",
    fontFamily: "Fredoka-SemiBold",
    fontSize: 16,
  },
});
