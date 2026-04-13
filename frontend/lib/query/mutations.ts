import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import { queryKeys } from './queryKeys';
import { useUIStore } from '../store/useUIStore';
import type { Farmer, Farm, Animal, Champion, DungeonRun, Resources, Player } from '../../types';

// ─── Shared utility ───────────────────────────────────────────────────────────

// Mirrors calcLivePending in FarmerCard.tsx — estimate collected units at tap time.
function estimateFarmerPending(farmer: Farmer): number {
  const maxCap = 4 + farmer.level;
  if (!farmer._fetched_at_ms || !farmer.interval_minutes || farmer.next_ready_in_seconds == null) {
    return Math.min(farmer.pending ?? 0, maxCap);
  }
  const elapsedSec = (Date.now() - farmer._fetched_at_ms) / 1000;
  const cycleSec = farmer.interval_minutes * 60;
  const rawTimeLeft = Math.max(0, farmer.next_ready_in_seconds - elapsedSec);
  const burned = farmer.next_ready_in_seconds - rawTimeLeft;
  const extraCycles = cycleSec > 0
    ? Math.floor((cycleSec - farmer.next_ready_in_seconds + burned) / cycleSec)
    : 0;
  return Math.min(farmer.pending + extraCycles, maxCap);
}

function updateAnimalInFarms(
  old: Farm[] | undefined,
  animalId: string,
  updater: (a: Animal) => Animal,
): Farm[] {
  return (old ?? []).map((farm) => ({
    ...farm,
    animals: farm.animals.map((a) => (a.id === animalId ? updater(a) : a)),
  }));
}

// ─── Farmer mutations ─────────────────────────────────────────────────────────

export function useCollectFarmerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (farmerId: string) =>
      api.post(`/api/farmers/${farmerId}/collect`).then((r) => r.data),

    onMutate: async (farmerId) => {
      useUIStore.getState().setLock(farmerId, true);

      await queryClient.cancelQueries({ queryKey: queryKeys.farmers() });
      await queryClient.cancelQueries({ queryKey: queryKeys.resources() });

      const prevFarmers = queryClient.getQueryData<Farmer[]>(queryKeys.farmers());
      const prevResources = queryClient.getQueryData<Resources>(queryKeys.resources());

      const farmer = prevFarmers?.find((f) => f.id === farmerId);
      if (farmer && prevResources) {
        const estimated = estimateFarmerPending(farmer);
        const resKey = farmer.resource_type as keyof Resources;
        const capKey = `${farmer.resource_type}_cap` as keyof Resources;
        const current = (prevResources[resKey] as number) ?? 0;
        const cap = (prevResources[capKey] as number) ?? 10;
        const delta = Math.min(estimated, cap - current);

        queryClient.setQueryData<Farmer[]>(queryKeys.farmers(), (old) =>
          (old ?? []).map((f) =>
            f.id === farmerId
              ? {
                  ...f,
                  pending: 0,
                  next_ready_in_seconds: f.interval_minutes * 60,
                  _fetched_at_ms: Date.now(),
                }
              : f,
          ),
        );
        queryClient.setQueryData<Resources>(queryKeys.resources(), (old) =>
          old ? { ...old, [farmer.resource_type]: Math.min(current + delta, cap) } : old,
        );
      }

      return { prevFarmers, prevResources };
    },

    onError: (_err, _farmerId, context) => {
      if (context?.prevFarmers) queryClient.setQueryData(queryKeys.farmers(), context.prevFarmers);
      if (context?.prevResources) queryClient.setQueryData(queryKeys.resources(), context.prevResources);
    },

    onSettled: (_data, _err, farmerId) => {
      useUIStore.getState().setLock(farmerId, false);
      queryClient.invalidateQueries({ queryKey: queryKeys.farmers() });
      queryClient.invalidateQueries({ queryKey: queryKeys.resources() });
    },
  });
}

export function useUpgradeFarmerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (farmerId: string) =>
      api.post(`/api/farmers/${farmerId}/upgrade`).then((r) => r.data),

    onMutate: async (farmerId) => {
      useUIStore.getState().setLock(farmerId, true);
      await queryClient.cancelQueries({ queryKey: queryKeys.farmers() });
      await queryClient.cancelQueries({ queryKey: queryKeys.resources() });
      const prevFarmers = queryClient.getQueryData<Farmer[]>(queryKeys.farmers());
      const prevResources = queryClient.getQueryData<Resources>(queryKeys.resources());
      return { prevFarmers, prevResources };
    },

    onError: (_err, _farmerId, context) => {
      if (context?.prevFarmers) queryClient.setQueryData(queryKeys.farmers(), context.prevFarmers);
      if (context?.prevResources) queryClient.setQueryData(queryKeys.resources(), context.prevResources);
    },

    onSuccess: (data, farmerId) => {
      const fresh = { ...data.farmer, _fetched_at_ms: Date.now() };
      queryClient.setQueryData<Farmer[]>(queryKeys.farmers(), (old) =>
        (old ?? []).map((f) => (f.id === farmerId ? fresh : f)),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.resources() });
    },

    onSettled: (_data, _err, farmerId) => {
      useUIStore.getState().setLock(farmerId, false);
    },
  });
}

