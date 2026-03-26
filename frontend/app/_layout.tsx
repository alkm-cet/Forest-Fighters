import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { getToken } from '../lib/auth';
import music from '../lib/music';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getToken().then(setToken);
    music.play('MAIN_MUSIC');
  }, []);

  useEffect(() => {
    if (token === undefined) return; // still loading

    const inAuthGroup = segments[0] === '(auth)';
    const inGameGroup = segments[0] === '(game)';

    if (!token && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (token && !inGameGroup) {
      router.replace('/(game)/');
    }
  }, [token, segments]);

  return <Slot />;
}
