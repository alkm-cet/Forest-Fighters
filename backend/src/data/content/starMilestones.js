'use strict';

// Adventure dungeon star milestone rewards.
// label uses { en, tr } for i18n.
const STAR_MILESTONES = [
  { required_stars: 10, reward_coins: 50,  label: { en: 'First Explorer',  tr: 'İlk Kaşif' } },
  { required_stars: 25, reward_coins: 150, label: { en: 'Dungeon Delver',  tr: 'Zindan Gezgini' } },
  { required_stars: 45, reward_coins: 300, label: { en: 'Champion',        tr: 'Şampiyon' } },
];

module.exports = { STAR_MILESTONES };
