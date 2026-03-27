import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  MUSIC_ENABLED: "settings_music_enabled",
};

export async function isMusicEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEYS.MUSIC_ENABLED);
  return val === null ? true : val === "true"; // default ON
}

export async function setMusicEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.MUSIC_ENABLED, String(enabled));
}
