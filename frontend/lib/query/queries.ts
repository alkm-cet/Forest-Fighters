import { useQuery } from '@tanstack/react-query';
import api from '../api';
import { queryKeys } from './queryKeys';
import { STALE_TIMES } from './queryConfig';
import type { Player, Resources, Champion, Farmer, Farm, DungeonRun, PvpStatus, Recipe, PlayerFood, QuestsResponse, PlayerGear, GearDefinition, AdventureDungeon } from '../../types';

// ─── Player ───────────────────────────────────────────────────────────────────

export function usePlayerQuery() {
  return useQuery({
    queryKey: queryKeys.player(),
    queryFn: () => api.get<Player>('/api/auth/me').then((r) => r.data),
    staleTime: STALE_TIMES.player,
  });
}

// ─── Resources ────────────────────────────────────────────────────────────────

export function useResourcesQuery() {
  return useQuery({
    queryKey: queryKeys.resources(),
    queryFn: () => api.get<Resources>('/api/resources').then((r) => r.data),
    staleTime: STALE_TIMES.resources,
  });
}

// ─── Champions ────────────────────────────────────────────────────────────────

export function useChampionsQuery() {
  return useQuery({
    queryKey: queryKeys.champions(),
    queryFn: () => api.get<Champion[]>('/api/champions').then((r) => r.data),
    staleTime: STALE_TIMES.champions,
  });
}

// ─── Farmers ──────────────────────────────────────────────────────────────────

export function useFarmersQuery() {
  return useQuery({
    queryKey: queryKeys.farmers(),
    queryFn: async () => {
      const now = Date.now();
      const data = await api.get<Farmer[]>('/api/farmers').then((r) => r.data);
      return data.map((f) => ({ ...f, _fetched_at_ms: now }));
    },
    staleTime: STALE_TIMES.farmers,
  });
}

// ─── Farms (contains animals) ─────────────────────────────────────────────────

export function useFarmsQuery() {
  return useQuery({
    queryKey: queryKeys.farms(),
    queryFn: async () => {
      const now = Date.now();
      const data = await api.get<Farm[]>('/api/farms').then((r) => r.data);
      return data.map((farm) => ({
        ...farm,
        animals: (farm.animals ?? []).map((a) => ({ ...a, _fetched_at_ms: now })),
      }));
    },
    staleTime: STALE_TIMES.farms,
  });
}

// ─── Dungeon Runs ─────────────────────────────────────────────────────────────

export function useDungeonRunsQuery() {
  return useQuery({
    queryKey: queryKeys.dungeonRuns(),
    queryFn: () => api.get<DungeonRun[]>('/api/dungeons/runs').then((r) => r.data),
    staleTime: STALE_TIMES.dungeonRuns,
  });
}

// ─── PvP Status ───────────────────────────────────────────────────────────────

export function usePvpStatusQuery() {
  return useQuery({
    queryKey: queryKeys.pvpStatus(),
    queryFn: () => api.get<PvpStatus>('/api/pvp/status').then((r) => r.data),
    staleTime: STALE_TIMES.pvpStatus,
  });
}

// ─── Kitchen Recipes ──────────────────────────────────────────────────────────

export function useKitchenRecipesQuery() {
  return useQuery({
    queryKey: queryKeys.kitchenRecipes(),
    queryFn: () => api.get<Recipe[]>('/api/kitchen/recipes').then((r) => r.data),
    staleTime: STALE_TIMES.kitchenRecipes,
  });
}

// ─── Quests ───────────────────────────────────────────────────────────────────

export function useQuestsQuery() {
  return useQuery({
    queryKey: queryKeys.quests(),
    queryFn: () => api.get<QuestsResponse>('/api/quests').then((r) => r.data),
    staleTime: STALE_TIMES.quests,
  });
}

// ─── Gear Inventory ───────────────────────────────────────────────────────────

export function useGearInventoryQuery() {
  return useQuery({
    queryKey: queryKeys.gearInventory(),
    queryFn: () => api.get<PlayerGear[]>('/api/gear/inventory').then((r) => r.data),
  });
}

// ─── Gear Definitions ─────────────────────────────────────────────────────────

export function useGearDefinitionsQuery() {
  return useQuery({
    queryKey: queryKeys.gearDefinitions(),
    queryFn: () => api.get<GearDefinition[]>('/api/gear/definitions').then((r) => r.data),
    staleTime: Infinity,
  });
}

export function useItemDropDungeonsQuery(definitionId: string | null) {
  return useQuery({
    queryKey: queryKeys.itemDropDungeons(definitionId ?? ''),
    queryFn: () => api.get<AdventureDungeon[]>(`/api/gear/definitions/${definitionId}/dungeons`).then((r) => r.data),
    enabled: !!definitionId,
    staleTime: Infinity,
  });
}

// ─── Kitchen Inventory ────────────────────────────────────────────────────────

export function useKitchenInventoryQuery() {
  return useQuery({
    queryKey: queryKeys.kitchenInventory(),
    queryFn: async () => {
      const now = Date.now();
      const data = await api.get<PlayerFood[]>('/api/kitchen/inventory').then((r) => r.data);
      return data.map((food) => ({ ...food, _fetched_at_ms: now }));
    },
    staleTime: STALE_TIMES.kitchenInventory,
  });
}
