import type { Exercise } from '../exercises/types';
import type { GeneratedSession, ProgramSideKey, SessionItem } from '../generator/types';
import type { LocalDate } from '@/lib/dates';

import { aboveOrBehind } from '../movement/overhead';

/**
 * Fixed rehabilitation programs (Phase 30). Unlike the ready plans, the
 * exercises and their doses are set here, not picked by the generator. The
 * first one is "Shoulder: mobility and strength", written by us from the AAOS
 * OrthoInfo shoulder conditioning program (frozen shoulder). Every exercise
 * comes from the library by slug; one that is not in the library (not yet
 * released) is left out, never invented.
 */
export type AffectedSide = 'right' | 'left' | 'both';
export const AFFECTED_SIDES: AffectedSide[] = ['right', 'left', 'both'];
/** The program's tags (Phase 30, §1). */
export const PROGRAM_TAGS = ['frozen', 'capsulitis', 'cuff', 'injury'] as const;

export type ProgramDose =
  | {
      kind: 'reps';
      sets: number;
      reps: [number, number];
      /** After the load goes up: back to fewer reps (or sets × reps). */
      afterIncrease: { sets: number; reps: [number, number] };
    }
  | { kind: 'hold'; sets: number; seconds: number; restSeconds: number };

export type ProgramExercise = {
  /** The number in the program (1–18). */
  n: number;
  slug: string;
  block: 'stretch' | 'band' | 'dumbbell';
  dose: ProgramDose;
  daysPerWeek: [number, number];
  /** 'affected': that side only; 'both': the affected side, then the other; 'none': both arms together. */
  sides: 'affected' | 'both' | 'none';
  /** Light weights (kg): where to start and the most to use. Bands go by band strength. */
  load?: { startKg: [number, number]; maxKg: [number, number] };
  noteKey?: string;
  /**
   * The "day's dose" of the daily rhythm (Daniel, Oct 2): a smaller dose so
   * the day fits in 15–20 min. Unset = the section 4 dose with fewer sets.
   */
  reduced?: { dose?: ProgramDose; sides?: ProgramExercise['sides']; skip?: boolean };
};

export type ProgramSessionKey = 'A' | 'B' | 'C';
/** The daily rhythm (Phase 30 addendum §6.2): stretches every day, two alternating blocks. */
export type DailyBlock = 'standing' | 'floor';
/** Strengthening on a training day: after the main workout (default) or before it. */
export type StrengthTiming = 'before' | 'after';
/** Any session the player can start: A/B/C, a daily block day, Sunday stretches or a sleeper break. */
export type ProgramPlanKey = ProgramSessionKey | DailyBlock | 'stretch' | 'sleeper';

export type ProgramSessionDef = {
  key: ProgramSessionKey;
  warmup: boolean;
  blocks: ('stretch' | 'band' | 'dumbbell' | 'stretch_end')[];
  daysPerWeek: [number, number];
};

export type RehabProgram = {
  id: string;
  weeks: [number, number];
  maintenanceDaysPerWeek: [number, number];
  exercises: ProgramExercise[];
  sessions: ProgramSessionDef[];
  /**
   * The warm-up of a strengthening session (Phase 32 B3): light mobility,
   * timed, in order. Shortened in the day's dose, never removed.
   */
  warmup: { slug: string; seconds: number }[];
  /** Rest between strength sets, seconds. */
  strengthRest: number;
  /** The joint area the main workout protects while the program runs (§6.4). */
  area: string;
  /** Daily rhythm (§6.2): program numbers per block and the standard week (Monday first). */
  daily: {
    blocks: Record<DailyBlock, number[]>;
    /** Monday … Sunday. */
    week: (DailyBlock | 'stretch')[];
    /** Times a week each strengthening exercise is done. */
    perWeek: number;
    /** Never more exercises than this in one day (§6.3). */
    cap: number;
    /** Sleeper stretch breaks, local hours (§6.2). */
    sleeperHours: number[];
    /** The day's dose: strength sets and rest between sets (s). */
    reduced: { sets: number; rest: number };
  };
};

