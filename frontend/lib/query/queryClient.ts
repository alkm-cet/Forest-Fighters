import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState, AppStateStatus } from 'react-native';
import { STALE_TIMES } from './queryConfig';

// Wire React Query's focusManager to React Native's AppState so
// refetchOnWindowFocus works when the app comes back from the background.
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    handleFocus(state === 'active');
  });
  return () => subscription.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIMES.resources,
      gcTime: 5 * 60 * 1000,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
      refetchOnWindowFocus: true,  // fires via AppState listener above
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
