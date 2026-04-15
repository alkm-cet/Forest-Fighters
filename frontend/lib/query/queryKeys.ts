// All query keys as factory functions.
// Using static keys (no playerId) because this is a single-user app with JWT auth.
// On logout, call queryClient.clear() to wipe all cached data.
export const queryKeys = {
  player:           () => ['player']               as const,
  resources:        () => ['resources']            as const,
  farmers:          () => ['farmers']              as const,
  farms:            () => ['farms']                as const,
  champions:        () => ['champions']            as const,
  dungeonRuns:      () => ['dungeons', 'runs']     as const,
  pvpStatus:        () => ['pvp', 'status']        as const,
  kitchenRecipes:   () => ['kitchen', 'recipes']   as const,
  kitchenInventory: () => ['kitchen', 'inventory'] as const,
  quests:           () => ['quests']               as const,
} as const;

export type QueryKeys = typeof queryKeys;
