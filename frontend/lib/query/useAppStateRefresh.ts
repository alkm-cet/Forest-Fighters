import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

export function useAppStateRefresh() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const previousState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = previousState.current;
      previousState.current = nextState;

      if ((prev === 'background' || prev === 'inactive') && nextState === 'active') {
        queryClient.clear();
        router.replace('/loading');
      }
    });

    return () => subscription.remove();
  }, [queryClient, router]);
}
