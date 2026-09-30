import i18n from '@/i18n';
import { FACTS } from '@/features/moments/facts';
import { muscleByKey } from '@/features/muscles';
import type { BodyBand } from '@/features/profile/age';

import { THINGS } from './fun';
import type { ShareLink } from './store';
import type { CardData, LitMuscles, ShareTemplate } from './types';

/**
 * The public page of a shared card (Phase 28, D). The row keeps the card's
 * safe data and how the map looked (sex and body band). Whatever comes back
 * from the server is rebuilt field by field from known values only: muscle
 * keys, exercise ids, Moment kinds, fact ids and bounded numbers. A
 * hand-made link can never put its own words on tapstrong.app.
 */
export type CardLook = { sex: 'f' | 'm'; band: BodyBand };

export const TEMPLATES: readonly ShareTemplate[] = [
  'workout',
  'sticker',
  'muscle',
  'exercise',
  'achievement',
  'week',
  'month',
  'fun',
];
const BANDS: readonly BodyBand[] = ['kid', 'teen', 'young', 'adult', 'mid', 'senior', 'elder'];
// Links are for adults and 60+ only (the database refuses minors too).
const ADULT_BANDS: readonly BodyBand[] = ['young', 'adult', 'mid', 'senior', 'elder'];

/** What the app sends to `share_links.data`. */
export function linkData(link: Pick<ShareLink, 'data'>, look: CardLook) {
  return { ...link.data, look };
}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, max = 100_000): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null;
const int = (v: unknown, max?: number) => {
  const n = num(v, max);
  return n === null ? null : Math.round(n);
};
const muscle = (v: unknown): string | null =>
  typeof v === 'string' && !!muscleByKey(v) ? v : null;
const muscles = (v: unknown, max = 40): string[] | null =>
  Array.isArray(v) && v.length <= max && v.every((m) => muscle(m)) ? (v as string[]) : null;
const exists = (key: string) => i18n.exists(key, { lng: 'en' });
const keyLike = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9_]{1,60}$/.test(v);

function lit(v: unknown): LitMuscles | null {
  if (!isObj(v)) return null;
  const out: LitMuscles = {};
  const entries = Object.entries(v);
  if (entries.length > 60) return null;
  for (const [k, how] of entries) {
    if (!muscle(k) || (how !== 'main' && how !== 'also')) return null;
    out[k] = how;
  }
  return out;
}

function params(v: unknown): Record<string, string | number> | null {
  if (!isObj(v)) return null;
  const out: Record<string, string | number> = {};
  for (const [k, value] of Object.entries(v)) {
    if (k === 'count') {
      const n = int(value);
      if (n === null) return null;
      out.count = n;
    } else if (k === 'muscle') {
      if (!muscle(value)) return null;
      out.muscle = value as string;
    } else if (k === 'fact') {
      if (!FACTS.some((f) => f.id === value)) return null;
      out.fact = value as string;
    } else if (k === 'side') {
      if (!keyLike(value) || !exists(`moments.sides.${value}`)) return null;
      out.side = value;
    } else return null;
  }
  return out;
}

/** The card, rebuilt from known values only; null if anything is off. */
export function sanitizeCard(template: unknown, raw: unknown): CardData | null {
  if (!TEMPLATES.includes(template as ShareTemplate) || !isObj(raw)) return null;
  if (raw.template !== template) return null;
  switch (template as ShareTemplate) {
    case 'workout':
    case 'sticker': {
      const targets = muscles(raw.targets, 8);
      const l = lit(raw.lit);
      const [minutes, exercises, sets, streak] = [
        int(raw.minutes, 600),
        int(raw.exercises, 60),
        int(raw.sets, 300),
        int(raw.streak, 5000),
      ];
      if (!targets || !l || minutes === null || exercises === null || sets === null) return null;
      if (streak === null) return null;
      return { template: template as 'workout', targets, lit: l, minutes, exercises, sets, streak };
    }
    case 'muscle':
      return muscle(raw.muscle) ? { template: 'muscle', muscle: raw.muscle as string } : null;
    case 'exercise': {
      const primary = muscles(raw.primary, 12);
      const secondary = muscles(raw.secondary, 12);
      const id = raw.exerciseId;
      if (!keyLike(id) || !exists(`exercises.${id}.name`) || !primary || !secondary) return null;
      return { template: 'exercise', exerciseId: id, primary, secondary, poster: !!raw.poster };
    }
    case 'achievement': {
      const kind = raw.kind;
      const p = params(raw.params);
      const l = lit(raw.lit);
      if (!keyLike(kind) || !p || !l) return null;
      if (
        kind !== 'fact' &&
        !exists(`moments.kinds.${kind}_other`) &&
        !exists(`moments.kinds.${kind}`)
      )
        return null;
      if (kind === 'coach_pain') return null;
      return { template: 'achievement', kind, params: p, lit: l };
    }
    case 'week': {
      const days = raw.days;
      const l = lit(raw.lit);
      const workouts = int(raw.workouts, 50);
      if (!Array.isArray(days) || days.length !== 7 || !days.every((d) => typeof d === 'boolean'))
        return null;
      if (!l || workouts === null) return null;
      return { template: 'week', days: days as boolean[], lit: l, workouts };
    }
    case 'month': {
      const highlight = raw.highlight === null ? null : muscle(raw.highlight);
      const l = lit(raw.lit);
      const [workouts, days, minutes] = [
        int(raw.workouts, 200),
        int(raw.days, 62),
        int(raw.minutes, 20_000),
      ];
      const monthOf = raw.monthOf;
      if (highlight === null && raw.highlight !== null) return null;
      if (!l || workouts === null || days === null || minutes === null) return null;
      if (typeof monthOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(monthOf)) return null;
      return { template: 'month', highlight, lit: l, workouts, days, minutes, monthOf };
    }
    case 'fun': {
      const count = num(raw.count, 10_000);
      if (!THINGS.some((t) => t.key === raw.thing) || count === null) return null;
      return { template: 'fun', thing: raw.thing as string, count: Math.round(count * 2) / 2 };
    }
  }
}

export function sanitizeLook(raw: unknown): CardLook {
  const look = isObj(raw) && isObj(raw.look) ? raw.look : {};
  const band = BANDS.includes(look.band as BodyBand) ? (look.band as BodyBand) : 'adult';
  return {
    sex: look.sex === 'm' ? 'm' : 'f',
    band: ADULT_BANDS.includes(band) ? band : 'adult',
  };
}

/** An invite code as the referral flow expects it. */
export function sanitizeInvite(raw: unknown): string | null {
  return typeof raw === 'string' && /^[A-Z2-9]{6,10}$/.test(raw) ? raw : null;
}
