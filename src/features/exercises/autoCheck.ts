import { LOCATIONS } from '../../../supabase/functions/_shared/interview';
import { EQUIPMENT_GROUPS, isEquipmentItem, isMachineItem } from '../equipment/catalog';
import type { MovementCatalog } from '../movement/catalog';
import { MUSCLE_KEYS } from '../muscles';
import { CONDITIONS, PAIN_AREAS, POSITIONS } from '../onboarding/options';

import { MOVEMENT_PATTERNS, SESSION_PARTS, type Exercise } from './types';

/**
 * Automated rule check — step 1 of the release workflow (SPEC §2.1). The
 * review tooling records its result as an `auto` review; tests run it over
 * the whole seed library. Returns the list of problems (empty = pass).
 */
export function autoCheck(e: Exercise, catalog?: MovementCatalog): string[] {
  const problems: string[] = [];
  const fail = (msg: string) => problems.push(`${e.slug}: ${msg}`);
  const primaries = e.muscles.filter((m) => m.role === 'primary');

  if (!/^[a-z][a-z0-9_]*$/.test(e.slug)) fail('bad slug');

  // Mapping
  if (e.pattern !== 'breathing' && primaries.length === 0) fail('no primary muscle');
  if (e.pattern === 'breathing' && e.muscles.length) fail('breathing has no muscle mapping');
  const keys = e.muscles.map((m) => m.muscleKey);
  if (new Set(keys).size !== keys.length) fail('muscle listed twice');
  for (const m of e.muscles) {
    if (!MUSCLE_KEYS.includes(m.muscleKey)) fail(`unknown muscle ${m.muscleKey}`);
    if (!(m.emphasis > 0 && m.emphasis <= 1)) fail(`emphasis out of range for ${m.muscleKey}`);
  }
  if (primaries.some((m) => m.emphasis < 0.5)) fail('primary emphasis below 0.5');
  const topPrimary = Math.max(0, ...primaries.map((m) => m.emphasis));
  if (e.muscles.some((m) => m.role !== 'primary' && m.emphasis > topPrimary)) {
    fail('a secondary muscle outweighs the primary');
  }

  // Enumerations
  if (!MOVEMENT_PATTERNS.includes(e.pattern)) fail(`unknown pattern ${e.pattern}`);
  if (!e.parts.length || e.parts.some((p) => !SESSION_PARTS.includes(p))) fail('bad session parts');
  if (!e.location.length || e.location.some((l) => !LOCATIONS.includes(l))) fail('bad location');
  if (e.equipment.some((q) => !isEquipmentItem(q))) fail('unknown equipment');
  if (!e.positions.length || e.positions.some((p) => !POSITIONS.includes(p))) fail('bad positions');
  const knownRisks: string[] = [...PAIN_AREAS, ...CONDITIONS];
  for (const c of e.contraindications) if (!knownRisks.includes(c)) fail(`unknown risk ${c}`);
  if (!(e.level >= 1 && e.level <= 5)) fail('level out of range');

  // Safety rules
  const weights = [
    'dumbbells',
    'barbell',
    'kettlebells',
    'ez_bar',
    'trap_bar',
    'weight_plates',
    'medicine_ball',
    'sandbag',
  ];
  const heavyKit = (q: string) => isMachineItem(q) || q === 'barbell';
  if (e.loaded && !e.equipment.some((q) => weights.includes(q) || isMachineItem(q))) {
    fail('loaded exercise without weights or a machine');
  }
  if (e.minAgeBand === 'kid' && e.equipment.some(heavyKit)) {
    fail('kids cannot use barbells or machines');
  }
  if (e.minAgeBand === 'kid' && e.loaded) fail('kids get no external load');
  if (e.impact === 2) {
    for (const risk of ['knee', 'ankle_foot', 'pregnant_postpartum', 'heart_condition']) {
      if (!e.contraindications.includes(risk)) fail(`high impact must rule out ${risk}`);
    }
  }
  if (e.positions.includes('seated_only') && e.impact > 0)
    fail('seated exercises must be low impact');
  if (
    e.location.length === 1 &&
    e.location[0] === 'gym' &&
    !e.equipment.some(
      (q) => heavyKit(q) || (EQUIPMENT_GROUPS.cardio as readonly string[]).includes(q),
    )
  ) {
    fail('gym-only exercise without gym equipment');
  }

  // Dosing
  const timed: string[] = [
    'warmup_general',
    'warmup_mobility',
    'cooldown_walk',
    'cooldown_stretch',
    'cooldown_breathing',
  ];
  if (e.parts.some((p) => timed.includes(p) && p !== 'warmup_mobility') && e.dose !== 'time') {
    fail('warm-up cardio and cool-down moves are timed');
  }
  if (e.pattern === 'stretch' && e.dose !== 'time') fail('stretches are holds');

  // Joint movements (SPEC §8 "Movement that hurts")
  if (catalog) {
    const seen = new Set<string>();
    for (const t of e.joints) {
      const joint = catalog.joints[t.joint];
      if (!joint) fail(`unknown joint ${t.joint}`);
      else if (!joint.movements.includes(t.movement))
        fail(`unknown movement ${t.joint}.${t.movement}`);
      if (!['full', 'partial', 'isometric'].includes(t.range)) fail(`bad range ${t.range}`);
      const key = `${t.joint}.${t.movement}`;
      if (seen.has(key)) fail(`movement listed twice ${key}`);
      seen.add(key);
    }
    for (const key of e.rangeLimit) {
      const tag = e.joints.find((t) => `${t.joint}.${t.movement}` === key);
      if (!tag) fail(`range limit on a movement it does not use: ${key}`);
      else if (tag.range === 'isometric') fail(`range limit on a hold: ${key}`);
    }
  }
  if (e.rehab && !e.parts.includes('main')) fail('recovery exercise must be main work');
  return problems;
}