const STRETCH_HOLD: ProgramDose = { kind: 'hold', sets: 4, seconds: 30, restSeconds: 30 };
/** The day's dose of stretches 2–4: 2 holds of 30 s, affected side only. */
const DAY_HOLD: ProgramDose = { kind: 'hold', sets: 2, seconds: 30, restSeconds: 30 };
const BAND: ProgramDose = {
  kind: 'reps',
  sets: 3,
  reps: [8, 12],
  afterIncrease: { sets: 3, reps: [8, 8] },
};
const LIGHT_WEIGHT = (
  sets: number,
  reps: [number, number],
  after: { sets: number; reps: [number, number] },
): ProgramDose => ({ kind: 'reps', sets, reps, afterIncrease: after });

export const SHOULDER_PROGRAM: RehabProgram = {
  id: 'shoulder_mobility_strength',
  weeks: [4, 6],
  maintenanceDaysPerWeek: [2, 3],
  // 2–3 min of light mobility, not a 5 min walk (Phase 32 B3, Daniel, Oct 4).
  warmup: [
    { slug: 'pendulum_swing', seconds: 60 },
    { slug: 'wu_seated_shoulder_rolls', seconds: 45 },
    { slug: 'su_seated_shrug_hold', seconds: 45 },
  ],
  strengthRest: 45,
  area: 'shoulder',
  daily: {
    blocks: { standing: [6, 7, 8, 9, 10, 11], floor: [12, 13, 14, 15, 16, 17, 18] },
    week: ['standing', 'floor', 'standing', 'floor', 'standing', 'floor', 'stretch'],
    perWeek: 3,
    cap: 12,
    sleeperHours: [9, 15, 21],
    reduced: { sets: 2, rest: 30 },
  },
  exercises: [
    // Stretches (1–5)
    {
      n: 1,
      slug: 'pendulum_swing',
      block: 'stretch',
      dose: LIGHT_WEIGHT(2, [10, 10], { sets: 2, reps: [10, 10] }),
      daysPerWeek: [5, 6],
      sides: 'both',
      noteKey: 'rehab.notes.pendulum',
      // The day's dose: 1 minute.
      reduced: {
        dose: { kind: 'hold', sets: 1, seconds: 60, restSeconds: 0 },
        sides: 'affected',
      },
    },
    {
      n: 2,
      slug: 'crossover_arm_stretch',
      block: 'stretch',
      dose: STRETCH_HOLD,
      daysPerWeek: [5, 6],
      sides: 'both',
      reduced: { dose: DAY_HOLD, sides: 'affected' },
    },
    {
      n: 3,
      slug: 'stick_internal_rotation_stretch',
      block: 'stretch',
      dose: STRETCH_HOLD,
      daysPerWeek: [5, 6],
      sides: 'both',
      reduced: { dose: DAY_HOLD, sides: 'affected' },
    },
    {
      n: 4,
      slug: 'stick_external_rotation_stretch',
      block: 'stretch',
      dose: STRETCH_HOLD,
      daysPerWeek: [5, 6],
      sides: 'both',
      reduced: { dose: DAY_HOLD, sides: 'affected' },
    },
    {
      n: 5,
      slug: 'sleeper_stretch',
      block: 'stretch',
      dose: STRETCH_HOLD,
      daysPerWeek: [7, 7],
      sides: 'affected',
      noteKey: 'rehab.notes.sleeper',
      // The day's dose: only in the 3 breaks a day, not in the session.
      reduced: { skip: true },
    },
    // Band strengthening (6–9)
    {
      n: 6,
      slug: 'band_row',
      block: 'band',
      dose: BAND,
      daysPerWeek: [3, 3],
      sides: 'none',
      noteKey: 'rehab.notes.cable',
    },
    {
      n: 7,
      slug: 'band_external_rotation_90',
      block: 'band',
      dose: BAND,
      daysPerWeek: [3, 3],
      sides: 'affected',
      noteKey: 'rehab.notes.cable',
    },
    {
      n: 8,
      slug: 'band_internal_rotation',
      block: 'band',
      dose: BAND,
      daysPerWeek: [3, 3],
      sides: 'affected',
      noteKey: 'rehab.notes.cable',
    },
    {
      n: 9,
      slug: 'band_external_rotation',
      block: 'band',
      dose: BAND,
      daysPerWeek: [3, 3],
      sides: 'affected',
      noteKey: 'rehab.notes.cable',
    },
    // Light dumbbell strengthening (10–18)
    {
      n: 10,
      slug: 'dumbbell_curl',
      block: 'dumbbell',
      dose: LIGHT_WEIGHT(3, [8, 12], { sets: 3, reps: [8, 8] }),
      daysPerWeek: [3, 3],
      sides: 'none',
      load: { startKg: [0.5, 1], maxKg: [2, 4.5] },
    },
    {
      n: 11,
      // The AAOS triceps kickback (Phase 32 A1): the elbow straightens with
      // the arm at the side, never overhead.
      slug: 'dumbbell_kickback',
      block: 'dumbbell',
      dose: LIGHT_WEIGHT(3, [8, 12], { sets: 3, reps: [8, 8] }),
      daysPerWeek: [3, 3],
      sides: 'affected',
      load: { startKg: [0.5, 1], maxKg: [2, 2] },
    },
    {
      n: 12,
      slug: 'kneeling_thumbs_up_raise',
      block: 'dumbbell',
      dose: LIGHT_WEIGHT(3, [20, 20], { sets: 3, reps: [15, 15] }),
      daysPerWeek: [3, 5],
      sides: 'affected',
      load: { startKg: [0.5, 1], maxKg: [2, 3] },
    },
    {
      n: 13,
      slug: 'prone_scapula_setting',
      block: 'dumbbell',
      dose: { kind: 'hold', sets: 10, seconds: 10, restSeconds: 0 },
      daysPerWeek: [3, 3],
      sides: 'none',
    },
    {
      n: 14,
      slug: 'prone_table_scapular_retraction',
      block: 'dumbbell',
      dose: LIGHT_WEIGHT(2, [10, 15], { sets: 2, reps: [10, 10] }),
      daysPerWeek: [3, 3],
      sides: 'affected',
      load: { startKg: [0.5, 1], maxKg: [2, 2] },
    },
    {
      n: 15,
      slug: 'prone_horizontal_abduction',
      block: 'dumbbell',
      dose: LIGHT_WEIGHT(3, [8, 12], { sets: 3, reps: [8, 8] }),
      daysPerWeek: [3, 3],
      sides: 'affected',
      load: { startKg: [0.5, 1], maxKg: [2, 2] },
    },
    {
      n: 16,
      slug: 'supine_shoulder_rotation_90',
      block: 'dumbbell',
      dose: LIGHT_WEIGHT(3, [20, 20], { sets: 3, reps: [15, 15] }),
      daysPerWeek: [3, 5],
      sides: 'affected',
      load: { startKg: [0.5, 1], maxKg: [2, 4.5] },
      noteKey: 'rehab.notes.supine',
    },
    {
      n: 17,
      slug: 'rx_side_lying_er',
      block: 'dumbbell',
      dose: LIGHT_WEIGHT(2, [8, 10], { sets: 3, reps: [5, 5] }),
      daysPerWeek: [3, 3],
      sides: 'affected',
      load: { startKg: [0.5, 1], maxKg: [2, 4.5] },
    },
    {
      n: 18,
      slug: 'side_lying_internal_rotation',
      block: 'dumbbell',
      dose: LIGHT_WEIGHT(2, [8, 10], { sets: 3, reps: [5, 5] }),
      daysPerWeek: [3, 3],
      sides: 'affected',
      load: { startKg: [0.5, 1], maxKg: [2, 4.5] },
    },
  ],
  sessions: [
    // Every exercise once per session (Phase 32 B5): the warm-up's mobility,
    // the strengthening, then the stretches as the cool-down.
    { key: 'A', warmup: false, blocks: ['stretch'], daysPerWeek: [5, 6] },
    { key: 'B', warmup: true, blocks: ['band', 'stretch_end'], daysPerWeek: [3, 3] },
    { key: 'C', warmup: true, blocks: ['dumbbell', 'stretch_end'], daysPerWeek: [3, 3] },
  ],
};

