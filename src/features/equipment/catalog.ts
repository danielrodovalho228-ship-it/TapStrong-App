import type { Location } from '../../../supabase/functions/_shared/interview';

/**
 * Detailed equipment (improvements v1, C1): about 60 items in groups. Every
 * exercise lists the exact items it needs; the generator, swap sheet and
 * library filter by the person's own list.
 */
export const EQUIPMENT_GROUPS = {
  benches: [
    'flat_bench',
    'adjustable_bench',
    'squat_rack',
    'pull_up_bar',
    'dip_station',
    'roman_chair',
    'smith_machine',
    'plyo_box',
    'parallettes',
    'landmine',
  ],
  freeWeights: [
    'dumbbells',
    'kettlebells',
    'barbell',
    'ez_bar',
    'trap_bar',
    'weight_plates',
    'medicine_ball',
    'sandbag',
  ],
  cables: ['cable_station', 'cable_crossover', 'lat_pulldown_station', 'seated_row_station'],
  machinesChest: ['chest_press_machine', 'pec_deck'],
  machinesBack: ['row_machine', 'assisted_pull_up_machine', 't_bar_row'],
  machinesLegs: [
    'leg_press',
    'leg_extension_machine',
    'leg_curl_machine',
    'hip_machine',
    'calf_raise_machine',
    'hack_squat',
    'glute_machine',
    'sled',
  ],
  machinesArms: ['preacher_curl_machine', 'triceps_machine'],
  machinesShoulders: ['shoulder_press_machine', 'lateral_raise_machine'],
  machinesAbs: ['ab_crunch_machine', 'captain_chair'],
  accessories: [
    'mini_bands',
    'long_bands',
    'trx',
    'ab_wheel',
    'step',
    'chair',
    'wall',
    'mat',
    'foam_roller',
    'stability_ball',
    'bosu',
    'yoga_block',
    'jump_rope',
    'towel',
  ],
  cardio: ['treadmill', 'exercise_bike', 'rower', 'elliptical', 'stair_climber'],
} as const;

export type EquipmentGroup = keyof typeof EQUIPMENT_GROUPS;

/**
 * What a home usually has (Phase 29, B9): shown first under "Home"; every
 * other item stays in its group under "Gym". Display only: the generator
 * still reads the person's exact list.
 */
export const HOME_ITEMS = [
  'chair',
  'towel',
  'wall',
  'mat',
  'long_bands',
  'mini_bands',
  'dumbbells',
  'kettlebells',
  'step',
  'jump_rope',
  'stability_ball',
  'foam_roller',
  'yoga_block',
] as const satisfies readonly (typeof EQUIPMENT_GROUPS)[EquipmentGroup][number][];
export type EquipmentItem = (typeof EQUIPMENT_GROUPS)[EquipmentGroup][number];
export const ALL_EQUIPMENT: EquipmentItem[] = Object.values(
  EQUIPMENT_GROUPS,
).flat() as EquipmentItem[];
export const isEquipmentItem = (v: string): v is EquipmentItem =>
  (ALL_EQUIPMENT as string[]).includes(v);
export const groupOfItem = (item: EquipmentItem): EquipmentGroup =>
  (Object.keys(EQUIPMENT_GROUPS) as EquipmentGroup[]).find((g) =>
    (EQUIPMENT_GROUPS[g] as readonly string[]).includes(item),
  )!;

const MACHINES = [
  ...EQUIPMENT_GROUPS.machinesChest,
  ...EQUIPMENT_GROUPS.machinesBack,
  ...EQUIPMENT_GROUPS.machinesLegs,
  ...EQUIPMENT_GROUPS.machinesArms,
  ...EQUIPMENT_GROUPS.machinesShoulders,
  ...EQUIPMENT_GROUPS.machinesAbs,
] as EquipmentItem[];

/** Machines and cable stations: what "Machine is taken" is about. */
export const isMachineItem = (q: string) =>
  (MACHINES as string[]).includes(q) ||
  (EQUIPMENT_GROUPS.cables as readonly string[]).includes(q) ||
  ['roman_chair', 'dip_station', 'smith_machine'].includes(q);