export function useFillFarmerStorageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (farmerId: string) =>
      api.post('/api/coins/fill-farmer-storage', { farmer_id: farmerId }).then((r) => r.data),

    onMutate: async (farmerId) => {
      useUIStore.getState().setLock(farmerId, true);

      await queryClient.cancelQueries({ queryKey: queryKeys.farmers() });
      await queryClient.cancelQueries({ queryKey: queryKeys.player() });

      const prevFarmers = queryClient.getQueryData<Farmer[]>(queryKeys.farmers());
      const prevPlayer = queryClient.getQueryData<Player>(queryKeys.player());

      const farmer = prevFarmers?.find((f) => f.id === farmerId);
      if (farmer && prevPlayer) {
        const maxCap = 4 + farmer.level;
        const livePending = estimateFarmerPending(farmer);
        const fillAmount = Math.max(0, maxCap - livePending);

        queryClient.setQueryData<Farmer[]>(queryKeys.farmers(), (old) =>
          (old ?? []).map((f) =>
            f.id === farmerId ? { ...f, pending: maxCap, _fetched_at_ms: Date.now() } : f,
          ),
        );
        queryClient.setQueryData<Player>(queryKeys.player(), (old) =>
          old ? { ...old, coins: old.coins - fillAmount } : old,
        );
      }

      return { prevFarmers, prevPlayer };
    },

    onError: (_err, _farmerId, context) => {
      if (context?.prevFarmers) queryClient.setQueryData(queryKeys.farmers(), context.prevFarmers);
      if (context?.prevPlayer) queryClient.setQueryData(queryKeys.player(), context.prevPlayer);
    },

    onSuccess: (data, farmerId) => {
      const fresh = { ...data.farmer, _fetched_at_ms: Date.now() };
      queryClient.setQueryData<Farmer[]>(queryKeys.farmers(), (old) =>
        (old ?? []).map((f) => (f.id === farmerId ? fresh : f)),
      );
      if (data.coins !== undefined) {
        queryClient.setQueryData<Player>(queryKeys.player(), (old) =>
          old ? { ...old, coins: data.coins } : old,
        );
      }
    },

    onSettled: (_data, _err, farmerId) => {
      useUIStore.getState().setLock(farmerId, false);
      queryClient.invalidateQueries({ queryKey: queryKeys.player() });
    },
  });
}

// ─── Animal mutations ─────────────────────────────────────────────────────────

export function useCollectAnimalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (animalId: string) =>
      api.post(`/api/animals/${animalId}/collect`).then((r) => r.data),

    onMutate: async (animalId) => {
      useUIStore.getState().setLock(animalId, true);

      await queryClient.cancelQueries({ queryKey: queryKeys.farms() });
      await queryClient.cancelQueries({ queryKey: queryKeys.resources() });

      const prevFarms = queryClient.getQueryData<Farm[]>(queryKeys.farms());
      const prevResources = queryClient.getQueryData<Resources>(queryKeys.resources());

      // Optimistic: reset pending on the animal
      queryClient.setQueryData<Farm[]>(queryKeys.farms(), (old) =>
        updateAnimalInFarms(old, animalId, (a) => ({
          ...a,
          pending: 0,
          _fetched_at_ms: Date.now(),
        })),
      );

      return { prevFarms, prevResources };
    },

    onError: (_err, _animalId, context) => {
      if (context?.prevFarms) queryClient.setQueryData(queryKeys.farms(), context.prevFarms);
      if (context?.prevResources) queryClient.setQueryData(queryKeys.resources(), context.prevResources);
    },

    onSuccess: (data, animalId) => {
      const fresh = { ...data.animal, _fetched_at_ms: Date.now() };
      queryClient.setQueryData<Farm[]>(queryKeys.farms(), (old) =>
        updateAnimalInFarms(old, animalId, () => fresh),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.resources() });
    },

    onSettled: (_data, _err, animalId) => {
      useUIStore.getState().setLock(animalId, false);
    },
  });
}