export const REHAB_PROGRAMS: RehabProgram[] = [SHOULDER_PROGRAM];
export const programById = (id: string | null | undefined) =>
  REHAB_PROGRAMS.find((p) => p.id === id);

/** The sides a program exercise is done on, in order, for this person. */
export function sidesFor(ex: ProgramExercise, affected: AffectedSide): ProgramSideKey[] | null {
  if (ex.sides === 'none') return null;
  if (affected === 'both') return ['right', 'left'];
  if (ex.sides === 'affected') return [affected];
  return [affected, affected === 'right' ? 'left' : 'right'];
}

/**
 * The dose for today: after the person raised the load, fewer reps (Phase 30,
 * §3). The day's dose (`maxSets`) caps the strength sets.
 */
export function doseFor(ex: ProgramExercise, increased: boolean, maxSets?: number): ProgramDose {
  let dose = ex.dose;
  if (dose.kind === 'reps' && increased) dose = { ...dose, ...dose.afterIncrease };
  if (dose.kind === 'reps' && maxSets) dose = { ...dose, sets: Math.min(dose.sets, maxSets) };
  return dose;
}

/** What one session holds: warm-up or not, then program numbers by block, in order. */
export type SessionLayout = {
  key: ProgramPlanKey;
  warmup: boolean;
  /** The day's dose instead of the section 4 dose (daily rhythm, unless "Full dose"). */
  reduced?: boolean;
  groups: { block: NonNullable<SessionItem['block']>; numbers: number[] }[];
};

