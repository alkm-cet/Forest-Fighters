// Central registry for all audio assets.
// Add new sounds here before using them with music.play() or music.sfx().
const SOUNDS = {
  // Background music
  MAIN_MUSIC: require("../assets/music/main-music.mp3"),

  // Sound effects
  COLLECT: require("../assets/music/collect-sound.mp3"),
} as const;

export type SoundKey = keyof typeof SOUNDS;
export default SOUNDS;
