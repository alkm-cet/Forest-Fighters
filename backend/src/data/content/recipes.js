'use strict';

// All kitchen recipes (11 base + 3 warrior defense + 6 attack boosts).
// name uses { en, tr } for i18n.
const RECIPES = [
  // ── T1 — cheap, quick, one-shot fighter boosts + basic farmer buff ─────────
  { name: { en: 'Forest Berry Jam',        tr: 'Orman Meyvesi Reçeli' },        target: 'fighters',     effect_type: 'boost_hp',         effect_value: 8,  dur: null, cook: 3,   ingr: { strawberry: 4, egg: 2 },                             tier: 1 },
  { name: { en: 'Blueberry Mash',          tr: 'Yaban Mersini Ezmesi' },         target: 'fighters',     effect_type: 'boost_chance',      effect_value: 5,  dur: null, cook: 3,   ingr: { blueberry: 4, egg: 2 },                              tier: 1 },
  { name: { en: 'Pinecone Tea',            tr: 'Çam Kozalağı Çayı' },            target: 'farmers',      effect_type: 'boost_production',  effect_value: 25, dur: 20,   cook: 5,   ingr: { pinecone: 4, milk: 2 },                              tier: 1 },
  // ── T2 — stronger one-shot fighter boosts + farmer/farm_animal buffs ──────
  { name: { en: 'Mixed Berry Pie',         tr: 'Karışık Meyveli Pasta' },        target: 'fighters',     effect_type: 'boost_hp',         effect_value: 14, dur: null, cook: 8,   ingr: { strawberry: 8, blueberry: 8, egg: 4 },               tier: 2 },
  { name: { en: 'Egg Forest Rice',         tr: 'Yumurtalı Orman Pilavı' },       target: 'fighters',     effect_type: 'boost_defense',     effect_value: 8,  dur: null, cook: 8,   ingr: { egg: 10, strawberry: 6 },                            tier: 2 },
  { name: { en: 'Pinecone Cake',           tr: 'Çam Kozalağı Pastası' },         target: 'farmers',      effect_type: 'boost_production',  effect_value: 40, dur: 30,   cook: 10,  ingr: { pinecone: 12, milk: 6 },                             tier: 2 },
  { name: { en: 'Forest Stew',             tr: 'Orman Güveci' },                 target: 'farm_animals', effect_type: 'boost_production',  effect_value: 20, dur: 30,   cook: 10,  ingr: { strawberry: 8, pinecone: 8, egg: 5 },                tier: 2 },
  // ── T3 — powerful one-shot fighter boosts + long-duration farm_animal buffs
  { name: { en: 'Magic Forest Soup',       tr: 'Büyülü Orman Çorbası' },         target: 'fighters',     effect_type: 'boost_hp',         effect_value: 20, dur: null, cook: 15,  ingr: { strawberry: 15, blueberry: 12, egg: 8 },             tier: 3 },
  { name: { en: 'Ironbark Stew',           tr: 'Demir Kabuk Güveci' },           target: 'fighters',     effect_type: 'boost_defense',     effect_value: 14, dur: null, cook: 15,  ingr: { egg: 12, wool: 6, strawberry: 8 },                   tier: 3 },
  { name: { en: 'Dragon Pinecone Delight', tr: 'Ejderha Çam Kozalağı Tatlısı' }, target: 'farm_animals', effect_type: 'boost_production',  effect_value: 35, dur: 60,   cook: 20,  ingr: { pinecone: 20, milk: 12, wool: 8 },                   tier: 3 },
  { name: { en: 'Mystic Wool Dessert',     tr: 'Mistik Yün Tatlısı' },           target: 'farm_animals', effect_type: 'boost_capacity',    effect_value: 5,  dur: 45,   cook: 20,  ingr: { wool: 15, milk: 10, blueberry: 10 },                 tier: 3 },

  // ── Warrior defense recipes ────────────────────────────────────────────────
  // 30s cook (0.5 min) — for quick testing; +10 defense for 30 min
  { name: { en: 'Forest Warrior Brew',     tr: 'Orman Savaşçısı İksiri' },       target: 'fighters',     effect_type: 'boost_defense',     effect_value: 10, dur: 30,   cook: 0.5, ingr: { pinecone: 6, egg: 4 },                               tier: 2 },
  // +15 defense for 1 hour
  { name: { en: 'Shield Bark Soup',        tr: 'Kalkan Kabuklu Çorba' },         target: 'fighters',     effect_type: 'boost_defense',     effect_value: 15, dur: 60,   cook: 20,  ingr: { pinecone: 12, egg: 8, wool: 5 },                     tier: 3 },
  // +20 defense for 2 hours
  { name: { en: 'Titanwood Feast',         tr: 'Titan Ağacı Ziyafeti' },         target: 'fighters',     effect_type: 'boost_defense',     effect_value: 20, dur: 120,  cook: 35,  ingr: { pinecone: 20, egg: 14, wool: 10, blueberry: 8 },     tier: 3 },

  // ── Attack boost recipes ───────────────────────────────────────────────────
  { name: { en: 'Wild Berry Tonic',        tr: 'Yabani Meyve Tonisi' },          target: 'fighters',     effect_type: 'boost_attack',      effect_value: 5,  dur: null, cook: 4,   ingr: { strawberry: 4, blueberry: 3 },                       tier: 1 },
  { name: { en: 'Spiced Pinecone Brew',    tr: 'Baharatlı Çam Kozalağı İksiri' }, target: 'fighters',    effect_type: 'boost_attack',      effect_value: 6,  dur: 30,   cook: 6,   ingr: { blueberry: 5, pinecone: 4 },                         tier: 1 },
  { name: { en: 'Battle Berry Stew',       tr: 'Savaş Meyvesi Güveci' },         target: 'fighters',     effect_type: 'boost_attack',      effect_value: 10, dur: null, cook: 10,  ingr: { blueberry: 10, egg: 6, strawberry: 5 },              tier: 2 },
  { name: { en: 'Ironbark Attack Broth',   tr: 'Demir Kabuk Saldırı Suyu' },     target: 'fighters',     effect_type: 'boost_attack',      effect_value: 8,  dur: 45,   cook: 15,  ingr: { pinecone: 10, blueberry: 8, egg: 5 },                tier: 2 },
  { name: { en: "Dragon's Wrath Elixir",   tr: 'Ejderhanın Gazabı İksiri' },     target: 'fighters',     effect_type: 'boost_attack',      effect_value: 18, dur: null, cook: 20,  ingr: { blueberry: 15, egg: 10, wool: 6 },                   tier: 3 },
  { name: { en: 'Ancient Forest Rage',     tr: 'Kadim Orman Öfkesi' },           target: 'fighters',     effect_type: 'boost_attack',      effect_value: 12, dur: 60,   cook: 25,  ingr: { pinecone: 20, blueberry: 12, egg: 8, wool: 4 },      tier: 3 },
];

// Forge stones — upgrade materials for gear.
// These are also recipes in the DB (effect_type = 'gear_upgrade').
const FORGE_STONES = [
  { name: { en: 'Forge Stone',        tr: 'Dövme Taşı' },        tier: 1, cook: 5,  ingr: { pinecone: 5,  blueberry: 3 },                    gear_upgrade_tier: 1 },
  { name: { en: 'Fine Forge Stone',   tr: 'İnce Dövme Taşı' },   tier: 2, cook: 15, ingr: { pinecone: 10, blueberry: 8, egg: 2 },             gear_upgrade_tier: 2 },
  { name: { en: 'Master Forge Stone', tr: 'Usta Dövme Taşı' },   tier: 3, cook: 30, ingr: { pinecone: 20, blueberry: 15, egg: 5, wool: 3 },   gear_upgrade_tier: 3 },
];

module.exports = { RECIPES, FORGE_STONES };
