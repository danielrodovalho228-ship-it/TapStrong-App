import type { Exercise, SessionPart } from '../exercises/types';
import { muscleByKey, muscleFamily, type MovementGroup } from '../muscles';
import { defaultMuscleGoal, type MuscleGoal } from '../onboarding/options';
import type { AppMode } from '../profile/age';

import { doseFor, estimateSeconds } from './dosage';
import { emphasisOn, rangeFor, safePool, userLevel } from './filters';
import type {
  GeneratedSession,
  GeneratorInput,
  GeneratorNote,
  ItemPart,
  SessionItem,
} from './types';

// ---------------------------------------------------------------------------
// Warm-up & cool-down budget — SPEC §8 table. "Only 15 min" shrinks them to
// no less than 3 and 2 minutes; they are never removed.
// ---------------------------------------------------------------------------

const BASE_MINUTES: Record<AppMode, [warmup: number, cooldown: number]> = {
  child: [5, 3],
  teen: [5, 4],
  adult: [6, 5],
  senior: [9, 6],
};
export const MIN_WARMUP = 3;
export const MIN_COOLDOWN = 2;

export function warmupCooldownMinutes(mode: AppMode, minutes: number) {
  const [warmup, cooldown] = BASE_MINUTES[mode];
  if (minutes >= 30) return { warmup, cooldown };
  const scale = minutes / 30;
  return {
    warmup: Math.max(MIN_WARMUP, Math.round(warmup * scale)),
    cooldown: Math.max(MIN_COOLDOWN, Math.round(cooldown * scale)),
  };
}

// ---------------------------------------------------------------------------
// Candidate ranking (shared with swaps)
// ---------------------------------------------------------------------------

type Target = { muscle: string; family: string[]; goal: MuscleGoal };

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function goalFit(e: Exercise, goal: MuscleGoal, mode: AppMode): number {
  const minor = mode === 'child' || mode === 'teen';
  switch (goal) {
    case 'grow':
    case 'strengthen':
      return minor ? (e.loaded ? 0 : 1) : e.loaded ? 1 : 0;
    case 'balance':
      return e.pattern === 'balance' ? 2 : e.unilateral ? 1 : 0;
    case 'mobility':
      return e.pattern === 'mobility' || e.pattern === 'stretch' ? 1 : 0;
    case 'firm':
      return 0;
  }
}

const MOBILITY_PARTS: SessionPart[] = ['finisher_mobility', 'cooldown_stretch', 'warmup_mobility'];

/**
 * Under 18, bodyweight and bands come first; light dumbbells only when they
 * are clearly the best fit (Daniel, Sep 28 2026). An unloaded option gets this
 * bonus (in tenths of emphasis), so a loaded one wins only when it is at least
 * 0.3 more specific to the muscle.
 */
const MINOR_UNLOADED_BONUS = 2;

/** Main-work candidates for a target muscle, best first. Deterministic. */
export function rankForTarget(pool: Exercise[], target: Target, mode: AppMode): Exercise[] {
  const level = userLevel(mode);
  const minor = mode === 'child' || mode === 'teen';
  return pool
    .filter((e) => emphasisOn(e, target.family, 'primary') > 0)
    .filter((e) =>
      target.goal === 'mobility'
        ? e.parts.some((p) => MOBILITY_PARTS.includes(p))
        : e.parts.includes('main'),
    )
    .map((e) => ({
      e,
      emphasis:
        Math.round(emphasisOn(e, target.family, 'primary') * 10) +
        (minor && !e.loaded ? MINOR_UNLOADED_BONUS : 0),
      fit: goalFit(e, target.goal, mode),
      distance: Math.abs(e.level - level),
    }))
    .sort(
      (a, b) =>
        b.emphasis - a.emphasis ||
        b.fit - a.fit ||
        a.distance - b.distance ||
        byText(a.e.slug, b.e.slug),
    )
    .map((x) => x.e);
}

const COMPOUND: Record<MovementGroup, string[]> = {
  push: ['horizontal_push', 'vertical_push'],
  pull: ['horizontal_pull', 'vertical_pull'],
  legs: ['squat', 'hinge', 'lunge'],
  core: ['core_stability'],
};

