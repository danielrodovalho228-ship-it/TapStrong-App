/**
 * "Movement that hurts" (SPEC §8): which movements of a joint hurt, mapped to
 * the movements each exercise needs. The catalog is a DRAFT until the
 * certified reviewer signs it off: development builds only (the require sits
 * inside `if (__DEV__)`, release bundles drop it; `npm run bundle:check`).
 */
export const JOINTS = [
  'shoulder',
  'elbow',
  'wrist',
  'neck',
  'lower_back',
  'hip',
  'knee',
  'ankle',
] as const;
export type JointKey = (typeof JOINTS)[number];

/** How an exercise uses a movement: full range, part of it, or a hold without moving. */
export type MovementRange = 'full' | 'partial' | 'isometric';

export type JointMovementTag = { joint: JointKey; movement: string; range: MovementRange };

/** `shoulder.abduction` — how movements are stored in records and range limits. */
export type MovementKey = `${JointKey}.${string}`;
export const movementKey = (joint: JointKey, movement: string): MovementKey =>
  `${joint}.${movement}`;

export type RecoveryPhase = 1 | 2 | 3;

export type JointEntry = {
  /** Pain area of the safety check this joint belongs to. */
  area: string;
  sided: boolean;
  movements: string[];
  /** Muscles each recovery phase strengthens (keys from the muscles table). */
  focus: Record<'1' | '2' | '3', string[]>;
};

export type MovementCatalog = {
  joints: Record<JointKey, JointEntry>;
  redFlags: string[];
  durations: string[];
};

export function movementCatalog(): MovementCatalog | null {
  if (__DEV__) {
    const data = require('../../../supabase/seed/joint_movements.json') as MovementCatalog;
    return data;
  }
  return null;
}

/** Joints that belong to a pain area (elbow / wrist is one area, two joints). */
export function jointsForArea(catalog: MovementCatalog, area: string): JointKey[] {
  return JOINTS.filter((j) => catalog.joints[j].area === area);
}

/** Pain areas the catalog covers, in safety-check order. */
export function catalogAreas(catalog: MovementCatalog): string[] {
  return [...new Set(JOINTS.map((j) => catalog.joints[j].area))];
}
