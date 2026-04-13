import { Audio } from "expo-av";
import SOUNDS, { SoundKey } from "../constants/sounds";

// Singleton background music instance
let bgSound: Audio.Sound | null = null;
let currentBgKey: SoundKey | null = null;

async function initAudio() {
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: false,
    staysActiveInBackground: false,
  });
}

/**
 * Play looping background music.
 * If the same track is already playing, does nothing.
 * Stops any previous track before starting the new one.
 */
async function play(key: SoundKey): Promise<void> {
  if (currentBgKey === key && bgSound) return;

  await stop();
  await initAudio();

  const { sound } = await Audio.Sound.createAsync(SOUNDS[key], {
    shouldPlay: true,
    isLooping: true,
    volume: 0.5,
  });

  bgSound = sound;
  currentBgKey = key;
}

/**
 * Stop and unload the current background music.
 */
async function stop(): Promise<void> {
  if (bgSound) {
    await bgSound.stopAsync();
    await bgSound.unloadAsync();
    bgSound = null;
    currentBgKey = null;
  }
}

/**
 * Play a one-shot sound effect. Fire and forget — auto-unloads when done.
 */
async function sfx(key: SoundKey): Promise<void> {
  await initAudio();
  const { sound } = await Audio.Sound.createAsync(SOUNDS[key], {
    shouldPlay: true,
    volume: 0.8,
  });
  // Unload automatically when playback finishes
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      sound.unloadAsync();
    }
  });
}

/**
 * Play a one-shot SFX `times` times in rapid succession.
 * Each play starts 50ms after the previous — no waiting for the sound to finish.
 * Capped at 10 plays regardless of `times`.
 * Fire and forget — does not block the caller.
 */
function sfxRepeat(key: SoundKey, times: number): void {
  const count = Math.min(Math.max(Math.round(times), 1), 10);
  for (let i = 0; i < count; i++) {
    setTimeout(() => sfx(key), i * 50);
  }
}

const music = { play, stop, sfx, sfxRepeat };
export default music;