/**
 * The old 9 coarse keys (still what the coach interview returns) → items.
 * Old saved answers and interview replies are read through this.
 */
const COARSE: Record<string, EquipmentItem[]> = {
  dumbbells: ['dumbbells'],
  kettlebell: ['kettlebells'],
  barbell: ['barbell', 'squat_rack', 'weight_plates'],
  bench: ['flat_bench', 'adjustable_bench'],
  bands: ['long_bands', 'mini_bands'],
  machines: [...MACHINES, 'exercise_bike', 'rower', 'roman_chair', 'dip_station'],
  cables: ['cable_station', 'cable_crossover', 'lat_pulldown_station', 'seated_row_station'],
  pull_up_bar: ['pull_up_bar'],
  mat: ['mat'],
};

export function normalizeEquipment(list: readonly string[]): EquipmentItem[] {
  // An old answer uses only the coarse keys (and at least one that isn't an item).
  const legacy =
    list.length > 0 && list.every((v) => COARSE[v]) && list.some((v) => !isEquipmentItem(v));
  const out = new Set<EquipmentItem>();
  for (const v of list) {
    if (legacy) COARSE[v].forEach((i) => out.add(i));
    else if (isEquipmentItem(v)) out.add(v);
    else COARSE[v]?.forEach((i) => out.add(i));
  }
  return [...out];
}

/** Presets (C2): what a typical place has. */
export type PresetKey = 'fullGym' | 'smallGym' | 'homeGym' | 'bodyweight' | 'hotel';
export const PRESETS: Record<PresetKey, { location: Location; items: EquipmentItem[] }> = {
  fullGym: { location: 'gym', items: ALL_EQUIPMENT },
  smallGym: {
    location: 'gym',
    items: [
      'flat_bench',
      'adjustable_bench',
      'squat_rack',
      'pull_up_bar',
      'dip_station',
      'dumbbells',
      'kettlebells',
      'barbell',
      'ez_bar',
      'weight_plates',
      'cable_station',
      'lat_pulldown_station',
      'seated_row_station',
      'chest_press_machine',
      'row_machine',
      'leg_press',
      'leg_extension_machine',
      'leg_curl_machine',
      'mini_bands',
      'long_bands',
      'mat',
      'foam_roller',
      'stability_ball',
      'chair',
      'wall',
      'step',
      'treadmill',
      'exercise_bike',
      'rower',
    ],
  },
  homeGym: {
    location: 'home',
    items: [
      'adjustable_bench',
      'flat_bench',
      'pull_up_bar',
      'dumbbells',
      'kettlebells',
      'mini_bands',
      'long_bands',
      'mat',
      'foam_roller',
      'stability_ball',
      'chair',
      'wall',
      'step',
      'towel',
    ],
  },
  bodyweight: { location: 'home', items: ['chair', 'wall', 'mat', 'towel'] },
  hotel: {
    location: 'home',
    items: [
      'dumbbells',
      'adjustable_bench',
      'flat_bench',
      'mat',
      'chair',
      'wall',
      'towel',
      'treadmill',
      'exercise_bike',
    ],
  },
};
export const PRESET_KEYS = Object.keys(PRESETS) as PresetKey[];

/** Which preset a list matches exactly, if any. */
export function presetOf(items: readonly string[], location: string | undefined): PresetKey | null {
  const set = new Set(items);
  return (
    PRESET_KEYS.find(
      (k) =>
        PRESETS[k].location === location &&
        PRESETS[k].items.length === set.size &&
        PRESETS[k].items.every((i) => set.has(i)),
    ) ?? null
  );
}

/**
 * The list an onboarding without a preset ends with (QA R4 P2): the preset
 * matching the place, so Settings → Equipment shows what the profile says.
 */
export function defaultEquipment(location: Location | null | undefined): EquipmentItem[] {
  return location === 'gym' ? PRESETS.fullGym.items : PRESETS.bodyweight.items;
}