function groupOf(muscle: string): MovementGroup | undefined {
  return muscleByKey(muscle)?.movementGroup;
}

function topPrimary(e: Exercise): string | null {
  const primaries = e.muscles.filter((m) => m.role === 'primary');
  if (!primaries.length) return null;
  return [...primaries].sort(
    (a, b) => b.emphasis - a.emphasis || byText(a.muscleKey, b.muscleKey),
  )[0].muscleKey;
}

function rankForGroup(
  pool: Exercise[],
  group: MovementGroup,
  goal: MuscleGoal,
  mode: AppMode,
): Exercise[] {
  const level = userLevel(mode);
  return pool
    .filter((e) => e.parts.includes('main'))
    .filter((e) => {
      const top = topPrimary(e);
      return top !== null && groupOf(top) === group;
    })
    .map((e) => ({
      e,
      compound: COMPOUND[group].includes(e.pattern) ? 1 : 0,
      emphasis: Math.round(Math.max(...e.muscles.map((m) => m.emphasis)) * 10),
      fit: goalFit(e, goal, mode),
      distance: Math.abs(e.level - level),
    }))
    .sort(
      (a, b) =>
        b.compound - a.compound ||
        b.fit - a.fit ||
        b.emphasis - a.emphasis ||
        a.distance - b.distance ||
        byText(a.e.slug, b.e.slug),
    )
    .map((x) => x.e);
}

// ---------------------------------------------------------------------------
// Balance pass — SPEC §8: never more than 2 hard sessions in a row on the same
// muscle; keep push/pull/legs roughly balanced over the week.
// ---------------------------------------------------------------------------

function hitIn(session: { mainMuscles: string[] } | undefined, family: string[]): boolean {
  return !!session && family.some((k) => session.mainMuscles.includes(k));
}

