import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Header, Notice, Screen } from '@/components/ui';
import { clock } from '@/lib/clock';

import { ParentGate } from './ParentGate';
import { isOwnerProfile, minorLockFor, useOwnerIdentityStore } from './ownerIdentity';
import { activeProfile, useFamilyStore } from './store';

/**
 * Who may use owner controls (billing, plans, add member, delete account,
 * the parent's email): the account holder's own profile. A child or teen
 * profile needs the parent gate; a managed adult (60+) profile never sees
 * them (QA B-03, B-07).
 */
export type OwnerAccess = 'owner' | 'gate' | 'managed';

export function useOwnerAccess(): OwnerAccess {
  const active = useFamilyStore(activeProfile);
  const ownerId = useOwnerIdentityStore((s) => s.ownerId);
  const activeId = useOwnerIdentityStore((s) => s.activeId);
  const minors = useOwnerIdentityStore((s) => s.minors);
  if (isOwnerProfile(active, { ownerId, activeId })) return 'owner';
  // Missing or unknown active profile, a "self" that isn't the secure owner, a
  // minor (by the secure record, whatever its kind says): parent gate (R4-05).
  if (!active || active.kind === 'self' || minorLockFor(active, minors)) return 'gate';
  if (activeId && activeId !== active.id) return 'gate';
  return 'managed';
}

/**
 * One owner-only screen opening the next one right after the parent PIN
 * ("Manage" on the Family plan → Billing, QA R10 P2): a one-time pass, kept
 * in memory only, for the same profile and one minute. Handed only from
 * inside a screen whose gate was already passed.
 */
const PASS_MS = 60_000;
let handedPass: { activeId: string | null; at: number } | null = null;
export function handOwnerPass() {
  handedPass = { activeId: useOwnerIdentityStore.getState().activeId, at: clock.now().getTime() };
}
function takeOwnerPass(): boolean {
  const pass = handedPass;
  handedPass = null;
  if (!pass) return false;
  const age = clock.now().getTime() - pass.at;
  return pass.activeId === useOwnerIdentityStore.getState().activeId && age >= 0 && age < PASS_MS;
}

/** Wraps an owner-only screen. */
export function OwnerOnly({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const access = useOwnerAccess();
  const [passed, setPassed] = useState(takeOwnerPass);
  if (access === 'owner' || passed) return <>{children}</>;
  return (
    <Screen header={<Header onBack={() => router.back()} title={t('ownerOnly.title')} />}>
      {access === 'gate' ? (
        <ParentGate onPass={() => setPassed(true)} onCancel={() => router.back()} />
      ) : (
        <>
          <Notice>{t('ownerOnly.managed')}</Notice>
          <Button label={t('common.back')} onPress={() => router.back()} />
        </>
      )}
    </Screen>
  );
}
