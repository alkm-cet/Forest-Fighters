import React, { createContext, useContext, useEffect, useState } from "react";
import api from "./api";
import { useAuth } from "./auth-context";
import { Player, Resources, Champion, Farmer, Animal, Farm, DungeonRun } from "../types";

const DEFAULT_RESOURCES: Resources = {
  strawberry: 0,
  pinecone: 0,
  blueberry: 0,
  strawberry_cap: 10,
  pinecone_cap: 10,
  blueberry_cap: 10,
  egg: 0,
  wool: 0,
  milk: 0,
  egg_cap: 10,
  wool_cap: 10,
  milk_cap: 10,
};

type PvpSnapshot = {
  defenderId: string | null;
  trophies: number;
  league: string;
  unlocked: boolean;
  pendingChampionId: string | null;
  battleEndsAt: string | null;
};

export type GameSnapshot = {
  player: Player | null;
  resources: Resources;
  champions: Champion[];
  farmers: Farmer[];
  animals: Animal[];
  farms: Farm[];
  runMap: Record<string, DungeonRun>;
  pvp: PvpSnapshot;
};

// Each step: { weight contributes to 0-100 total, fetch fn }
const LOAD_STEPS: Array<{
  label: string;
  weight: number;
  fetch: () => Promise<any>;
}> = [
  { label: "Loading player…",       weight: 14, fetch: () => api.get("/api/auth/me").then((r) => r.data) },
  { label: "Fetching resources…",   weight: 15, fetch: () => api.get("/api/resources").then((r) => r.data) },
  { label: "Gathering champions…",  weight: 14, fetch: () => api.get("/api/champions").then((r) => r.data) },
  { label: "Calling farmers…",      weight: 14, fetch: () => api.get("/api/farmers").then((r) => r.data) },
  { label: "Waking up animals…",    weight: 15, fetch: () => api.get("/api/farms").then((r) => r.data) },
  { label: "Scouting dungeons…",    weight: 14, fetch: () => api.get("/api/dungeons/runs").then((r) => r.data) },
  { label: "Preparing battles…",    weight: 14, fetch: () => api.get("/api/pvp/status").then((r) => r.data) },
];

type GameDataContextType = {
  snapshot: GameSnapshot | null;
  loadAll: (onProgress: (pct: number, label: string) => void) => Promise<GameSnapshot>;
  clearSnapshot: () => void;
};

const GameDataContext = createContext<GameDataContextType | null>(null);

export function GameDataProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    if (token === null) setSnapshot(null);
  }, [token]);

  async function loadAll(onProgress: (pct: number, label: string) => void) {
    let cumulative = 0;
    const results: any[] = [];

    for (const step of LOAD_STEPS) {
      onProgress(cumulative, step.label);
      const data = await step.fetch();
      results.push(data);
      cumulative += step.weight;
      onProgress(cumulative, step.label);
    }

    const [playerData, resourcesData, championsData, farmersData, farmsData, runsData, pvpData] =
      results;

    const now = Date.now();

    const runMap: Record<string, DungeonRun> = {};
    for (const run of runsData) {
      if (run.status === "active") runMap[run.champion_id] = run;
    }

    const pending = pvpData.pending_battle ?? null;

    const snap: GameSnapshot = {
      player: playerData,
      resources: resourcesData ?? DEFAULT_RESOURCES,
      champions: championsData ?? [],
      farmers: (farmersData ?? []).map((f: Farmer) => ({ ...f, _fetched_at_ms: now })),
      animals: [],
      farms: (farmsData ?? []).map((farm: Farm) => ({
        ...farm,
        animals: (farm.animals ?? []).map((a: Animal) => ({ ...a, _fetched_at_ms: now })),
      })),
      runMap,
      pvp: {
        defenderId: pvpData.defender_champion_id ?? null,
        trophies: pvpData.trophies ?? 10,
        league: pvpData.league ?? "Bronz",
        unlocked: pvpData.pvp_unlocked ?? false,
        pendingChampionId: pending?.attacker_champion_id ?? null,
        battleEndsAt: pending?.result_available_at ?? null,
      },
    };

    setSnapshot(snap);
    return snap;
  }

  function clearSnapshot() {
    setSnapshot(null);
  }

  return (
    <GameDataContext.Provider value={{ snapshot, loadAll, clearSnapshot }}>
      {children}
    </GameDataContext.Provider>
  );
}

export function useGameData() {
  const ctx = useContext(GameDataContext);
  if (!ctx) throw new Error("useGameData must be used within GameDataProvider");
  return ctx;
}
