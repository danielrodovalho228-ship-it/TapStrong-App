import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Screen } from '@/components/ui';
import { currentPlan } from '@/features/billing/rules';
import { useBillingStore } from '@/features/billing/store';
import { FamilyStrip } from '@/features/family/components/FamilyStrip';
import { summarize } from '@/features/family/profiles';
import { useFamilyStore } from '@/features/family/store';
import { ensureSelfProfile, switchProfile } from '@/features/family/switch';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';
import { kvStorage } from '@/lib/storage';
import { colors, fonts, spacing } from '@/theme';

/** Family tab (SPEC §9 /(tabs)/family, mockup 19): who trains on this phone. */
export default function FamilyScreen() {
  const { t } = useTranslation();
  const live = useOnboardingStore();
  const { profiles, activeId } = useFamilyStore();
  const entitlement = useBillingStore((s) => s.entitlement);
  const plan = currentPlan(entitlement, clock.now());
  const list = profiles.length ? profiles : [ensureSelfProfile()];

  const open = (id: string) => {
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
      <AppText color={colors.mutedStrong}>
        {plan === 'family' ? t('family.planOn') : t('family.planOff')}
      </AppText>
      <Button
        variant={plan === 'free' ? 'accent' : 'secondary'}
        label={plan === 'free' ? t('family.seePlans') : t('family.manage')}
        onPress={() => router.push(plan === 'free' ? '/plans' : '/billing')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0, paddingVertical: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  flex: { flex: 1 },
  caps: { textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: fonts.headingSemi },
});
