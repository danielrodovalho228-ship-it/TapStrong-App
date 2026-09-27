import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Notice, Screen } from '@/components/ui';
import { currentPlan } from '@/features/billing/rules';
import { useBillingStore } from '@/features/billing/store';
import { FamilyStrip } from '@/features/family/components/FamilyStrip';
import { activitySummary, summarize } from '@/features/family/profiles';
import { useOwnerAccess } from '@/features/family/OwnerOnly';
import { ParentGate } from '@/features/family/ParentGate';
import { useFamilyStore, type LocalProfile } from '@/features/family/store';
import { useAccountStore } from '@/features/account/store';
import {
  deleteOrQueue,
  retryPendingDeletes,
  usePendingDeletesStore,
} from '@/features/family/remote';
import { ensureSelfProfile, removeMember, switchProfile } from '@/features/family/switch';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';
import { deviceWeekStart } from '@/lib/dates';
import { kvStorage } from '@/lib/storage';
import { colors, fonts, spacing } from '@/theme';

/** Family tab (SPEC §9 /(tabs)/family, mockup 19): who trains on this phone. */
export default function FamilyScreen() {
  const { t, i18n } = useTranslation();
  const live = useOnboardingStore();
  const { profiles, activeId } = useFamilyStore();
  const entitlement = useBillingStore((s) => s.entitlement);
  const plan = currentPlan(entitlement, clock.now());
  const access = useOwnerAccess();
  const [gateFor, setGateFor] = useState<string | null>(null);
  // Remove member (QA R2-01): parent gate, then an explicit confirmation.
  const [removing, setRemoving] = useState<{ id: string; step: 'gate' | 'confirm' } | null>(null);
  // A failed cloud delete is queued and retried, and the owner is told (QA round 3).
  const pendingDeletes = usePendingDeletesStore((st) => st.ids.length);
  const confirmRemove = (id: string) => {
    removeMember(id);
    void deleteOrQueue(id);
    setRemoving(null);
  };
  useEffect(() => {
    if (pendingDeletes) void retryPendingDeletes();
    // Once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Registering the owner's profile writes to a store: never during render (QA A-10).
  useEffect(() => {
    if (!profiles.length) ensureSelfProfile();
  }, [profiles.length]);
  const selfId = useAccountStore((st) => st.profileId);
  const list: LocalProfile[] = profiles.length
    ? profiles
    : [{ id: selfId, kind: 'self', createdAt: '' }];
  // The owner's view: only from the account holder's own profile.
  const ownerView = (activeId ?? list[0].id) === list.find((p) => p.kind === 'self')?.id;
  const members = list
    .filter((p) => p.kind !== 'self')
    .map((p) => ({
      profile: p,
      summary: activitySummary(p, kvStorage.getItem, clock.now(), deviceWeekStart()),
    }));

  const open = (id: string) => {
    // A child or teen profile can't switch to other profiles without a parent (QA B-03).
    if (access === 'gate' && gateFor !== id) {
      setGateFor(id);
      return;
    }
    setGateFor(null);
    switchProfile(id);
    const done = useOnboardingStore.getState().onboardingComplete;
    router.replace(done ? '/home' : '/onboarding/who');
  };

  return (
    <Screen>
      <AppText variant="h1" accessibilityRole="header">
        {t('family.title')}
      </AppText>
      <FamilyStrip />
      {pendingDeletes ? (
        <Notice>{t('family.removePending', { count: pendingDeletes })}</Notice>
      ) : null}
      {gateFor ? (
        <ParentGate
          onPass={() => {
            const id = gateFor;
            switchProfile(id);
            setGateFor(null);
            const done = useOnboardingStore.getState().onboardingComplete;
            router.replace(done ? '/home' : '/onboarding/who');
          }}
          onCancel={() => setGateFor(null)}
        />
      ) : null}
      <Card style={styles.list}>
        {list.map((p, i) => {
          const s = summarize(p, activeId, live, kvStorage.getItem);
          const name = p.kind === 'self' ? t('family.you') : (p.name ?? t('family.member'));
          const active = p.id === (activeId ?? list[0].id);
          return (
            <View key={p.id} style={[styles.row, i > 0 && styles.divider]}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{name}</AppText>
                <AppText variant="caption" color={colors.muted} style={styles.caps}>
                  {s.mode ? t(`family.modes.${s.mode}`) : t('family.setUp')}
                </AppText>
              </View>
              {active ? (
                <AppText variant="caption" color={colors.teal} style={styles.caps}>
                  {t('family.active')}
                </AppText>
              ) : (
                <Button
                  variant="secondary"
                  fullWidth={false}
                  label={t('family.switch')}
                  accessibilityLabel={t('family.switchTo', { name })}
                  onPress={() => open(p.id)}
                />
              )}
            </View>
          );
        })}
      </Card>
      {ownerView && members.length ? (
        <View style={styles.dashboard}>
          <AppText variant="h3">{t('family.dashboard.title')}</AppText>
          {members.map(({ profile: p, summary }) => (
            <Card key={p.id} style={styles.memberCard}>
              <AppText variant="bodyStrong">{p.name ?? t('family.member')}</AppText>
              {summary && summary.lastWorkoutAt ? (
                <>
                  <AppText color={colors.mutedStrong}>
                    {t('family.dashboard.week', {
                      count: summary.workoutsThisWeek,
                      minutes: summary.minutesThisWeek,
                    })}
                  </AppText>
                  <AppText variant="caption" color={colors.muted}>
                    {t('family.dashboard.last', {
                      date: new Date(summary.lastWorkoutAt).toLocaleDateString(i18n.language, {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                      }),
                      streak: summary.streak,
                    })}
                  </AppText>
                </>
              ) : (
                <AppText color={colors.mutedStrong}>{t('family.dashboard.none')}</AppText>
              )}
              {removing?.id === p.id && removing.step === 'gate' ? (
                <ParentGate
                  onPass={() => setRemoving({ id: p.id, step: 'confirm' })}
                  onCancel={() => setRemoving(null)}
                />
              ) : removing?.id === p.id ? (
                <View style={styles.remove}>
                  <AppText color={colors.mutedStrong}>
                    {t('family.removeBody', { name: p.name ?? t('family.member') })}
                  </AppText>
                  <Button
                    variant="danger"
                    label={t('family.removeConfirm', { name: p.name ?? t('family.member') })}
                    onPress={() => confirmRemove(p.id)}
                  />
                  <Button
                    variant="ghost"
                    label={t('common.cancel')}
                    onPress={() => setRemoving(null)}
                  />
                </View>
              ) : (
                <Button
                  variant="dangerText"
                  label={t('family.remove')}
                  accessibilityLabel={t('family.removeName', {
                    name: p.name ?? t('family.member'),
                  })}
                  onPress={() => setRemoving({ id: p.id, step: 'gate' })}
                />
              )}
            </Card>
          ))}
          <AppText variant="caption" color={colors.muted}>
            {t('family.dashboard.privacy')}
          </AppText>
        </View>
      ) : null}
      <AppText color={colors.mutedStrong}>
        {plan === 'family' ? t('family.planOn') : t('family.planOff')}
      </AppText>
      {access === 'managed' ? (
        <AppText variant="caption" color={colors.muted}>
          {t('ownerOnly.managed')}
        </AppText>
      ) : (
        <Button
          variant={plan === 'free' ? 'accent' : 'secondary'}
          label={plan === 'free' ? t('family.seePlans') : t('family.manage')}
          onPress={() => router.push(plan === 'free' ? '/plans' : '/billing')}
        />
      )}
      <Button variant="ghost" label={t('settings.open')} onPress={() => router.push('/settings')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0, paddingVertical: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  flex: { flex: 1 },
  caps: { textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: fonts.headingSemi },
  dashboard: { gap: spacing.sm },
  memberCard: { gap: spacing.xs },
  remove: { gap: spacing.sm },
});
