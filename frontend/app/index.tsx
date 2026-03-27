import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Image } from "react-native";
import { useRouter } from "expo-router";
import { getToken } from "../lib/auth";

const SplashScreen = () => {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    const navigate = async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const token = await getToken();

      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        if (token) {
          router.replace("/(game)/");
        } else {
          router.replace("/(auth)/login");
        }
      });
    };

    navigate();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim }}>
        <Image
          source={require("../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 200,
    height: 200,
  },
});

export default SplashScreen;
