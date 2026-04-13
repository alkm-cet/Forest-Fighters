export const STALE_TIMES = {
  player:           2 * 60 * 1000, // 2m
  resources:           30 * 1000,  // 30s — touched by many mutations
  farmers:             60 * 1000,  // 1m  — timer interpolation keeps UI fresh between refetches
  farms:               60 * 1000,  // 1m  — contains nested animals
  champions:        2 * 60 * 1000, // 2m
  dungeonRuns:         30 * 1000,  // 30s — claimable runs need fresh state
  pvpStatus:           30 * 1000,  // 30s
  kitchenRecipes:  10 * 60 * 1000, // 10m — static data
  kitchenInventory:    30 * 1000,  // 30s — cooking timers
} as const;
