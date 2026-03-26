// Central registry for all audio assets.
// Add new sounds here before using them with music.play() or music.sfx().
const SOUNDS = {
  // Background music
  MAIN_MUSIC: require("../assets/music/main-music.mp3"),

  // Sound effects — add here as the game grows
  // WIN_BATTLE:  require("../assets/music/win-battle.mp3"),
  // LOSE_BATTLE: require("../assets/music/lose-battle.mp3"),
  // COLLECT:     require("../assets/music/collect.mp3"),
  // UPGRADE:     require("../assets/music/upgrade.mp3"),
} as const;

export type SoundKey = keyof typeof SOUNDS;
export default SOUNDS;
