import type { TFunction } from 'i18next';

import { muscleLabel } from '@/features/onboarding/summaries';

import type { StoredMoment } from './store';

type T = TFunction;
const tt = (t: T, key: string, options?: object) =>
  (t as unknown as (k: string, o?: object) => string)(key, options);

/** The Moment's line in the person's language. */
export function momentText(
  t: T,
  m: Pick<StoredMoment, 'kind' | 'params'>,
  locale: string,
  now: Date,
) {
  const p = m.params;
  if (m.kind === 'fact') return tt(t, `moments.facts.${p.fact}`);
  return tt(t, `moments.kinds.${m.kind}`, {
    count: p.count,
    muscle: p.muscle ? muscleLabel(t, String(p.muscle)) : undefined,
    area: p.area ? tt(t, `moments.areas.${p.area}`) : undefined,
    side: p.side ? tt(t, `moments.sides.${p.side}`) : undefined,
    month: now.toLocaleDateString(locale, { month: 'long' }),
  });
}

/** The small line above it: "A moment", or "Today's muscle: Glutes". */
export function momentEyebrow(t: T, m: Pick<StoredMoment, 'kind' | 'muscles'>) {
  if (m.kind === 'fact' && m.muscles?.[0])
    return tt(t, 'moments.factEyebrow', { muscle: muscleLabel(t, m.muscles[0]) });
  return tt(t, 'moments.eyebrow');
}
