import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Chip, Header, Notice, Screen } from '@/components/ui';
import { derive } from '@/features/onboarding/derived';
import { PAIN_AREAS, POSITIONS, STEP_NUMBER, TOTAL_STEPS } from '@/features/onboarding/options';
import { hasRedFlag, toggleInList, visibleConditions } from '@/features/onboarding/safety';
import { useOnboardingStore } from '@/features/onboarding/store';
import { track } from '@/lib/analytics';
import { colors, fonts, spacing } from '@/theme';

/** Mockup 04 — Safety check (step 6 of 7). SPEC §2.2. */
export default function SafetyScreen() {
  const { t } = useTranslation();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const s = useOnboardingStore();
  const derived = derive(s);
  if (!derived) return <Redirect href="/onboarding/who" />;

  const conditions = visibleConditions(derived.mode, s.sex);
  // Drop answers that no longer apply (e.g. body model changed to male).
  const selectedConditions = s.conditions.filter((c) => conditions.includes(c));
  const redFlag = hasRedFlag(s.painAreas, selectedConditions);
  const canContinue = !redFlag || s.redFlagAcknowledged;

  const onContinue = () => {
    s.update({ conditions: selectedConditions, safetyDone: true });
    // Only the fact that a red flag exists; never which one (SPEC §10).
    if (redFlag) track('safety_red_flag');
    if (edit) router.back();
    else router.push('/onboarding/profile');
  };

  const eyebrow = t('onboarding.stepNamed', {
    current: STEP_NUMBER.safety,
    total: TOTAL_STEPS,
    name: t('safety.name'),
  });

  return (
    <Screen
      header={<Header onBack={() => router.back()} eyebrow={eyebrow} />}
      footer={
        <>
          <Button label={t('common.continue')} onPress={onContinue} disabled={!canContinue} />
          <AppText variant="caption" color={colors.muted} style={styles.center}>
            {t('safety.footnote')}
          </AppText>
        </>
      }
    >
      <AppText variant="h1" accessibilityRole="header">
        {t('safety.title')}
      </AppText>

      <Section label={t('safety.pain')}>
        <Chip
          label={t('safety.none')}
          // Two "None" chips: each says what it answers (QA round 2).
          accessibilityLabel={t('safety.noPain')}
          selected={s.painAreas.length === 0}
          onPress={() => s.update({ painAreas: [], redFlagAcknowledged: false })}
        />
        {PAIN_AREAS.map((area) => (
          <Chip
            key={area}
            label={t(`safety.painAreas.${area}`)}
            selected={s.painAreas.includes(area)}
            onPress={() =>
              s.update({ painAreas: toggleInList(s.painAreas, area), redFlagAcknowledged: false })
            }
          />
        ))}
      </Section>

      <Section label={t('safety.health')}>
        <Chip
          label={t('safety.none')}
          accessibilityLabel={t('safety.noConditions')}
          selected={selectedConditions.length === 0}
          onPress={() => s.update({ conditions: [], redFlagAcknowledged: false })}
        />
        {conditions.map((c) => (
          <Chip
            key={c}
            label={t(`safety.conditions.${c}`)}
            selected={selectedConditions.includes(c)}
            onPress={() =>
              s.update({
                conditions: toggleInList(selectedConditions, c),
                redFlagAcknowledged: false,
              })
            }
          />
        ))}
      </Section>

      {redFlag ? (
        <Notice tone="warning" icon title={t('safety.redFlagTitle')}>
          <AppText>{t('safety.redFlagBody')}</AppText>
          <View style={styles.ack}>
            <Chip
              label={t('safety.acknowledge')}
              selected={s.redFlagAcknowledged}
              onPress={() => s.update({ redFlagAcknowledged: !s.redFlagAcknowledged })}
            />
          </View>
        </Notice>
      ) : null}

      <Section label={t('safety.position')}>
        {POSITIONS.map((p) => (
          <Chip
            key={p}
            label={t(`safety.positions.${p}`)}
            selected={s.position === p}
            onPress={() => s.update({ position: p })}
          />
        ))}
      </Section>

      {redFlag ? null : <Notice>{t('safety.noteOk')}</Notice>}
    </Screen>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="label" style={styles.sectionLabel}>
        {label}
      </AppText>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionLabel: { textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: fonts.heading },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  ack: { flexDirection: 'row', marginTop: spacing.sm },
  center: { textAlign: 'center' },
});
