import { currentPlan, FAMILY_MAX_PROFILES } from '../billing/rules';
import type { Entitlement } from '../billing/store';
import { evaluateAgeGate } from '../onboarding/age-gate';
import { currentYearMonth, type YearMonth } from '../profile/age';

import type { LocalProfile } from './store';

export type ChildBlocker = 'bad_params' | 'not_child' | 'full' | 'need_family' | 'not_charged';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Re-checks everything the consent screen needs, from the app's own state,
 * never from its URL (QA B-06): a valid new id, a child of 9–12, room in the
 * family, and a charged Family plan (a trial is not consent).
 */
export function childConsentBlocker(input: {
  id: string | undefined;
  birth: Partial<YearMonth>;
  profiles: LocalProfile[];
  entitlement: Entitlement;
  now: Date;
  today?: YearMonth;
}): ChildBlocker | null {
  const { id, birth, profiles, entitlement, now } = input;
  if (!id || !UUID.test(id) || profiles.some((p) => p.id === id)) return 'bad_params';
  if (!birth.year || !birth.month || birth.month < 1 || birth.month > 12) return 'bad_params';
  const gate = evaluateAgeGate(
    'child',
    { year: birth.year, month: birth.month },
    input.today ?? currentYearMonth(),
  );
  if (gate.status !== 'guardian_consent') return 'not_child';
  if (profiles.length >= FAMILY_MAX_PROFILES) return 'full';
  if (currentPlan(entitlement, now) !== 'family') return 'need_family';
  if (entitlement.status === 'trial' || !entitlement.firstChargedAt) return 'not_charged';
  return null;
}