/**
 * The stretches that close a session after a warm-up: every stretch the
 * warm-up has not done already, so nothing shows twice (Phase 32 B5).
 */
export function coolDownStretches(program: RehabProgram): number[] {
  const warm = new Set(program.warmup.map((w) => w.slug));
  return program.exercises
    .filter((x) => x.block === 'stretch' && !warm.has(x.slug))
    .map((x) => x.n);
}

/** The layout of a fixed session (A, B or C). */
export function sessionLayout(program: RehabProgram, key: ProgramSessionKey): SessionLayout {
  const def = program.sessions.find((s) => s.key === key)!;
  return {
    key,
    warmup: def.warmup,
    groups: def.blocks.map((block) => ({
      block,
      numbers:
        block === 'stretch_end'
          ? coolDownStretches(program)
          : program.exercises.filter((x) => x.block === block).map((x) => x.n),
    })),
  };
}

/**
 * One program session as a workout the player already knows how to run:
 * the light mobility warm-up (B and C), the band or dumbbell block, then the
 * stretches as the cool-down; A is the stretches alone. Each exercise once.
 * Holds count down (30 s, 30 s rest); one-sided work is split per side, the
 * affected side first.
 */
export function buildProgramSession(
  program: RehabProgram,
  key: ProgramSessionKey | SessionLayout,
  o: {
    library: Exercise[];
    affected: AffectedSide;
    week: number;
    /** Exercises whose load the person raised (slug → true). */
    increased?: Record<string, boolean>;
    /** The physio said "Yes": the behind-the-back stretch comes back (Phase 32). */
    behindOk?: boolean;
  },
): GeneratedSession & { missing: string[]; excluded: string[] } {
  const layout = typeof key === 'string' ? sessionLayout(program, key) : key;
  const bySlug = new Map(o.library.map((e) => [e.slug, e]));
  const missing: string[] = [];
  // Above shoulder height or behind the back: never, whatever the program says (Phase 32 A1).
  const excluded: string[] = [];
  const items: SessionItem[] = [];
  const day = layout.reduced ? program.daily.reduced : null;
  const add = (ex: ProgramExercise, block: NonNullable<SessionItem['block']>) => {
    if (day && ex.reduced?.skip) return;
    const e = bySlug.get(ex.slug);
    if (!e) {
      if (!missing.includes(ex.slug)) missing.push(ex.slug);
      return;
    }
    if (aboveOrBehind(e, { behindOk: o.behindOk })) {
      if (!excluded.includes(ex.slug)) excluded.push(ex.slug);
      return;
    }
    const dose = (day && ex.reduced?.dose) || doseFor(ex, !!o.increased?.[ex.slug], day?.sets);
    const sides = sidesFor({ ...ex, sides: (day && ex.reduced?.sides) || ex.sides }, o.affected);
    const rest = day?.rest ?? program.strengthRest;
    const sets = dose.sets * (sides?.length ?? 1);
    const primary = e.muscles.find((m) => m.role === 'primary')?.muscleKey ?? null;
    const base = {
      id: `${block}-${ex.n}`,
      role: block === 'stretch_end' ? ('cooldown' as const) : ('main' as const),
      part: block === 'stretch_end' ? ('cooldown_stretch' as const) : ('main' as const),
      exerciseId: e.id,
      targetMuscle: primary,
      goal: null,
      sets,
      perSide: false,
      block,
      ...(sides ? { sides } : {}),
      ...(ex.noteKey ? { noteKey: ex.noteKey } : {}),
    };
    if (dose.kind === 'hold') {
      items.push({
        ...base,
        holdSeconds: [dose.seconds, dose.seconds],
        countdown: true,
        restSeconds: dose.restSeconds,
        loadHint: null,
        // No rest after the last hold.
        estSeconds: sets * dose.seconds + (sets - 1) * dose.restSeconds,
      });
    } else {
      items.push({
        ...base,
        reps: dose.reps,
        restSeconds: rest,
        loadHint: ex.block === 'stretch' ? null : 'light',
        // About 4 s a rep; no rest after the last set.
        estSeconds: sets * dose.reps[1] * 4 + (sets - 1) * rest,
      });
    }
  };
  let warmupSeconds = 0;
  if (layout.warmup)
    for (const w of program.warmup) {
      const e = bySlug.get(w.slug);
      if (!e) {
        missing.push(w.slug);
        continue;
      }
      warmupSeconds += w.seconds;
      items.push({
        id: `warmup-${w.slug}`,
        role: 'warmup',
        part: 'warmup_general',
        exerciseId: e.id,
        targetMuscle: null,
        goal: null,
        sets: 1,
        durationSeconds: w.seconds,
        restSeconds: 0,
        perSide: false,
        loadHint: null,
        estSeconds: w.seconds,
        block: 'warmup',
      });
    }
  const byNumber = new Map(program.exercises.map((x) => [x.n, x]));
  for (const group of layout.groups)
    for (const n of group.numbers) {
      const ex = byNumber.get(n);
      if (ex) add(ex, group.block);
    }
  const seconds = items.reduce((n, i) => n + i.estSeconds, 0);
  const minutes = Math.max(1, Math.round(seconds / 60));
  return {
    items,
    minutes,
    warmupMinutes: Math.ceil(warmupSeconds / 60),
    cooldownMinutes: Math.round(
      items.filter((i) => i.role === 'cooldown').reduce((n, i) => n + i.estSeconds, 0) / 60,
    ),
    estimatedMinutes: minutes,
    notes: [],
    program: { id: program.id, session: layout.key, week: o.week },
    missing,
    excluded,
  };
}

