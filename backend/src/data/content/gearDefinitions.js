'use strict';

// All gear definitions. name uses { en, tr } for i18n. All other fields are language-neutral.
const GEAR_DEFINITIONS = [
  // ── Warrior weapons ────────────────────────────────────────────────────────
  { id: 'iron_sword',    name: { en: 'Iron Sword',    tr: 'Demir Kılıç' },     gear_type: 'weapon', class_restriction: 'Warrior', tier: 1, base_attack: 5,  atk_increment: 2, base_defense: 0,  def_increment: 0, base_chance: 0,  chance_increment: 0, emoji: '⚔️' },
  { id: 'steel_axe',     name: { en: 'Steel Axe',     tr: 'Çelik Balta' },     gear_type: 'weapon', class_restriction: 'Warrior', tier: 2, base_attack: 8,  atk_increment: 3, base_defense: 2,  def_increment: 1, base_chance: 0,  chance_increment: 0, emoji: '🪓' },
  { id: 'battle_blade',  name: { en: 'Battle Blade',  tr: 'Savaş Kılıcı' },   gear_type: 'weapon', class_restriction: 'Warrior', tier: 3, base_attack: 12, atk_increment: 5, base_defense: 4,  def_increment: 2, base_chance: 0,  chance_increment: 0, emoji: '🗡️' },
  { id: 'war_hammer',    name: { en: 'War Hammer',    tr: 'Savaş Çekici' },   gear_type: 'weapon', class_restriction: 'Warrior', tier: 1, base_attack: 7,  atk_increment: 3, base_defense: 0,  def_increment: 0, base_chance: 0,  chance_increment: 0, emoji: '🔨' },
  { id: 'shield_sword',  name: { en: 'Shield Sword',  tr: 'Kalkanlı Kılıç' }, gear_type: 'weapon', class_restriction: 'Warrior', tier: 1, base_attack: 3,  atk_increment: 1, base_defense: 3,  def_increment: 1, base_chance: 0,  chance_increment: 0, emoji: '🛡️' },
  { id: 'great_axe',     name: { en: 'Great Axe',     tr: 'Büyük Balta' },    gear_type: 'weapon', class_restriction: 'Warrior', tier: 2, base_attack: 11, atk_increment: 4, base_defense: 0,  def_increment: 0, base_chance: 0,  chance_increment: 0, emoji: '⚒️' },
  { id: 'tower_shield',  name: { en: 'Tower Shield',  tr: 'Kule Kalkan' },    gear_type: 'weapon', class_restriction: 'Warrior', tier: 2, base_attack: 5,  atk_increment: 2, base_defense: 5,  def_increment: 2, base_chance: 0,  chance_increment: 0, emoji: '🔰' },
  { id: 'blood_cleaver', name: { en: 'Blood Cleaver', tr: 'Kan Bıçağı' },     gear_type: 'weapon', class_restriction: 'Warrior', tier: 3, base_attack: 16, atk_increment: 6, base_defense: 0,  def_increment: 0, base_chance: 0,  chance_increment: 0, emoji: '⚔️' },
  { id: 'fortress_blade',name: { en: 'Fortress Blade',tr: 'Kale Kılıcı' },    gear_type: 'weapon', class_restriction: 'Warrior', tier: 3, base_attack: 8,  atk_increment: 3, base_defense: 7,  def_increment: 3, base_chance: 0,  chance_increment: 0, emoji: '🗡️' },

  // ── Mage weapons ───────────────────────────────────────────────────────────
  { id: 'oak_staff',     name: { en: 'Oak Staff',     tr: 'Meşe Asası' },     gear_type: 'weapon', class_restriction: 'Mage',    tier: 1, base_attack: 5,  atk_increment: 2, base_defense: 0,  def_increment: 0, base_chance: 3,  chance_increment: 1, emoji: '🪄' },
  { id: 'crystal_staff', name: { en: 'Crystal Staff', tr: 'Kristal Asa' },    gear_type: 'weapon', class_restriction: 'Mage',    tier: 2, base_attack: 8,  atk_increment: 3, base_defense: 0,  def_increment: 0, base_chance: 5,  chance_increment: 2, emoji: '🔮' },
  { id: 'arcane_orb',    name: { en: 'Arcane Orb',    tr: 'Gizemli Küre' },   gear_type: 'weapon', class_restriction: 'Mage',    tier: 3, base_attack: 12, atk_increment: 5, base_defense: 0,  def_increment: 0, base_chance: 8,  chance_increment: 3, emoji: '🌟' },
  { id: 'ember_wand',    name: { en: 'Ember Wand',    tr: 'Kor Değneği' },    gear_type: 'weapon', class_restriction: 'Mage',    tier: 1, base_attack: 7,  atk_increment: 3, base_defense: 0,  def_increment: 0, base_chance: 0,  chance_increment: 0, emoji: '🔥' },
  { id: 'moon_focus',    name: { en: 'Moon Focus',    tr: 'Ay Odağı' },       gear_type: 'weapon', class_restriction: 'Mage',    tier: 1, base_attack: 2,  atk_increment: 1, base_defense: 0,  def_increment: 0, base_chance: 5,  chance_increment: 2, emoji: '🌕' },
  { id: 'flame_staff',   name: { en: 'Flame Staff',   tr: 'Alev Asası' },     gear_type: 'weapon', class_restriction: 'Mage',    tier: 2, base_attack: 11, atk_increment: 4, base_defense: 0,  def_increment: 0, base_chance: 0,  chance_increment: 0, emoji: '🌋' },
  { id: 'void_lens',     name: { en: 'Void Lens',     tr: 'Boşluk Merceği' }, gear_type: 'weapon', class_restriction: 'Mage',    tier: 2, base_attack: 4,  atk_increment: 1, base_defense: 0,  def_increment: 0, base_chance: 7,  chance_increment: 3, emoji: '🔭' },
  { id: 'inferno_orb',   name: { en: 'Inferno Orb',   tr: 'Cehennem Küresi' },gear_type: 'weapon', class_restriction: 'Mage',    tier: 3, base_attack: 16, atk_increment: 6, base_defense: 0,  def_increment: 0, base_chance: 0,  chance_increment: 0, emoji: '🔮' },
  { id: 'eclipse_staff', name: { en: 'Eclipse Staff', tr: 'Tutulma Asası' },   gear_type: 'weapon', class_restriction: 'Mage',    tier: 3, base_attack: 6,  atk_increment: 2, base_defense: 0,  def_increment: 0, base_chance: 10, chance_increment: 4, emoji: '🌑' },

  // ── Archer weapons ─────────────────────────────────────────────────────────
  { id: 'pine_bow',      name: { en: 'Pine Bow',      tr: 'Çam Yayı' },       gear_type: 'weapon', class_restriction: 'Archer',  tier: 1, base_attack: 5,  atk_increment: 2, base_defense: 0,  def_increment: 0, base_chance: 3,  chance_increment: 1, emoji: '🏹' },
  { id: 'hunter_bow',    name: { en: 'Hunter Bow',    tr: 'Avcı Yayı' },      gear_type: 'weapon', class_restriction: 'Archer',  tier: 2, base_attack: 8,  atk_increment: 3, base_defense: 0,  def_increment: 0, base_chance: 5,  chance_increment: 2, emoji: '🎯' },
  { id: 'shadow_bow',    name: { en: 'Shadow Bow',    tr: 'Gölge Yayı' },     gear_type: 'weapon', class_restriction: 'Archer',  tier: 3, base_attack: 12, atk_increment: 5, base_defense: 0,  def_increment: 0, base_chance: 8,  chance_increment: 3, emoji: '🌙' },
  { id: 'sharp_arrow',   name: { en: 'Sharp Arrow',   tr: 'Keskin Ok' },       gear_type: 'weapon', class_restriction: 'Archer',  tier: 1, base_attack: 7,  atk_increment: 3, base_defense: 0,  def_increment: 0, base_chance: 0,  chance_increment: 0, emoji: '🏹' },
  { id: 'swift_bow',     name: { en: 'Swift Bow',     tr: 'Çevik Yay' },      gear_type: 'weapon', class_restriction: 'Archer',  tier: 1, base_attack: 2,  atk_increment: 1, base_defense: 0,  def_increment: 0, base_chance: 5,  chance_increment: 2, emoji: '💨' },
  { id: 'storm_bow',     name: { en: 'Storm Bow',     tr: 'Fırtına Yayı' },   gear_type: 'weapon', class_restriction: 'Archer',  tier: 2, base_attack: 11, atk_increment: 4, base_defense: 0,  def_increment: 0, base_chance: 0,  chance_increment: 0, emoji: '⛈️' },
  { id: 'phantom_quiver',name: { en: 'Phantom Quiver', tr: 'Hayalet Sadak' },  gear_type: 'weapon', class_restriction: 'Archer',  tier: 2, base_attack: 4,  atk_increment: 1, base_defense: 0,  def_increment: 0, base_chance: 7,  chance_increment: 3, emoji: '👻' },
  { id: 'death_arrow',   name: { en: 'Death Arrow',   tr: 'Ölüm Oku' },       gear_type: 'weapon', class_restriction: 'Archer',  tier: 3, base_attack: 16, atk_increment: 6, base_defense: 0,  def_increment: 0, base_chance: 0,  chance_increment: 0, emoji: '☠️' },
  { id: 'ghost_bow',     name: { en: 'Ghost Bow',     tr: 'Hayalet Yay' },     gear_type: 'weapon', class_restriction: 'Archer',  tier: 3, base_attack: 6,  atk_increment: 2, base_defense: 0,  def_increment: 0, base_chance: 10, chance_increment: 4, emoji: '👁️' },

  // ── Universal charms ───────────────────────────────────────────────────────
  { id: 'forest_charm',  name: { en: 'Forest Charm',  tr: 'Orman Tılsımı' },  gear_type: 'charm',  class_restriction: null,      tier: 1, base_attack: 0,  atk_increment: 0, base_defense: 4,  def_increment: 2, base_chance: 0,  chance_increment: 0, emoji: '🍀' },
  { id: 'silver_charm',  name: { en: 'Silver Charm',  tr: 'Gümüş Tılsım' },   gear_type: 'charm',  class_restriction: null,      tier: 2, base_attack: 0,  atk_increment: 0, base_defense: 7,  def_increment: 3, base_chance: 3,  chance_increment: 1, emoji: '🪙' },
  { id: 'dragon_charm',  name: { en: 'Dragon Charm',  tr: 'Ejderha Tılsımı' },gear_type: 'charm',  class_restriction: null,      tier: 3, base_attack: 0,  atk_increment: 0, base_defense: 10, def_increment: 4, base_chance: 6,  chance_increment: 2, emoji: '🐉' },
  { id: 'bone_charm',    name: { en: 'Bone Charm',    tr: 'Kemik Tılsımı' },   gear_type: 'charm',  class_restriction: null,      tier: 1, base_attack: 0,  atk_increment: 0, base_defense: 2,  def_increment: 1, base_chance: 2,  chance_increment: 1, emoji: '🦴' },
  { id: 'ember_charm',   name: { en: 'Ember Charm',   tr: 'Kor Tılsımı' },     gear_type: 'charm',  class_restriction: null,      tier: 1, base_attack: 3,  atk_increment: 1, base_defense: 0,  def_increment: 0, base_chance: 0,  chance_increment: 0, emoji: '🌿' },
  { id: 'storm_charm',   name: { en: 'Storm Charm',   tr: 'Fırtına Tılsımı' }, gear_type: 'charm',  class_restriction: null,      tier: 2, base_attack: 0,  atk_increment: 0, base_defense: 4,  def_increment: 2, base_chance: 4,  chance_increment: 2, emoji: '⚡' },
  { id: 'war_charm',     name: { en: 'War Charm',     tr: 'Savaş Tılsımı' },   gear_type: 'charm',  class_restriction: null,      tier: 2, base_attack: 5,  atk_increment: 2, base_defense: 0,  def_increment: 0, base_chance: 0,  chance_increment: 0, emoji: '🪬' },
  { id: 'void_charm',    name: { en: 'Void Charm',    tr: 'Boşluk Tılsımı' },  gear_type: 'charm',  class_restriction: null,      tier: 3, base_attack: 0,  atk_increment: 0, base_defense: 6,  def_increment: 2, base_chance: 6,  chance_increment: 3, emoji: '🌌' },
  { id: 'titan_charm',   name: { en: 'Titan Charm',   tr: 'Titan Tılsımı' },   gear_type: 'charm',  class_restriction: null,      tier: 3, base_attack: 8,  atk_increment: 3, base_defense: 0,  def_increment: 0, base_chance: 0,  chance_increment: 0, emoji: '🗿' },
];

module.exports = { GEAR_DEFINITIONS };
