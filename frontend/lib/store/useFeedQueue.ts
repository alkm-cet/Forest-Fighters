import { create } from 'zustand';
import type { QueryClient } from '@tanstack/react-query';
import api from '../api';
import { queryKeys } from '../query/queryKeys';
import { optimisticQuestProgress } from '../query/questOptimistic';
import type { Animal, Farm } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type FeedQueueEntry = {
  buffer: number;
  inFlight: boolean;
};

type FeedQueueState = {
  queues: Record<string, FeedQueueEntry>;
  tapFeed: (animal: Animal, queryClient: QueryClient) => void;
  tapFeedMax: (animal: Animal, requested: number, queryClient: QueryClient) => void;
  reset: () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Optimistically increment current_feed for a single animal inside the farms cache.
// Only current_feed is updated — resources are NOT touched (avoids partial-fail desync).
function applyOptimisticFeed(
  queryClient: QueryClient,
  animalId: string,
  delta: number,
) {
  queryClient.setQueryData<Farm[]>(queryKeys.farms(), (old) => {
    if (!old) return old;
    return old.map((farm) => ({
      ...farm,
      animals: farm.animals.map((a) =>
        a.id === animalId
          ? { ...a, current_feed: Math.min(a.current_feed + delta, a.max_feed) }
          : a,
      ),
    }));
  });
}

// ─── Flush function (hoisted declaration — safe to reference inside store closure) ──

async function _flush(
  animalId: string,
  queryClient: QueryClient,
) {
  const state = useFeedQueue.getState();
  const entry = state.queues[animalId];
  if (!entry || entry.inFlight || entry.buffer <= 0) return;

  // Capture the batch size and mark in-flight
  const batchSize = entry.buffer;
  useFeedQueue.setState((s) => ({
    queues: {
      ...s.queues,
      [animalId]: { buffer: 0, inFlight: true },
    },
  }));

  try {
    let res: { data: { animal: Animal } };
    if (batchSize === 1) {
      res = await api.post(`/api/animals/${animalId}/feed`);
    } else {
      res = await api.post(`/api/animals/${animalId}/feed-max`, {
        requestedUnits: batchSize,
      });
    }

    // Write authoritative animal from server
    const serverAnimal = res.data.animal;
    const now = Date.now();
    queryClient.setQueryData<Farm[]>(queryKeys.farms(), (old) => {
      if (!old) return old;
      return old.map((farm) => ({
        ...farm,
        animals: farm.animals.map((a) =>
          a.id === animalId ? { ...serverAnimal, _fetched_at_ms: now } : a,
        ),
      }));
    });

    // Refetch resources immediately so the resource bar reflects the cost right away.
    // Use refetch (not invalidate) to force a network request regardless of mount state.
    queryClient.refetchQueries({ queryKey: queryKeys.resources() });
    queryClient.invalidateQueries({ queryKey: queryKeys.quests() });
  } catch {
    // On network failure: rollback optimistic feed increment, let server state win
    queryClient.invalidateQueries({ queryKey: queryKeys.farms() });
    queryClient.invalidateQueries({ queryKey: queryKeys.resources() });
  } finally {
    useFeedQueue.setState((s) => ({
      queues: {
        ...s.queues,
        [animalId]: { ...s.queues[animalId], inFlight: false },
      },
    }));

    // If more taps arrived while this batch was in-flight, flush again
    const fresh = useFeedQueue.getState().queues[animalId];
    if (fresh && fresh.buffer > 0) {
      _flush(animalId, queryClient);
    }
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useFeedQueue = create<FeedQueueState>((set, get) => ({
  queues: {},

  tapFeed(animal, queryClient) {
    const { queues } = get();
    const entry = queues[animal.id] ?? { buffer: 0, inFlight: false };

    // Reject if animal is already full
    if (animal.current_feed >= animal.max_feed) return;

    // Optimistic: increment fuel bar + quest progress immediately
    applyOptimisticFeed(queryClient, animal.id, 1);
    optimisticQuestProgress(queryClient, 'animal_feed', { animalType: animal.animal_type });

    set({
      queues: {
        ...queues,
        [animal.id]: { ...entry, buffer: entry.buffer + 1 },
      },
    });

    if (!entry.inFlight) {
      _flush(animal.id, queryClient);
    }
  },

  reset: () => set({ queues: {} }),

  tapFeedMax(animal, requested, queryClient) {
    const { queues } = get();
    const entry = queues[animal.id] ?? { buffer: 0, inFlight: false };

    if (requested <= 0) return;

    // Optimistic: increment fuel bar + quest progress (feed-max = 1 feed event)
    applyOptimisticFeed(queryClient, animal.id, requested);
    optimisticQuestProgress(queryClient, 'animal_feed', { animalType: animal.animal_type });

    set({
      queues: {
        ...queues,
        [animal.id]: { ...entry, buffer: entry.buffer + requested },
      },
    });

    if (!entry.inFlight) {
      _flush(animal.id, queryClient);
    }
  },
}));
