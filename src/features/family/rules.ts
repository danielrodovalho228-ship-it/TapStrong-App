import { kidsUnder13Enabled } from '@/lib/features';

import { currentPlan, FAMILY_MAX_PROFILES } from '../billing/rules';
import type { Entitlement } from '../billing/store';
import { evaluateAgeGate } from '../onboarding/age-gate';
import { currentYearMonth, type YearMonth } from '../profile/age';

import type { LocalProfile } from './store';

export type ChildBlocker =
  /** Kids under 13 are off for launch (Phase 12). */
  | 'disabled'
  | 'bad_params'
  | 'not_child'
  | 'too_young'
  | 'owner_minor'
  | 'full'
  | 'need_family'
  | 'not_charged';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Re-checks everything the consent screen needs, from the app's own state,
 * never from its URL (QA B-06): a valid new id, a child of 9–12, an adult
 * owner (only an adult can give parental consent, QA R2-04), room in the
 * family, and a charged Family plan (a trial is not consent).
 */
export function childConsentBlocker(input: {
  id: string | undefined;
  birth: Partial<YearMonth>;
  profiles: LocalProfile[];
  entitlement: Entitlement;
  now: Date;
  today?: YearMonth;
  /** The account owner's age; null when unknown (not consent either). */
  ownerAge: number | null;
}): ChildBlocker | null {
  const { id, birth, profiles, entitlement, now } = input;
  if (!kidsUnder13Enabled()) return 'disabled';
  if (!id || !UUID.test(id) || profiles.some((p) => p.id === id)) return 'bad_params';
  if (!birth.year || !birth.month || birth.month < 1 || birth.month > 12) return 'bad_params';
  const gate = evaluateAgeGate(
    'child',
    { year: birth.year, month: birth.month },
    input.today ?? currentYearMonth(),
  );
  if (gate.status === 'too_young') return 'too_young';
  if (gate.status !== 'guardian_consent') return 'not_child';
  if (input.ownerAge == null || input.ownerAge < 18) return 'owner_minor';
  if (profiles.length >= FAMILY_MAX_PROFILES) return 'full';
  if (currentPlan(entitlement, now) !== 'family') return 'need_family';
  if (entitlement.status === 'trial' || !entitlement.firstChargedAt) return 'not_charged';
  return null;
}
