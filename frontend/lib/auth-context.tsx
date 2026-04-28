import { createContext, useContext, useEffect, useState } from "react";
import { getToken, saveToken, deleteToken } from "./auth";
import { queryClient } from "./query/queryClient";
import { useUIStore } from "./store/useUIStore";
import { useFeedQueue } from "./store/useFeedQueue";

type AuthContextType = {
  token: string | null | undefined; // undefined = still loading
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  token: undefined,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getToken().then(setToken);
  }, []);

  async function signIn(t: string) {
    await saveToken(t);
    setToken(t);
  }

  async function signOut() {
    await queryClient.cancelMutations(); // stop in-flight mutations before clearing cache
    await deleteToken();
    queryClient.clear();
    useUIStore.getState().reset();
    useFeedQueue.getState().reset();
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ token, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