export function useUpgradeAnimalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (animalId: string) =>
      api.post(`/api/animals/${animalId}/upgrade`).then((r) => r.data),

    onMutate: async (animalId) => {
      useUIStore.getState().setLock(animalId, true);
      await queryClient.cancelQueries({ queryKey: queryKeys.farms() });
      await queryClient.cancelQueries({ queryKey: queryKeys.resources() });
      const prevFarms = queryClient.getQueryData<Farm[]>(queryKeys.farms());
      const prevResources = queryClient.getQueryData<Resources>(queryKeys.resources());
      return { prevFarms, prevResources };
    },

    onError: (_err, _animalId, context) => {
      if (context?.prevFarms) queryClient.setQueryData(queryKeys.farms(), context.prevFarms);
      if (context?.prevResources) queryClient.setQueryData(queryKeys.resources(), context.prevResources);
    },

    onSuccess: (data, animalId) => {
      const fresh = { ...data.animal, _fetched_at_ms: Date.now() };
      queryClient.setQueryData<Farm[]>(queryKeys.farms(), (old) =>
        updateAnimalInFarms(old, animalId, () => fresh),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.resources() });
    },

    onSettled: (_data, _err, animalId) => {
      useUIStore.getState().setLock(animalId, false);
    },
  });
}

export function useFillAnimalStorageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (animalId: string) =>
      api.post('/api/coins/fill-animal-storage', { animal_id: animalId }).then((r) => r.data),

    onMutate: async (animalId) => {
      useUIStore.getState().setLock(animalId, true);

      await queryClient.cancelQueries({ queryKey: queryKeys.farms() });
      await queryClient.cancelQueries({ queryKey: queryKeys.player() });

      const prevFarms = queryClient.getQueryData<Farm[]>(queryKeys.farms());
      const prevPlayer = queryClient.getQueryData<Player>(queryKeys.player());

      const animal = prevFarms?.flatMap((f) => f.animals).find((a) => a.id === animalId);
      if (animal && prevPlayer) {
        const maxCap = 9 + animal.level;
        const elapsedSec = (Date.now() - (animal._fetched_at_ms ?? Date.now())) / 1000;
        const cycleSec = animal.interval_minutes * 60;
        const rawProgress = animal.progress_minutes * 60 + Math.min(elapsedSec, animal.fuel_remaining_minutes * 60);
        const extraCycles = cycleSec > 0 ? Math.floor(rawProgress / cycleSec) : 0;
        const livePending = Math.min(animal.pending + extraCycles, maxCap);
        const fillAmount = Math.max(0, maxCap - livePending);

        queryClient.setQueryData<Farm[]>(queryKeys.farms(), (old) =>
          updateAnimalInFarms(old, animalId, (a) => ({
            ...a,
            pending: maxCap,
            _fetched_at_ms: Date.now(),
          })),
        );
        queryClient.setQueryData<Player>(queryKeys.player(), (old) =>
          old ? { ...old, coins: old.coins - fillAmount } : old,
        );
      }

      return { prevFarms, prevPlayer };
    },

    onError: (_err, _animalId, context) => {
      if (context?.prevFarms) queryClient.setQueryData(queryKeys.farms(), context.prevFarms);
      if (context?.prevPlayer) queryClient.setQueryData(queryKeys.player(), context.prevPlayer);
    },

    onSuccess: (data, animalId) => {
      const fresh = { ...data.animal, _fetched_at_ms: Date.now() };
      queryClient.setQueryData<Farm[]>(queryKeys.farms(), (old) =>
        updateAnimalInFarms(old, animalId, () => fresh),
      );
      if (data.coins !== undefined) {
        queryClient.setQueryData<Player>(queryKeys.player(), (old) =>
          old ? { ...old, coins: data.coins } : old,
        );
      }
    },

    onSettled: (_data, _err, animalId) => {
      useUIStore.getState().setLock(animalId, false);
      queryClient.invalidateQueries({ queryKey: queryKeys.player() });
    },
  });
}

// ─── Farm mutations ───────────────────────────────────────────────────────────