/** The program's exercises this person can do: in the library and never above the shoulder or behind the back. */
export function usableExercises(
  program: RehabProgram,
  library: Exercise[],
  behindOk = false,
): ProgramExercise[] {
  const bySlug = new Map(library.map((e) => [e.slug, e]));
  return program.exercises.filter((x) => {
    const e = bySlug.get(x.slug);
    return !!e && !aboveOrBehind(e, { behindOk });
  });
}

const DAY = 864e5;
const dayNumber = (d: LocalDate) => Math.round(Date.parse(`${d}T12:00:00Z`) / DAY);

/** Program week (1-based) for a day, from the start day. */
export function programWeek(startedAt: LocalDate, today: LocalDate): number {
  return Math.floor(Math.max(0, dayNumber(today) - dayNumber(startedAt)) / 7) + 1;
}

/**
 * The suggested session for a day (Phase 30, §2): weeks 1–2, B on 3 days and
 * A on the others; from week 3, C and B alternate on 3 days, A on the others.
 * After the program (week 7+) in maintenance: B or C 2–3 times a week, rest
 * on the other days. The person can always pick another session.
 */
export function suggestedSession(
  program: RehabProgram,
  startedAt: LocalDate,
  today: LocalDate,
  maintenance: boolean,
): { week: number; session: 'A' | 'B' | 'C' | null } {
  const week = programWeek(startedAt, today);
  const day = (dayNumber(today) - dayNumber(startedAt)) % 7;
  const strengthDay = day === 0 || day === 2 || day === 4;
  if (week > program.weeks[1]) {
    if (!maintenance) return { week, session: null };
    // Maintenance: 3 strength days a week, B and C taking turns.
    if (!strengthDay) return { week, session: null };
    return { week, session: (day + week) % 2 === 0 ? 'C' : 'B' };
  }
  if (!strengthDay) return { week, session: 'A' };
  if (week <= 2) return { week, session: 'B' };
  return { week, session: (day / 2 + week) % 2 === 0 ? 'C' : 'B' };
}
