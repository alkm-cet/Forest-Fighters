/**
 * Optimistic quest progress update.
 *
 * Called in the `onMutate` of any mutation that triggers server-side
 * `incrementQuestProgress`. Mirrors the server's metaMatches() and
 * LEAST(progress + amount, target_count) logic so the UI updates
 * before the round-trip completes.
 */
import type { QueryClient } from '@tanstack/react-query';
import type { QuestsResponse, PlayerQuest } from '../../types';
import { queryKeys } from './queryKeys';

type Meta = {
  resourceType?: string;
  animalType?: string;
  championClass?: string;
  isBoss?: boolean;
  stars?: number;
  amount?: number;
};

function metaMatchesFE(questMeta: Record<string, any>, callMeta: Meta): boolean {
  if (!questMeta || Object.keys(questMeta).length === 0) return true;
  if (questMeta.resourceType  && questMeta.resourceType  !== callMeta.resourceType)  return false;
  if (questMeta.championClass && questMeta.championClass !== callMeta.championClass) return false;
  if (questMeta.animalType    && questMeta.animalType    !== callMeta.animalType)    return false;
  if (questMeta.isBoss        && !callMeta.isBoss)                                   return false;
  if (questMeta.minStars !== undefined && (callMeta.stars ?? 0) < questMeta.minStars) return false;
  return true;
}

export function optimisticQuestProgress(
  queryClient: QueryClient,
  actionKey: string,
  meta: Meta = {},
): void {
  const increment = (typeof meta.amount === 'number' && meta.amount > 0) ? meta.amount : 1;

  queryClient.setQueryData<QuestsResponse>(queryKeys.quests(), (old) => {
    if (!old) return old;

    function applyToList(list: PlayerQuest[]): PlayerQuest[] {
      return list.map((q) => {
        if (q.status !== 'in_progress') return q;
        if (q.action_key !== actionKey) return q;
        if (!metaMatchesFE(q.metadata ?? {}, meta)) return q;

        const newProgress = Math.min(q.progress + increment, q.target_count);
        const newStatus = newProgress >= q.target_count ? 'completed' : 'in_progress';
        return { ...q, progress: newProgress, status: newStatus };
      });
    }

    return {
      ...old,
      daily:  applyToList(old.daily),
      weekly: applyToList(old.weekly),
    };
  });
}

export function optimisticQuestClaim(
  queryClient: QueryClient,
  questId: string,
): void {
  queryClient.setQueryData<QuestsResponse>(queryKeys.quests(), (old) => {
    if (!old) return old;

    function applyToList(list: PlayerQuest[]): PlayerQuest[] {
      return list.map((q) =>
        q.id === questId ? { ...q, status: 'claimed' as const } : q,
      );
    }

    const newDaily  = applyToList(old.daily);
    const newWeekly = applyToList(old.weekly);

    // Also update dailyBonus claimed_count
    const dailyClaimedCount = newDaily.filter(q => q.status === 'claimed').length;

    return {
      ...old,
      daily:  newDaily,
      weekly: newWeekly,
      dailyBonus: {
        ...old.dailyBonus,
        claimed_count: dailyClaimedCount,
      },
    };
  });
}
