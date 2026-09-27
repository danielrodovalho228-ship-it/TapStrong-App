import type { Exercise, SessionPart } from '../exercises/types';
import { MUSCLES, muscleByKey, muscleFamily, type MovementGroup } from '../muscles';
import { defaultMuscleGoal, type MuscleGoal } from '../onboarding/options';
import type { AppMode } from '../profile/age';

import { doseFor, estimateSeconds, needsCaution } from './dosage';
import { emphasisOn, isKidMove, needsJointCare, rangeFor, safePool, userLevel } from './filters';
import type {
  GeneratedSession,
  GeneratorInput,
  GeneratorNote,
  ItemPart,
  RecentSession,
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
      // Balance goal: balance work first (QA B-08).
      balance: target.goal === 'balance' && e.pattern === 'balance' ? 1 : 0,
      emphasis:
        Math.round(emphasisOn(e, target.family, 'primary') * 10) +
        (minor && !e.loaded ? MINOR_UNLOADED_BONUS : 0),
      fit: goalFit(e, target.goal, mode),
      distance: Math.abs(e.level - level),
    }))
    .sort(
      (a, b) =>
        b.balance - a.balance ||
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

/** Hours before a muscle trains again (QA R2-08): peach at 60+ lasts 96 h. */
const READY_HOURS: Record<AppMode, number> = { child: 48, teen: 48, adult: 48, senior: 96 };

const GROUP_ORDER: Record<MovementGroup, number> = { pull: 0, legs: 1, push: 2, core: 3 };

const MUSCLES_BY_GROUP: Partial<Record<MovementGroup, string[]>> = Object.fromEntries(
  (['push', 'pull', 'legs', 'core'] as MovementGroup[]).map((g) => [
    g,
    MUSCLES.filter((m) => m.movementGroup === g).map((m) => m.key),
  ]),
);

/**
 * Work per group this week (last 7 days): distinct parent muscles trained in
 * each session, a stand-in for exercises now that each parent muscle gets one.
 */
function groupWeekCounts(input: GeneratorInput): Record<MovementGroup, number> {
  const out: Record<MovementGroup, number> = { push: 0, pull: 0, legs: 0, core: 0 };
  const recent = input.recentSessions ?? [];
  const today = input.today ?? recent[0]?.date;
  if (!today) return out;
  const cutoff = Date.parse(today) - 6 * 24 * 3600 * 1000;
  for (const s of recent) {
    if (Date.parse(s.date) < cutoff) continue;
    const parents = new Set(s.mainMuscles.map((m) => muscleByKey(m)?.parentKey ?? m));
    for (const p of parents) {
      const g = groupOf(p);
      if (g) out[g]++;
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
  input: Pick<GeneratorInput, 'mode' | 'setsPerExercise'> &
    Partial<
      Pick<GeneratorInput, 'conditions' | 'rehab' | 'restrictions' | 'painAreas' | 'movementLimits'>
    >,
): SessionItem {
  const dose = doseFor(target.goal, input.mode, e, input.setsPerExercise, {
    caution: needsCaution(input.conditions ?? []),
    rehab: input.rehab,
    jointCare: needsJointCare(e, input),
  });
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

/** Kids get the game-like moves first (QA R2-11). */
const kidFirst = (e: Exercise, mode: AppMode) => (mode === 'child' && isKidMove(e) ? 1 : 0);

function pickGeneralWarmup(
  pool: Exercise[],
  mode: AppMode,
  used: Set<string>,
): Exercise | undefined {
  const young = mode === 'child' || mode === 'teen';
  return pool
    .filter((e) => e.parts.includes('warmup_general') && !used.has(e.id))
    .sort(
      (a, b) =>
        kidFirst(b, mode) - kidFirst(a, mode) ||
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
        kidFirst(b.e, mode) - kidFirst(a.e, mode) ||
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
  const byIdAll = new Map(pool.map((e) => [e.id, e]));

  // --- Main work -----------------------------------------------------------
  const recent = input.recentSessions ?? [];
  const defaultGoal = defaultMuscleGoal(input.mainGoals);
  const allTargets: Target[] = input.muscleGoals.map((g) => ({
    muscle: g.muscleKey,
    family: muscleFamily(g.muscleKey),
    goal: g.goal,
  }));
  // Rules count the parent muscle: upper, middle and lower chest are all chest (QA D-03).
  const parentOf = (muscle: string) => muscleByKey(muscle)?.parentKey ?? muscle;
  const root = (t: Target) => muscleFamily(parentOf(t.muscle));
  // A Repair recovery session or a short mobility session stays on its focus.
  const focused = !!input.rehab || !!input.mobilityOnly;
  const rested = input.mobilityOnly
    ? []
    : allTargets.filter((t) => hitIn(recent[0], root(t)) && hitIn(recent[1], root(t)));
  if (rested.length)
    notes.push({ key: 'generator.notes.rested', muscles: rested.map((t) => t.muscle) });

  // Recovery hours (QA R2-08): a muscle trains again once it has recovered —
  // 48 h, or 96 h at 60+ (the body map's colors). Reviewer to confirm.
  const nowMs = input.now
    ? Date.parse(input.now)
    : input.today
      ? Date.parse(`${input.today}T12:00:00`)
      : undefined;
  const sessionMs = (r: RecentSession) => Date.parse(r.at ?? `${r.date}T12:00:00`);
  const hoursSince = (family: string[]) => {
    const hit = recent.find((r) => hitIn(r, family));
    if (!hit || nowMs === undefined) return Number.POSITIVE_INFINITY;
    return (nowMs - sessionMs(hit)) / 3_600_000;
  };
  const readyAfter = READY_HOURS[input.mode];
  // Mobility work does not need recovered muscles.
  const isReady = (family: string[]) => !!input.mobilityOnly || hoursSince(family) >= readyAfter;
  const fresh = allTargets.filter((t) => !rested.includes(t));
  const recovering = fresh.filter((t) => !isReady(root(t)));
  if (recovering.length)
    notes.push({ key: 'generator.notes.recovering', muscles: recovering.map((t) => t.muscle) });
  const readyTargets = fresh.filter((t) => isReady(root(t)));

  // One exercise per parent muscle per session (QA R2-09): chest sub-regions
  // take turns across sessions (least recently trained first), and the parent
  // muscles take turns through the week, then the user's priority (QA D-04).
  const lastHit = (family: string[]) => {
    const i = recent.findIndex((r) => hitIn(r, family));
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const byParent = new Map<string, { t: Target; priority: number }[]>();
  readyTargets.forEach((t, priority) => {
    const key = parentOf(t.muscle);
    byParent.set(key, [...(byParent.get(key) ?? []), { t, priority }]);
  });
  const targets = [...byParent.values()]
    .map((group) => {
      const pick = [...group].sort(
        (a, b) => lastHit(b.t.family) - lastHit(a.t.family) || a.priority - b.priority,
      )[0];
      return { ...pick, last: lastHit(root(pick.t)) };
    })
    .sort((a, b) => b.last - a.last || a.priority - b.priority)
    .map((x) => x.t);

  const slots = Math.max(1, Math.min(10, Math.round(input.exercisesPerSession)));
  const used = new Set<string>();
  const usedParents = new Set<string>();
  const main: SessionItem[] = [];
  const unavailable: string[] = [];
  // Variety (QA round 2): the pick rotates week to week among the best few options.
  const week = input.today ? Math.floor(Date.parse(input.today) / (7 * 86_400_000)) : 0;
  const rotate = <T>(list: T[], salt: number) =>
    list.length ? list[(week + salt) % Math.min(3, list.length)] : undefined;
  const add = (pick: Exercise, target: Target) => {
    used.add(pick.id);
    usedParents.add(parentOf(topPrimary(pick) ?? target.muscle));
    main.push(mainItem(pick, target, input));
  };
  targets.slice(0, slots).forEach((target, i) => {
    const options = rankForTarget(pool, target, input.mode).filter((e) => !used.has(e.id));
    const pick = input.rehab ? options[0] : rotate(options, i);
    if (pick) add(pick, target);
    else unavailable.push(target.muscle);
  });
  // A recovery session stays on its joint: more holds for the same focus
  // until its 4 slots are full (QA round 2: it had 3).
  for (let pass = 0; focused && main.length < slots && pass < 3; pass++) {
    for (const target of targets) {
      if (main.length >= slots) break;
      const pick = rankForTarget(pool, target, input.mode).find((e) => !used.has(e.id));
      if (pick) add(pick, target);
    }
  }
  // A chosen muscle with no safe option is never dropped silently (QA R2-10).
  if (unavailable.length && !input.mobilityOnly)
    notes.push({ key: 'generator.notes.unavailable', muscles: unavailable });

  // The rest of the session keeps push / pull / legs balanced over the week:
  // groups trained least this week first, only recovered ones, never a
  // parent muscle twice (QA R2-09). A Repair recovery session stays focused.
  const weekCount = groupWeekCounts(input);
  const groupReady = (g: MovementGroup) => isReady(MUSCLES_BY_GROUP[g] ?? []) || !recent.length;
  const fill: MovementGroup[] = (['push', 'pull', 'legs', 'core'] as MovementGroup[])
    .filter(groupReady)
    .sort((a, b) => weekCount[a] - weekCount[b] || GROUP_ORDER[a] - GROUP_ORDER[b]);
  const added = new Map<string, MovementGroup>();
  // Each open slot goes to the group with the fewest sessions this week plus
  // exercises today, so a chest goal does not make the week push-heavy.
  const sessionCount = (g: MovementGroup) =>
    main.filter((i) => groupOf(i.targetMuscle ?? '') === g).length;
  const nextFor = (g: MovementGroup) =>
    rankForGroup(pool, g, defaultGoal, input.mode).find(
      (e) => !used.has(e.id) && !usedParents.has(parentOf(topPrimary(e)!)),
    );
  while (!focused && main.length < slots) {
    const options = fill
      // Core once per session; the big groups share the rest.
      .filter((g) => g !== 'core' || sessionCount('core') === 0)
      .map((g) => ({ g, pick: nextFor(g) }))
      .filter((o): o is { g: MovementGroup; pick: Exercise } => !!o.pick)
      .sort(
        (a, b) =>
          weekCount[a.g] + sessionCount(a.g) - (weekCount[b.g] + sessionCount(b.g)) ||
          GROUP_ORDER[a.g] - GROUP_ORDER[b.g],
      );
    if (!options.length) break;
    const { g, pick } = options[0];
    const muscle = topPrimary(pick)!;
    add(pick, { muscle, family: [muscle], goal: defaultGoal });
    added.set(pick.id, g);
  }
  if (!main.length && allTargets.length && !readyTargets.length && !focused) {
    // Everything chosen is still recovering and nothing else is ready:
    // mobility, balance, a walk or a rest day instead (QA R2-08).
    return fail('all_recovering');
  }
  if (!main.length) return fail('no_main');
  if (
    unavailable.length &&
    main.length &&
    !targets.some((t) => main.some((i) => i.targetMuscle === t.muscle))
  )
    notes.push({ key: 'generator.notes.substituted', muscles: unavailable });

  // 60+, a fall in the last year, or a balance goal: always some balance or
  // fall-prevention work (QA B-08, C-06), protected from the time fit (QA R2-06).
  const needsBalance =
    input.mode === 'senior' ||
    input.conditions.includes('fell_last_year') ||
    input.mainGoals.includes('balance');
  const protectedIds = new Set<string>();
  const balanceItem = main.find((i) => byIdAll.get(i.exerciseId)?.pattern === 'balance');
  if (balanceItem) protectedIds.add(balanceItem.exerciseId);
  if (needsBalance && !balanceItem && !focused) {
    const pick = pool
      .filter((e) => e.pattern === 'balance' && e.parts.includes('main') && !used.has(e.id))
      .sort(
        (a, b) =>
          supportedFirst(b) - supportedFirst(a) || a.level - b.level || byText(a.slug, b.slug),
      )[0];
    if (pick) {
      const item = mainItem(
        pick,
        { muscle: topPrimary(pick)!, family: [], goal: 'balance' },
        input,
      );
      if (main.length >= slots && main.length > 1) {
        const drop = main.pop()!;
        used.delete(drop.exerciseId);
        added.delete(drop.exerciseId);
      }
      used.add(pick.id);
      main.push(item);
      protectedIds.add(pick.id);
    }
  }

  // --- Finisher (optional) ---------------------------------------------------
  // The profile promises adults who want a leaner look a cardio finisher
  // (summary note "bodyFat"): keep that promise (QA A-07).
  const adultMode = input.mode === 'adult' || input.mode === 'senior';
  const promisedCardio =
    adultMode &&
    (input.mainGoals.includes('look') ||
      input.mainGoals.includes('lose_weight') ||
      input.muscleGoals.some((g) => g.goal === 'firm'));
  const wantsCardio =
    promisedCardio ||
    input.mainGoals.includes('lose_weight') ||
    input.mainGoals.includes('fitness') ||
    input.muscleGoals.some((g) => g.goal === 'firm');
  const wantsMobility = input.mainGoals.includes('mobility') || input.mainGoals.includes('balance');
  let finisher: SessionItem | null = null;
  const young = input.mode === 'child' || input.mode === 'teen';
  if ((wantsCardio || wantsMobility) && !focused) {
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
  // Drops the last main item that is not protected (the balance work stays, QA R2-06).
  const dropOne = () => {
    for (let i = main.length - 1; i >= 0; i--) {
      if (protectedIds.has(main[i].exerciseId)) continue;
      used.delete(main.splice(i, 1)[0].exerciseId);
      dropped++;
      return true;
    }
    return false;
  };
  while (total() > budget) {
    if (finisher && promisedCardio && main.length > 2 && dropOne()) continue;
    if (finisher) {
      used.delete(finisher.exerciseId);
      finisher = null;
    } else if (main.length <= 1 || !dropOne()) break;
  }
  if (dropped && !focused) notes.push({ key: 'generator.notes.trimmed', count: dropped });
  // "Added push / legs for balance" only names work that survived the time fit (QA round 1).
  const chosenGroups = new Set(allTargets.map((t) => groupOf(t.muscle)));
  const kept = [
    ...new Set(
      main.flatMap((i) => {
        const g = added.get(i.exerciseId);
        return g && g !== 'core' && !chosenGroups.has(g) ? [g] : [];
      }),
    ),
  ];
  if (allTargets.length && kept.length && !focused)
    notes.push({ key: 'generator.notes.balance', groups: kept });

  // The first loaded lift leads, so its ramp-up sits right before it (QA round 2).
  const firstLoaded = main.findIndex((i) => byIdAll.get(i.exerciseId)?.loaded);
  if (firstLoaded > 0) main.unshift(...main.splice(firstLoaded, 1));

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
  // The same move never twice in one session (QA round 2: brisk walk as
  // warm-up, finisher and cool-down).
  const sessionUsed = new Set([...used, ...(finisher ? [finisher.exerciseId] : [])]);
  const general = pickGeneralWarmup(pool, input.mode, sessionUsed);
  if (!general) return fail('no_warmup');
  const generalSeconds = Math.max(60, Math.min(180, Math.round(warmup * 60 * 0.45)));
  warmItems.push(timedItem(general, 'warmup', 'warmup_general', generalSeconds));

  // Ramp-up: light sets of the first loaded exercise. Adults with weights;
  // teens light only; never kids (SPEC §8 table).
  // Ramp-up for the first LOADED main lift, even when a bodyweight move comes
  // before it (QA P2).
  const firstLoadedIndex = mainExercises.findIndex((e) => e.loaded);
  const first = firstLoadedIndex >= 0 ? mainExercises[firstLoadedIndex] : undefined;
  let rampSeconds = 0;
  let ramp: SessionItem | null = null;
  // No ramp-up for a lift that loads a restricted or painful joint (QA R2-07).
  if (
    first?.loaded &&
    input.mode !== 'child' &&
    !needsCaution(input.conditions) &&
    !needsJointCare(first, input)
  ) {
    const sets = input.mode === 'teen' || warmup <= MIN_WARMUP ? 1 : 2;
    rampSeconds = sets * 60;
    ramp = {
      id: '',
      role: 'warmup',
      part: 'ramp_up',
      exerciseId: first.id,
      targetMuscle: main[firstLoadedIndex].targetMuscle,
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
  const warmUsed = new Set([...sessionUsed, general.id]);
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
  const coolUsed = new Set<string>([...warmUsed, ...mobility.map((e) => e.id)]);
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
          kidFirst(b, input.mode) - kidFirst(a, input.mode) ||
          // Balance-safe (chair-supported or seated) stretches first for 60+.
          (input.mode === 'senior' ? supportedFirst(b) - supportedFirst(a) : 0) ||
          emphasisOn(b, muscles, 'primary') - emphasisOn(a, muscles, 'primary') ||
          byText(a.slug, b.slug),
      )[0];
  // Stretch what was trained: each main exercise's own muscle first, then its
  // other primaries, then the wider family (QA round 1). A muscle with no
  // stretch of its own falls back to its parent group (e.g. chest for upper chest).
  const parentSet = (m: string) => {
    const base = muscleByKey(m)?.parentKey ?? m;
    return [...new Set([base, ...muscleFamily(base)])];
  };
  const stretchOrder = [
    ...new Set([
      ...main.flatMap((i, n) => i.targetMuscle ?? topPrimary(mainExercises[n]) ?? []),
      ...mainExercises.flatMap((e) =>
        e.muscles.filter((m) => m.role === 'primary').map((m) => m.muscleKey),
      ),
      ...mainMuscles,
    ]),
  ];
  for (const muscle of stretchOrder) {
    const s = stretchFor([muscle]) ?? stretchFor(parentSet(muscle));
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

export const MOBILITY_MINUTES = 10;
const MOBILITY_FOCUS = ['hips', 'upperBack', 'hamstrings', 'shoulders'];

/**
 * A short mobility session (~10 min, decision 1 of QA round 2): warm-up,
 * 3 mobility moves, cool-down. It counts as an active day for the streak,
 * with no limit on the free plan.
 */
export function generateMobilitySession(
  input: GeneratorInput,
  minutes = MOBILITY_MINUTES,
): GeneratedSession {
  return generateSession({
    ...input,
    minutes,
    mobilityOnly: true,
    mainGoals: ['mobility'],
    muscleGoals: MOBILITY_FOCUS.map((muscleKey) => ({ muscleKey, goal: 'mobility' as const })),
    exercisesPerSession: 3,
    setsPerExercise: 2,
  });
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
