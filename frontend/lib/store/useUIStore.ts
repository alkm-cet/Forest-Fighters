import { create } from 'zustand';
import type { ResourceKey } from '../../types';

// ─── Animation trigger types ──────────────────────────────────────────────────

export type CollectAnimTrigger = {
  farmerId?: string;
  animalId?: string;
  amount: number;
  resourceType: string;
  farmerIndex: number;
  key: number;
} | null;

// ─── Toast ────────────────────────────────────────────────────────────────────

export type Toast = {
  message: string;
  type: 'error' | 'success';
} | null;

// ─── Confirm modals ───────────────────────────────────────────────────────────

export type CapUpgradeConfirm = { resource: ResourceKey } | null;
export type AdvancedCapUpgradeConfirm = { resource: string } | null;
export type CoinConfirmModal = {
  title: string;
  cost: number;
  onConfirm: () => void;
} | null;

// ─── Store type ───────────────────────────────────────────────────────────────

type UIState = {
  // Selected entity IDs (derive full objects from React Query cache at usage site)
  selectedFarmerId: string | null;
  selectedAnimalId: string | null;
  selectedFarmId: string | null;
  selectedChampionId: string | null;

  // Animation triggers
  collectAnim: CollectAnimTrigger;
  animalCollectAnim: CollectAnimTrigger;

  // Tab navigation
  activeTab: 'champions' | 'farmers' | 'animals';
  displayedBg: string;

  // Modals
  capUpgradeConfirm: CapUpgradeConfirm;
  advancedCapUpgradeConfirm: AdvancedCapUpgradeConfirm;

  // Toast / error notification
  toast: Toast;

  // Entity-level locks — key = entityId, value = true while any action is in-flight
  // Plain Record (not Map) so Zustand's shallow equality detects changes
  locks: Record<string, boolean>;

  // ─── Actions ──────────────────────────────────────────────────────────────

  setSelectedFarmerId: (id: string | null) => void;
  setSelectedAnimalId: (id: string | null) => void;
  setSelectedFarmId: (id: string | null) => void;
  setSelectedChampionId: (id: string | null) => void;

  triggerCollectAnim: (anim: CollectAnimTrigger) => void;
  triggerAnimalCollectAnim: (anim: CollectAnimTrigger) => void;

  setActiveTab: (tab: UIState['activeTab']) => void;
  setDisplayedBg: (bg: string) => void;

  setCapUpgradeConfirm: (val: CapUpgradeConfirm) => void;
  setAdvancedCapUpgradeConfirm: (val: AdvancedCapUpgradeConfirm) => void;

  showToast: (message: string, type?: 'error' | 'success') => void;
  dismissToast: () => void;

  // Sets or clears the lock for an entity.
  // Called from mutation onMutate (lock=true) and onSettled (lock=false).
  // Use useUIStore.getState().setLock() inside mutation callbacks (non-hook context).
  setLock: (entityId: string, locked: boolean) => void;
};

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  selectedFarmerId: null,
  selectedAnimalId: null,
  selectedFarmId: null,
  selectedChampionId: null,

  collectAnim: null,
  animalCollectAnim: null,

  activeTab: 'farmers',
  displayedBg: '',

  capUpgradeConfirm: null,
  advancedCapUpgradeConfirm: null,

  toast: null,
  locks: {},

  // ─── Action implementations ──────────────────────────────────────────────

  setSelectedFarmerId: (id) => set({ selectedFarmerId: id }),
  setSelectedAnimalId: (id) => set({ selectedAnimalId: id }),
  setSelectedFarmId: (id) => set({ selectedFarmId: id }),
  setSelectedChampionId: (id) => set({ selectedChampionId: id }),

  triggerCollectAnim: (anim) => set({ collectAnim: anim }),
  triggerAnimalCollectAnim: (anim) => set({ animalCollectAnim: anim }),

  setActiveTab: (tab) => set({ activeTab: tab }),
  setDisplayedBg: (bg) => set({ displayedBg: bg }),

  setCapUpgradeConfirm: (val) => set({ capUpgradeConfirm: val }),
  setAdvancedCapUpgradeConfirm: (val) => set({ advancedCapUpgradeConfirm: val }),

  showToast: (message, type = 'error') => set({ toast: { message, type } }),
  dismissToast: () => set({ toast: null }),

  setLock: (entityId, locked) =>
    set((state) => {
      if (locked) {
        return { locks: { ...state.locks, [entityId]: true } };
      }
      const next = { ...state.locks };
      delete next[entityId];
      return { locks: next };
    }),
}));
