// Central registry for all audio assets.
// Add new sounds here before using them with music.play() or music.sfx().
const SOUNDS = {
  // Background music
  MAIN_MUSIC: require("../assets/music/main-music.mp3"),

  // Sound effects
  COLLECT: require("../assets/music/collect-sound.mp3"),

  // Cat meow sounds
  MEOW_1:     require("../assets/music/cat-meow/meow-1.mp3"),
  MEOW_2:     require("../assets/music/cat-meow/meow-2.mp3"),
  MEOW_3:     require("../assets/music/cat-meow/meow-3.mp3"),
  MEOW_ANGRY: require("../assets/music/cat-meow/meow-angry.mp3"),
} as const;

export type SoundKey = keyof typeof SOUNDS;
export default SOUNDS;
