import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Chip, Header, Notice, Screen } from '@/components/ui';
import { useOwnerAccess } from '@/features/family/OwnerOnly';
import { activeMinorLock } from '@/features/family/ownerIdentity';
import { ParentGate } from '@/features/family/ParentGate';
import { derive } from '@/features/onboarding/derived';
import { PAIN_AREAS, POSITIONS, STEP_NUMBER, TOTAL_STEPS } from '@/features/onboarding/options';
import { hasRedFlag, toggleInList, visibleConditions } from '@/features/onboarding/safety';
import { useOnboardingStore } from '@/features/onboarding/store';
import { track } from '@/lib/analytics';
import { fonts, spacing, useColors } from '@/theme';

/** Mockup 04 — Safety check (step 6 of 7). SPEC §2.2. */
export default function SafetyScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const store = useOnboardingStore();
  const derived = derive(store);
  // Editing later works on a draft saved with Continue. A managed teen who
  // removes an answer or changes position needs the parent PIN; adding is
  // always allowed (QA R5-04).
  const access = useOwnerAccess();
  const [draft, setDraft] = useState(() => ({
    painAreas: store.painAreas,
    conditions: store.conditions,
    position: store.position,
    redFlagAcknowledged: store.redFlagAcknowledged,
  }));
  const [gate, setGate] = useState(false);
  if (!derived) return <Redirect href="/onboarding/who" />;
  // Once the check is done, every visit is an edit on a draft, whatever the
  // route (Restrictions, a deep link): a teen's removals always meet the PIN
  // (QA R6-04).
  const staged = !!edit || store.safetyDone;
  const s = staged
    ? {
        ...store,
        ...draft,
        update: (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch })),
      }
    : store;
  const minorGated = access === 'gate' && (derived.mode === 'teen' || derived.mode === 'child');

  const conditions = visibleConditions(derived.mode, s.sex);
  // Drop answers that no longer apply (e.g. body model changed to male).
  const selectedConditions = s.conditions.filter((c) => conditions.includes(c));
  // A locked minor's hidden answers (pregnancy on a boy body model) stay
  // stored and never count as removed (QA R7-02).
  const keptHidden = activeMinorLock() ? s.conditions.filter((c) => !conditions.includes(c)) : [];
  const savedConditions = [...selectedConditions, ...keptHidden];
  const redFlag = hasRedFlag(s.painAreas, selectedConditions);
  const canContinue = !redFlag || s.redFlagAcknowledged;

  const removesSomething =
    store.painAreas.some((a) => !s.painAreas.includes(a)) ||
    store.conditions.some((c) => !savedConditions.includes(c)) ||
    store.position !== s.position;
  const save = () => {
    // Only the fact that a red flag exists; never which one (SPEC §10).
    store.update({
      ...(staged ? draft : {}),
      conditions: savedConditions,
      safetyDone: true,
    });
    if (redFlag) track('safety_red_flag');
    if (edit) router.back();
    else router.push('/onboarding/profile');
  };
  const onContinue = () => {
    if (staged && minorGated && removesSomething) return setGate(true);
    save();
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
          onPress={() => s.update({ conditions: keptHidden, redFlagAcknowledged: false })}
        />
        {conditions.map((c) => (
          <Chip
            key={c}
            label={t(`safety.conditions.${c}`)}
            selected={selectedConditions.includes(c)}
            onPress={() =>
              s.update({
                conditions: [...toggleInList(selectedConditions, c), ...keptHidden],
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
      {gate ? (
        <ParentGate
          onPass={() => {
            setGate(false);
            save();
          }}
          onCancel={() => setGate(false)}
        />
      ) : null}
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
