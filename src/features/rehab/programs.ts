import type { Exercise } from '../exercises/types';
import type { GeneratedSession, ProgramSideKey, SessionItem } from '../generator/types';
import type { LocalDate } from '@/lib/dates';

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
};

export type ProgramSessionDef = {
  key: 'A' | 'B' | 'C';
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
  warmupSlug: string;
  warmupMinutes: [number, number];
  /** Rest between strength sets, seconds. */
  strengthRest: number;
};

const STRETCH_HOLD: ProgramDose = { kind: 'hold', sets: 4, seconds: 30, restSeconds: 30 };
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
  warmupSlug: 'brisk_walk',
  warmupMinutes: [5, 10],
  strengthRest: 45,
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
    },
    {
      n: 2,
      slug: 'crossover_arm_stretch',
      block: 'stretch',
      dose: STRETCH_HOLD,
      daysPerWeek: [5, 6],
      sides: 'both',
    },
    {
      n: 3,
      slug: 'stick_internal_rotation_stretch',
      block: 'stretch',
      dose: STRETCH_HOLD,
      daysPerWeek: [5, 6],
      sides: 'both',
    },
    {
      n: 4,
      slug: 'stick_external_rotation_stretch',
      block: 'stretch',
      dose: STRETCH_HOLD,
      daysPerWeek: [5, 6],
      sides: 'both',
    },
    {
      n: 5,
      slug: 'sleeper_stretch',
      block: 'stretch',
      dose: STRETCH_HOLD,
      daysPerWeek: [7, 7],
      sides: 'affected',
      noteKey: 'rehab.notes.sleeper',
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
      slug: 'overhead_dumbbell_triceps_extension',
      block: 'dumbbell',
      dose: LIGHT_WEIGHT(3, [8, 12], { sets: 3, reps: [8, 8] }),
      daysPerWeek: [3, 3],
      sides: 'affected',
      load: { startKg: [0.5, 1], maxKg: [2, 2] },
      noteKey: 'rehab.notes.overhead',
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
    { key: 'A', warmup: false, blocks: ['stretch'], daysPerWeek: [5, 6] },
    { key: 'B', warmup: true, blocks: ['stretch', 'band', 'stretch_end'], daysPerWeek: [3, 3] },
    {
      key: 'C',
      warmup: true,
      blocks: ['stretch', 'dumbbell', 'stretch_end'],
      daysPerWeek: [3, 3],
    },
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

/** The dose for today: after the person raised the load, fewer reps (Phase 30, §3). */
export function doseFor(ex: ProgramExercise, increased: boolean): ProgramDose {
  if (ex.dose.kind === 'reps' && increased) return { ...ex.dose, ...ex.dose.afterIncrease };
  return ex.dose;
}

/**
 * One program session as a workout the player already knows how to run:
 * warm-up (5 min walk, B and C), stretches 1–5, the band or dumbbell block,
 * the stretches again (B and C). Holds count down (30 s, 30 s rest); one-sided
 * work is split per side, the affected side first.
 */
export function buildProgramSession(
  program: RehabProgram,
  key: 'A' | 'B' | 'C',
  o: {
    library: Exercise[];
    affected: AffectedSide;
    week: number;
    /** Exercises whose load the person raised (slug → true). */
    increased?: Record<string, boolean>;
  },
): GeneratedSession & { missing: string[] } {
  const def = program.sessions.find((s) => s.key === key)!;
  const bySlug = new Map(o.library.map((e) => [e.slug, e]));
  const missing: string[] = [];
  const items: SessionItem[] = [];
  const add = (ex: ProgramExercise, block: NonNullable<SessionItem['block']>) => {
    const e = bySlug.get(ex.slug);
    if (!e) {
      if (!missing.includes(ex.slug)) missing.push(ex.slug);
      return;
    }
    const dose = doseFor(ex, !!o.increased?.[ex.slug]);
    const sides = sidesFor(ex, o.affected);
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
        estSeconds: sets * (dose.seconds + dose.restSeconds),
      });
    } else {
      items.push({
        ...base,
        reps: dose.reps,
        restSeconds: program.strengthRest,
        loadHint: ex.block === 'stretch' ? null : 'light',
        estSeconds: sets * (dose.reps[1] * 4 + program.strengthRest),
      });
    }
  };
  if (def.warmup) {
    const walk = bySlug.get(program.warmupSlug);
    if (walk) {
      items.push({
        id: 'warmup-walk',
        role: 'warmup',
        part: 'warmup_general',
        exerciseId: walk.id,
        targetMuscle: null,
        goal: null,
        sets: 1,
        durationSeconds: program.warmupMinutes[0] * 60,
        restSeconds: 0,
        perSide: false,
        loadHint: null,
        estSeconds: program.warmupMinutes[0] * 60,
        block: 'warmup',
      });
    } else missing.push(program.warmupSlug);
  }
  for (const block of def.blocks) {
    const from = block === 'stretch_end' ? 'stretch' : block;
    for (const ex of program.exercises.filter((x) => x.block === from)) add(ex, block);
  }
  const seconds = items.reduce((n, i) => n + i.estSeconds, 0);
  const minutes = Math.max(1, Math.round(seconds / 60));
  return {
    items,
    minutes,
    warmupMinutes: def.warmup ? program.warmupMinutes[0] : 0,
    cooldownMinutes: Math.round(
      items.filter((i) => i.role === 'cooldown').reduce((n, i) => n + i.estSeconds, 0) / 60,
    ),
    estimatedMinutes: minutes,
    notes: [],
    program: { id: program.id, session: key, week: o.week },
    missing,
  };
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