function groupsTrainedThisWeek(input: GeneratorInput): Set<MovementGroup> {
  const recent = input.recentSessions ?? [];
  const today = input.today ?? recent[0]?.date;
  const out = new Set<MovementGroup>();
  if (!today) return out;
  const cutoff = Date.parse(today) - 6 * 24 * 3600 * 1000;
  for (const s of recent) {
    if (Date.parse(s.date) < cutoff) continue;
    for (const m of s.mainMuscles) {
      const g = groupOf(m);
      if (g) out.add(g);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function timedItem(
  e: Exercise,
  role: SessionItem['role'],
  part: ItemPart,
  durationSeconds: number,
): SessionItem {
  return {
    id: '',
    role,
    part,
    exerciseId: e.id,
    targetMuscle: null,
    goal: null,
    sets: 1,
    durationSeconds,
    restSeconds: 0,
    perSide: false,
    loadHint: null,
    estSeconds: durationSeconds,
  };
}

export function mainItem(
  e: Exercise,
  target: Target,
  input: Pick<GeneratorInput, 'mode' | 'setsPerExercise'>,
): SessionItem {
  const dose = doseFor(target.goal, input.mode, e, input.setsPerExercise);
  return {
    id: '',
    role: 'main',
    part: 'main',
    exerciseId: e.id,
    targetMuscle: target.muscle,
    goal: target.goal,
    sets: dose.sets,
    reps: dose.reps,
    holdSeconds: dose.holdSeconds,
    restSeconds: dose.restSeconds,
    perSide: dose.perSide,
    loadHint: dose.loadHint,
    estSeconds: estimateSeconds(dose),
  };
}

function supportedFirst(e: Exercise): number {
  return e.positions.includes('seated_only') || e.positions.includes('with_support') ? 1 : 0;
}

function pickGeneralWarmup(pool: Exercise[], mode: AppMode): Exercise | undefined {
  const young = mode === 'child' || mode === 'teen';
  return pool
    .filter((e) => e.parts.includes('warmup_general'))
    .sort(
      (a, b) =>
        (mode === 'senior' ? supportedFirst(b) - supportedFirst(a) : 0) ||
        // Game-like, livelier moves for young users; gentlest first otherwise.
        (young ? b.impact - a.impact : a.impact - b.impact) ||
        a.level - b.level ||
        byText(a.slug, b.slug),
    )[0];
}

function pickByOverlap(
  pool: Exercise[],
  part: SessionPart,
  muscles: string[],
  mode: AppMode,
  used: Set<string>,
): Exercise[] {
  return pool
    .filter((e) => e.parts.includes(part) && !used.has(e.id))
    .map((e) => ({
      e,
      overlap: e.muscles.filter((m) => muscles.includes(m.muscleKey)).length,
    }))
    .sort(
      (a, b) =>
        (mode === 'senior' ? supportedFirst(b.e) - supportedFirst(a.e) : 0) ||
        b.overlap - a.overlap ||
        byText(a.e.slug, b.e.slug),
    )
    .map((x) => x.e);
}

// ---------------------------------------------------------------------------
// generateSession
// ---------------------------------------------------------------------------

export function generateSession(input: GeneratorInput): GeneratedSession {
  const pool = safePool(input);
  const minutes = Math.max(10, Math.min(120, Math.round(input.minutes)));
  const { warmup, cooldown } = warmupCooldownMinutes(input.mode, minutes);
  const notes: GeneratorNote[] = [];
  const base = { minutes, warmupMinutes: warmup, cooldownMinutes: cooldown, notes };
  const fail = (error: GeneratedSession['error']): GeneratedSession => ({
    ...base,
    items: [],
    estimatedMinutes: 0,
    error,
  });

  if (!pool.length) return fail('no_library');

  // --- Main work -----------------------------------------------------------
  const recent = input.recentSessions ?? [];
  const defaultGoal = defaultMuscleGoal(input.mainGoals);
  const allTargets: Target[] = input.muscleGoals.map((g) => ({
    muscle: g.muscleKey,
    family: muscleFamily(g.muscleKey),
    goal: g.goal,
  }));
  const rested = allTargets.filter((t) => hitIn(recent[0], t.family) && hitIn(recent[1], t.family));
  if (rested.length)
    notes.push({ key: 'generator.notes.rested', muscles: rested.map((t) => t.muscle) });
  const targets = allTargets.filter((t) => !rested.includes(t));

  const slots = Math.max(1, Math.min(10, Math.round(input.exercisesPerSession)));
  const selectedGroups = new Set(targets.map((t) => groupOf(t.muscle)).filter(Boolean));
  const trained = groupsTrainedThisWeek(input);
  const big: MovementGroup[] = ['push', 'pull', 'legs'];
  const missing = targets.length
    ? big.filter((g) => !selectedGroups.has(g) && !trained.has(g))
    : [...big, 'core' as const];
  const complementSlots = targets.length
    ? Math.min(missing.length, Math.max(0, slots - 1))
    : Math.min(missing.length, slots);
  const targetSlots = slots - complementSlots;

  const used = new Set<string>();
  const main: SessionItem[] = [];
  // Round-robin by priority: every target gets one exercise before any gets two.
  for (let pass = 0; main.length < targetSlots && targets.length; pass++) {
    const before = main.length;
    for (const target of targets) {
      if (main.length >= targetSlots) break;
      const pick = rankForTarget(pool, target, input.mode).find((e) => !used.has(e.id));
      if (!pick) continue;
      used.add(pick.id);
      main.push(mainItem(pick, target, input));
    }
    if (main.length === before) break;
  }

  const added: MovementGroup[] = [];
  for (const group of missing.slice(0, complementSlots)) {
    const pick = rankForGroup(pool, group, defaultGoal, input.mode).find((e) => !used.has(e.id));
    if (!pick) continue;
    used.add(pick.id);
    const muscle = topPrimary(pick)!;
    main.push(mainItem(pick, { muscle, family: [muscle], goal: defaultGoal }, input));
    added.push(group);
  }
  if (targets.length && added.length) notes.push({ key: 'generator.notes.balance', groups: added });
  if (!main.length) return fail('no_main');

  // --- Finisher (optional) ---------------------------------------------------
  const wantsCardio =
    input.mainGoals.includes('lose_weight') ||
    input.mainGoals.includes('fitness') ||
    input.muscleGoals.some((g) => g.goal === 'firm');
  const wantsMobility = input.mainGoals.includes('mobility') || input.mainGoals.includes('balance');
  let finisher: SessionItem | null = null;
  const young = input.mode === 'child' || input.mode === 'teen';
  if (wantsCardio || wantsMobility) {
    const part: SessionPart = wantsCardio ? 'finisher_cardio' : 'finisher_mobility';
    const pick = pool
      .filter((e) => e.parts.includes(part) && !used.has(e.id))
      .sort(
        (a, b) =>
          (young ? b.impact - a.impact : a.impact - b.impact) ||
          a.level - b.level ||
          byText(a.slug, b.slug),
      )[0];
    if (pick) {
      finisher = timedItem(pick, 'finisher', part, input.mode === 'child' ? 180 : 240);
      finisher.estSeconds += 30;
      used.add(pick.id);
    }
  }

  // --- Time fit: drop the lowest-priority items (SPEC §8) ------------------
  const budget = minutes * 60;
  const fixed = (warmup + cooldown) * 60;
  const total = () =>
    fixed + main.reduce((s, i) => s + i.estSeconds, 0) + (finisher?.estSeconds ?? 0);
  let dropped = 0;
  while (total() > budget) {
    if (finisher) {
      used.delete(finisher.exerciseId);
      finisher = null;
    } else if (main.length > 1) {
      used.delete(main.pop()!.exerciseId);
      dropped++;
    } else break;
  }
  if (dropped) notes.push({ key: 'generator.notes.trimmed', count: dropped });

  const byId = new Map(pool.map((e) => [e.id, e]));
  const mainExercises = main.map((i) => byId.get(i.exerciseId)!);
  const mainMuscles = [
    ...new Set(
      main.flatMap((i, n) => [
        ...(i.targetMuscle ? muscleFamily(i.targetMuscle) : []),
        ...mainExercises[n].muscles.filter((m) => m.role !== 'stabilizer').map((m) => m.muscleKey),
      ]),
    ),
  ];

  // --- Warm-up: general → dynamic mobility → ramp-up (SPEC §8) -------------
  const warmItems: SessionItem[] = [];
  const general = pickGeneralWarmup(pool, input.mode);
  if (!general) return fail('no_warmup');
  const generalSeconds = Math.max(60, Math.min(180, Math.round(warmup * 60 * 0.45)));
  warmItems.push(timedItem(general, 'warmup', 'warmup_general', generalSeconds));

  // Ramp-up: light sets of the first loaded exercise. Adults with weights;
  // teens light only; never kids (SPEC §8 table).
  const first = mainExercises[0];
  let rampSeconds = 0;
  let ramp: SessionItem | null = null;
  if (first?.loaded && input.mode !== 'child') {
    const sets = input.mode === 'teen' || warmup <= MIN_WARMUP ? 1 : 2;
    rampSeconds = sets * 60;
    ramp = {
      id: '',
      role: 'warmup',
      part: 'ramp_up',
      exerciseId: first.id,
      targetMuscle: main[0].targetMuscle,
      goal: null,
      sets,
      reps: [8, 10],
      restSeconds: 30,
      perSide: first.unilateral,
      loadHint: input.mode === 'teen' ? 'light' : 'ramp',
      estSeconds: rampSeconds,
    };
  }

  const mobilitySeconds = warmup * 60 - generalSeconds - rampSeconds;
  const mobilityCount = mobilitySeconds >= 120 ? 2 : mobilitySeconds >= 30 ? 1 : 0;
  const warmUsed = new Set([general.id]);
  const mobility = pickByOverlap(pool, 'warmup_mobility', mainMuscles, input.mode, warmUsed).slice(
    0,
    mobilityCount,
  );
  for (const e of mobility) {
    warmItems.push(
      timedItem(e, 'warmup', 'warmup_mobility', Math.round(mobilitySeconds / mobility.length)),
    );
  }
  if (!mobility.length && mobilitySeconds > 0) {
    // No mobility move fits this user: the general warm-up takes the time.
    warmItems[0].durationSeconds = generalSeconds + mobilitySeconds;
    warmItems[0].estSeconds = generalSeconds + mobilitySeconds;
  }
  if (ramp) warmItems.push(ramp);

  // --- Cool-down: walk → static stretches → breathing (SPEC §8) -----------
  const coolItems: SessionItem[] = [];
  const coolUsed = new Set<string>();
  const walk = pickByOverlap(pool, 'cooldown_walk', [], input.mode, coolUsed).sort(
    (a, b) => a.impact - b.impact || byText(a.slug, b.slug),
  )[0];
  const breathe = pickByOverlap(pool, 'cooldown_breathing', [], input.mode, coolUsed)[0];
  const walkSeconds = walk ? Math.max(60, Math.min(120, Math.round(cooldown * 60 * 0.4))) : 0;
  const breatheSeconds = breathe
    ? input.mode === 'senior'
      ? 60
      : input.mode === 'child'
        ? 30
        : 45
    : 0;
  if (walk) coolItems.push(timedItem(walk, 'cooldown', 'cooldown_walk', walkSeconds));

  let stretchBudget = cooldown * 60 - walkSeconds - breatheSeconds;
  const stretches: SessionItem[] = [];
  const stretchFor = (muscles: string[]) =>
    pool
      .filter(
        (e) =>
          e.parts.includes('cooldown_stretch') &&
          !coolUsed.has(e.id) &&
          (muscles.length === 0 || emphasisOn(e, muscles, 'primary') > 0),
      )
      .sort(
        (a, b) =>
          // Balance-safe (chair-supported or seated) stretches first for 60+.
          (input.mode === 'senior' ? supportedFirst(b) - supportedFirst(a) : 0) ||
          emphasisOn(b, muscles, 'primary') - emphasisOn(a, muscles, 'primary') ||
          byText(a.slug, b.slug),
      )[0];
  for (const muscle of mainMuscles) {
    const s = stretchFor([muscle]);
    if (!s) continue;
    const hold = 30 * (s.unilateral ? 2 : 1) + 10;
    if (stretches.length && hold > stretchBudget) break;
    coolUsed.add(s.id);
    stretchBudget -= hold;
    stretches.push({
      ...timedItem(s, 'cooldown', 'cooldown_stretch', hold),
      holdSeconds: [20, 30],
      perSide: s.unilateral,
      durationSeconds: undefined,
      targetMuscle: muscle,
    });
  }
  if (!stretches.length) {
    const any = stretchFor([]);
    if (any) {
      stretches.push({
        ...timedItem(any, 'cooldown', 'cooldown_stretch', 40),
        holdSeconds: [20, 30],
        perSide: any.unilateral,
        durationSeconds: undefined,
      });
    }
  }
  coolItems.push(...stretches);
  if (breathe) coolItems.push(timedItem(breathe, 'cooldown', 'cooldown_breathing', breatheSeconds));
  if (!coolItems.length) return fail('no_cooldown');

  // --- Assemble, always in SPEC order --------------------------------------
  const exerciseById = new Map(input.library.map((e) => [e.id, e]));
  const items = [...warmItems, ...main, ...(finisher ? [finisher] : []), ...coolItems].map(
    (item, i) => {
      const e = exerciseById.get(item.exerciseId);
      const range = e ? rangeFor(e, input) : 'ok';
      return {
        ...item,
        id: `i${i}`,
        ...(range === 'reduced' || range === 'isometric' ? { range } : {}),
      };
    },
  );
  return { ...base, items, estimatedMinutes: Math.round(total() / 60) };
}

/** "Only 15 min today" re-runs the generator with 15 minutes (SPEC §8). */
export function shortSession(input: GeneratorInput, minutes = 15): GeneratedSession {
  return generateSession({ ...input, minutes });
}

/** Muscles the main work trains; only these turn red on the body map. */
export function mainWorkMuscles(session: GeneratedSession, library: Exercise[]): string[] {
  const byId = new Map(library.map((e) => [e.id, e]));
  return [
    ...new Set(
      session.items
        .filter((i) => i.role === 'main')
        .flatMap((i) =>
          (byId.get(i.exerciseId)?.muscles ?? [])
            .filter((m) => m.role === 'primary')
            .map((m) => m.muscleKey),
        ),
    ),
  ];
}
