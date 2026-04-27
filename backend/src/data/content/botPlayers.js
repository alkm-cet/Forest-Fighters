'use strict';

// PvP bot player definitions.
// username and champion names use { en, tr } for i18n.
const BOT_PLAYERS = [
  {
    username: { en: 'ForestGuardian', tr: 'OrmanBekçisi' },
    email:    'bot1@bots.internal',
    trophies: 12,
    champions: [
      { name: { en: 'Stone Warrior', tr: 'Taş Savaşçısı' }, class: 'Warrior' },
      { name: { en: 'Ember Mage',    tr: 'Kor Büyücüsü' },   class: 'Mage'    },
    ],
    defIdx: 0,
  },
  {
    username: { en: 'WildHunter',    tr: 'YabanAvcısı' },
    email:    'bot2@bots.internal',
    trophies: 25,
    champions: [
      { name: { en: 'Shadow Archer', tr: 'Gölge Okçusu' }, class: 'Archer'  },
      { name: { en: 'Iron Guard',    tr: 'Demir Muhafız' }, class: 'Warrior' },
    ],
    defIdx: 0,
  },
  {
    username: { en: 'AncientDruid',  tr: 'KadimDruid' },
    email:    'bot3@bots.internal',
    trophies: 55,
    champions: [
      { name: { en: 'Storm Mage',   tr: 'Fırtına Büyücüsü' }, class: 'Mage'   },
      { name: { en: 'Vine Archer',  tr: 'Asma Okçusu' },      class: 'Archer' },
    ],
    defIdx: 0,
  },

  // ── Mid / Late game bots ──────────────────────────────────────────────────

  {
    username: { en: 'IronShield',   tr: 'DemirKalkan' },
    email:    'bot4@bots.internal',
    trophies: 150,
    champions: [
      { name: { en: 'Granite Guard',   tr: 'Granit Muhafız'      }, class: 'Warrior', attack: 18, defense: 16, chance: 10, max_hp: 140 },
      { name: { en: 'Forest Warden',   tr: 'Ormancı Koruyucu'    }, class: 'Archer',  attack: 16, defense: 13, chance: 15, max_hp: 115 },
    ],
    defIdx: 0,
  },
  {
    username: { en: 'StormCaller',  tr: 'FırtınaÇağırıcı' },
    email:    'bot5@bots.internal',
    trophies: 350,
    champions: [
      { name: { en: 'Twilight Mage',   tr: 'Alacakaranlık Büyücüsü' }, class: 'Mage',    attack: 28, defense: 11, chance: 22, max_hp: 105 },
      { name: { en: 'Iron Titan',      tr: 'Demir Titan'             }, class: 'Warrior', attack: 24, defense: 22, chance: 12, max_hp: 160 },
    ],
    defIdx: 1,
  },
  {
    username: { en: 'SilverBlade',  tr: 'GümüşKılıç' },
    email:    'bot6@bots.internal',
    trophies: 600,
    champions: [
      { name: { en: 'Crimson Ranger',  tr: 'Kırmızı Avcı'   }, class: 'Archer',  attack: 35, defense: 25, chance: 22, max_hp: 135 },
      { name: { en: 'Steel Breaker',   tr: 'Çelik Kıran'    }, class: 'Warrior', attack: 38, defense: 28, chance: 14, max_hp: 170 },
    ],
    defIdx: 0,
  },
  {
    username: { en: 'DragonSlayer', tr: 'EjderhaAvcısı' },
    email:    'bot7@bots.internal',
    trophies: 900,
    champions: [
      { name: { en: 'Obsidian Knight', tr: 'Obsidyen Şövalye'  }, class: 'Warrior', attack: 45, defense: 36, chance: 18, max_hp: 190 },
      { name: { en: 'Void Sorcerer',   tr: 'Boşluk Büyücüsü'  }, class: 'Mage',    attack: 48, defense: 18, chance: 30, max_hp: 120 },
    ],
    defIdx: 0,
  },
  {
    username: { en: 'EternalSage',  tr: 'EbediHikmetli' },
    email:    'bot8@bots.internal',
    trophies: 1400,
    champions: [
      { name: { en: 'Celestial Guardian', tr: 'Göksel Koruyucu'    }, class: 'Warrior', attack: 55, defense: 50, chance: 22, max_hp: 210 },
      { name: { en: 'Astral Archmage',    tr: 'Göktaşı Başbüyücüsü'}, class: 'Mage',    attack: 62, defense: 24, chance: 40, max_hp: 140 },
    ],
    defIdx: 0,
  },
];

module.exports = { BOT_PLAYERS };
