import { create } from 'zustand';

import { isMachineItem, type EquipmentItem } from '../equipment/catalog';
import type { MovementGroup } from '../muscles';

/**
 * The Library's plan filters (Phase 31, F): equipment, muscle groups and
 * "30 min or less". Browsing only: they never change the current plan or the
 * profile's equipment, and they are not saved.
 */
type PlanFilterState = {
  /** Null: the profile's own equipment. */
  equipment: EquipmentItem[] | null;
  groups: MovementGroup[];
  short: boolean;
  setEquipment: (items: EquipmentItem[] | null) => void;
  toggleGroup: (g: MovementGroup) => void;
  toggleShort: () => void;
  reset: () => void;
};

export const usePlanFilterStore = create<PlanFilterState>()((set) => ({
  equipment: null,
  groups: [],
  short: false,
  setEquipment: (equipment) => set({ equipment }),
  toggleGroup: (g) =>
    set((s) => ({
      groups: s.groups.includes(g) ? s.groups.filter((x) => x !== g) : [...s.groups, g],
    })),
  toggleShort: () => set((s) => ({ short: !s.short })),
  reset: () => set({ equipment: null, groups: [], short: false }),
}));

const FREE_WEIGHTS = /dumbbell|barbell|kettlebell|plate|ez_bar|trap_bar/;

/** Weights or machines: what "strength" and "muscle" plans need. */
export function hasWeights(items: readonly string[]): boolean {
  return items.some((i) => FREE_WEIGHTS.test(i) || isMachineItem(i));
}