export function useCollectFarmMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (farmType: string) =>
      api.post(`/api/farms/${farmType}/collect`).then((r) => r.data),

    onMutate: async (farmType) => {
      useUIStore.getState().setLock(`farm:${farmType}`, true);
      await queryClient.cancelQueries({ queryKey: queryKeys.farms() });
      await queryClient.cancelQueries({ queryKey: queryKeys.resources() });
      const prevFarms = queryClient.getQueryData<Farm[]>(queryKeys.farms());
      const prevResources = queryClient.getQueryData<Resources>(queryKeys.resources());
      return { prevFarms, prevResources };
    },

    onError: (_err, _farmType, context) => {
      if (context?.prevFarms) queryClient.setQueryData(queryKeys.farms(), context.prevFarms);
      if (context?.prevResources) queryClient.setQueryData(queryKeys.resources(), context.prevResources);
    },

    onSuccess: (data, farmType) => {
      const now = Date.now();
      const updated: Farm = {
        ...data.farm,
        animals: (data.farm.animals ?? []).map((a: Animal) => ({ ...a, _fetched_at_ms: now })),
      };
      queryClient.setQueryData<Farm[]>(queryKeys.farms(), (old) =>
        (old ?? []).map((f) => (f.farm_type === farmType ? updated : f)),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.resources() });
    },

    onSettled: (_data, _err, farmType) => {
      useUIStore.getState().setLock(`farm:${farmType}`, false);
    },
  });
}

export function useUpgradeFarmMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (farmType: string) =>
      api.post(`/api/farms/${farmType}/upgrade`).then((r) => r.data),

    onMutate: async (farmType) => {
      useUIStore.getState().setLock(`farm:${farmType}`, true);
      await queryClient.cancelQueries({ queryKey: queryKeys.farms() });
      await queryClient.cancelQueries({ queryKey: queryKeys.resources() });
      const prevFarms = queryClient.getQueryData<Farm[]>(queryKeys.farms());
      const prevResources = queryClient.getQueryData<Resources>(queryKeys.resources());
      return { prevFarms, prevResources };
    },

    onError: (_err, _farmType, context) => {
      if (context?.prevFarms) queryClient.setQueryData(queryKeys.farms(), context.prevFarms);
      if (context?.prevResources) queryClient.setQueryData(queryKeys.resources(), context.prevResources);
    },

    onSuccess: (data, farmType) => {
      const now = Date.now();
      const updated: Farm = {
        ...data.farm,
        animals: (data.farm.animals ?? []).map((a: Animal) => ({ ...a, _fetched_at_ms: now })),
      };
      queryClient.setQueryData<Farm[]>(queryKeys.farms(), (old) =>
        (old ?? []).map((f) => (f.farm_type === farmType ? updated : f)),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.resources() });
    },

    onSettled: (_data, _err, farmType) => {
      useUIStore.getState().setLock(`farm:${farmType}`, false);
    },
  });
}

// ─── Champion mutations ───────────────────────────────────────────────────────

export function useHealChampionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (championId: string) =>
      api.post(`/api/champions/${championId}/heal`).then((r) => r.data),

    onMutate: async (championId) => {
      useUIStore.getState().setLock(championId, true);
      await queryClient.cancelQueries({ queryKey: queryKeys.champions() });
      await queryClient.cancelQueries({ queryKey: queryKeys.resources() });
      const prevChampions = queryClient.getQueryData<Champion[]>(queryKeys.champions());
      const prevResources = queryClient.getQueryData<Resources>(queryKeys.resources());
      return { prevChampions, prevResources };
    },

    onError: (_err, _id, context) => {
      if (context?.prevChampions) queryClient.setQueryData(queryKeys.champions(), context.prevChampions);
      if (context?.prevResources) queryClient.setQueryData(queryKeys.resources(), context.prevResources);
    },

    onSuccess: (data, championId) => {
      queryClient.setQueryData<Champion[]>(queryKeys.champions(), (old) =>
        (old ?? []).map((c) => (c.id === championId ? { ...c, current_hp: data.newHp } : c)),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.resources() });
    },

    onSettled: (_data, _err, championId) => {
      useUIStore.getState().setLock(championId, false);
    },
  });
}

export function useReviveChampionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (championId: string) =>
      api.post(`/api/champions/${championId}/revive`).then((r) => r.data),

    onMutate: async (championId) => {
      useUIStore.getState().setLock(championId, true);
      await queryClient.cancelQueries({ queryKey: queryKeys.champions() });
      await queryClient.cancelQueries({ queryKey: queryKeys.resources() });
      const prevChampions = queryClient.getQueryData<Champion[]>(queryKeys.champions());
      const prevResources = queryClient.getQueryData<Resources>(queryKeys.resources());
      return { prevChampions, prevResources };
    },

    onError: (_err, _id, context) => {
      if (context?.prevChampions) queryClient.setQueryData(queryKeys.champions(), context.prevChampions);
      if (context?.prevResources) queryClient.setQueryData(queryKeys.resources(), context.prevResources);
    },

    onSettled: (_data, _err, championId) => {
      useUIStore.getState().setLock(championId, false);
      queryClient.invalidateQueries({ queryKey: queryKeys.champions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.resources() });
    },
  });
}

