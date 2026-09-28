import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Header, Notice, Screen } from '@/components/ui';

import { ParentGate } from './ParentGate';
import { isOwnerProfile, useOwnerIdentityStore } from './ownerIdentity';
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
  if (isOwnerProfile(active, ownerId)) return 'owner';
  // A "self" profile whose id doesn't match the secure record was edited: parent gate.
  if (active?.kind === 'self') return 'gate';
  return active?.kind === 'child' ? 'gate' : 'managed';
}

/** Wraps an owner-only screen. */
export function OwnerOnly({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const access = useOwnerAccess();
  const [passed, setPassed] = useState(false);
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
