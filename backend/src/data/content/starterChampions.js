'use strict';

// Base stats for each champion class — single source of truth for both
// authController.js (registration) and routes/champions.js (auto-create fallback).
const CLASS_STATS = {
  Warrior: { attack: 14, defense:  8, chance:  8, max_hp: 120 },
  Mage:    { attack:  8, defense:  6, chance: 14, max_hp:  80 },
  Archer:  { attack: 10, defense: 10, chance: 12, max_hp: 100 },
};

// The three champions every new player receives.
// name uses { en, tr } for i18n.
const STARTER_CHAMPIONS = [
  { name: { en: 'Oak Warrior',  tr: 'Meşe Savaşçısı' }, class: 'Warrior' },
  { name: { en: 'Forest Mage', tr: 'Orman Büyücüsü' },  class: 'Mage'    },
  { name: { en: 'Pine Archer', tr: 'Çam Okçusu' },      class: 'Archer'  },
];

module.exports = { CLASS_STATS, STARTER_CHAMPIONS };