export function useSpendStatMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ championId, stat }: { championId: string; stat: string }) =>
      api.post(`/api/champions/${championId}/spend-stat`, { stat }).then((r) => r.data),

    onMutate: async ({ championId }) => {
      useUIStore.getState().setLock(championId, true);
      await queryClient.cancelQueries({ queryKey: queryKeys.champions() });
      const prevChampions = queryClient.getQueryData<Champion[]>(queryKeys.champions());
      return { prevChampions };
    },

    onError: (_err, _vars, context) => {
      if (context?.prevChampions) queryClient.setQueryData(queryKeys.champions(), context.prevChampions);
    },

    onSuccess: (data, { championId }) => {
      queryClient.setQueryData<Champion[]>(queryKeys.champions(), (old) =>
        (old ?? []).map((c) => (c.id === championId ? data : c)),
      );
    },

    onSettled: (_data, _err, { championId }) => {
      useUIStore.getState().setLock(championId, false);
    },
  });
}

export function useSetDefenderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (championId: string) =>
      api.post('/api/pvp/set-defender', { champion_id: championId }).then((r) => r.data),

    onMutate: async (championId) => {
      useUIStore.getState().setLock(championId, true);
    },

    onSettled: (_data, _err, championId) => {
      useUIStore.getState().setLock(championId, false);
      queryClient.invalidateQueries({ queryKey: queryKeys.pvpStatus() });
    },
  });
}

export function useCoinReviveChampionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (championId: string) =>
      api.post('/api/coins/revive-champion', { champion_id: championId }).then((r) => r.data),

    onMutate: async (championId) => {
      useUIStore.getState().setLock(championId, true);
      await queryClient.cancelQueries({ queryKey: queryKeys.champions() });
      const prevChampions = queryClient.getQueryData<Champion[]>(queryKeys.champions());
      return { prevChampions };
    },

    onError: (_err, _id, context) => {
      if (context?.prevChampions) queryClient.setQueryData(queryKeys.champions(), context.prevChampions);
    },

    onSuccess: (data, championId) => {
      queryClient.setQueryData<Champion[]>(queryKeys.champions(), (old) =>
        (old ?? []).map((c) => (c.id === championId ? data.champion : c)),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.player() });
    },

    onSettled: (_data, _err, championId) => {
      useUIStore.getState().setLock(championId, false);
    },
  });
}

export function useCoinHealChampionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (championId: string) =>
      api.post('/api/coins/heal-champion', { champion_id: championId }).then((r) => r.data),

    onMutate: async (championId) => {
      useUIStore.getState().setLock(championId, true);
      await queryClient.cancelQueries({ queryKey: queryKeys.champions() });
      const prevChampions = queryClient.getQueryData<Champion[]>(queryKeys.champions());
      return { prevChampions };
    },

    onError: (_err, _id, context) => {
      if (context?.prevChampions) queryClient.setQueryData(queryKeys.champions(), context.prevChampions);
    },

    onSuccess: (data, championId) => {
      queryClient.setQueryData<Champion[]>(queryKeys.champions(), (old) =>
        (old ?? []).map((c) => (c.id === championId ? { ...c, ...data.champion } : c)),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.player() });
    },

    onSettled: (_data, _err, championId) => {
      useUIStore.getState().setLock(championId, false);
    },
  });
}

// ─── Dungeon mutations ────────────────────────────────────────────────────────

export function useClaimRunMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) =>
      api.post(`/api/dungeons/runs/${runId}/claim`).then((r) => r.data),

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resources() });
      queryClient.invalidateQueries({ queryKey: queryKeys.champions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dungeonRuns() });
    },
  });
}

export function useSkipMissionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) =>
      api.post('/api/coins/skip-dungeon', { run_id: runId }).then((r) => r.data),

    onSuccess: (data, _runId) => {
      // The caller updates expiredRunChampions and the run's ends_at
      queryClient.invalidateQueries({ queryKey: queryKeys.player() });
      return data;
    },
  });
}

// ─── Resource cap mutations ───────────────────────────────────────────────────

export function useUpgradeResourceCapMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (resource: string) =>
      api.post('/api/resources/upgrade-capacity', { resource }).then((r) => r.data),

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resources() });
    },
  });
}

export function useUpgradeAnimalStorageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (resource: string) =>
      api.post('/api/animals/upgrade-storage', { resource }).then((r) => r.data),

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resources() });
    },
  });
}
