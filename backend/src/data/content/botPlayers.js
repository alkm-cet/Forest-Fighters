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
];

module.exports = { BOT_PLAYERS };
