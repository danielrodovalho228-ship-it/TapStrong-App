import { Image } from 'expo-image';
import { normalizeEquipment, presetOf } from '@/features/equipment/catalog';
import { afterOnboarding, finishOnboarding } from '@/features/onboarding/finish';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Button, Card, Header, Notice, Screen, SummaryRow } from '@/components/ui';
import { bodyImage } from '@/features/bodymap/images';
import { derive, summaryNotes } from '@/features/onboarding/derived';
import { restrictionAreas } from '@/features/onboarding/safety';
import { useOnboardingStore } from '@/features/onboarding/store';
import { sexLabelKey } from '@/features/onboarding/visible';
import { measurementText, musclePairs } from '@/features/onboarding/summaries';
import { colors, fonts, makeStyles, radius, spacing, useColors } from '@/theme';

/** Mockup 05 — Profile summary (step 7 of 7). */
export default function ProfileScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const s = useOnboardingStore();
  const derived = derive(s);
  if (!derived || !s.birthMonth || !s.birthYear) return <Redirect href="/onboarding/who" />;
  const { mode, band, age } = derived;

  const measures = measurementText(t, s);
  const sexLabel = t(sexLabelKey(s.sex, mode));
  const restrictions = restrictionAreas(s.painAreas);
  // A preset name, or how many items (improvements v1, C).
  const items = normalizeEquipment(s.equipment);
  const preset = presetOf(items, s.location);
  const equipment = preset
    ? t(`equipmentSettings.presetNames.${preset}`)
    : items.length
      ? t('equipmentSettings.count', { count: items.length })
      : t('profile.bodyweight');

  const rows = [
    {
      key: 'born',
      value: t('profile.bornValue', {
        month: t(`monthsShort.${s.birthMonth}` as 'monthsShort.1'),
        year: s.birthYear,
        group: t(`profile.groups.${mode === 'adult' && s.sex === 'f' ? 'adult_f' : mode}`),
        age,
      }),
      edit: () => router.push({ pathname: '/onboarding/who', params: { edit: '1' } }),
    },
    {
      key: 'bodyModel',
      value: measures ? `${sexLabel} · ${measures}` : sexLabel,
      edit: () =>
        router.push({ pathname: '/onboarding/chat', params: { step: 'body', edit: '1' } }),
    },
    {
      key: 'restrictions',
      value: restrictions.length
        ? restrictions.map((a) => t(`safety.painAreas.${a}`)).join(', ')
        : t('profile.restrictionsNone'),
      edit: () => router.push({ pathname: '/onboarding/safety', params: { edit: '1' } }),
    },
    {
      key: 'conditions',
      value: s.conditions.length
        ? s.conditions.map((c) => t(`safety.conditions.${c}`)).join(', ')
        : t('profile.conditionsNone'),
      edit: () => router.push({ pathname: '/onboarding/safety', params: { edit: '1' } }),
    },
    {
      key: 'position',
      value: t(`safety.positions.${s.position}`),
      edit: () => router.push({ pathname: '/onboarding/safety', params: { edit: '1' } }),
    },
    {
      key: 'goals',
      value: s.muscleGoals.length
        ? musclePairs(t, s.muscleGoals, 'profile.goalPair')
        : t('profile.goalsNone'),
      edit: () =>
        router.push({ pathname: '/onboarding/chat', params: { step: 'focus', edit: '1' } }),
    },
    {
      key: 'schedule',
      value: t('profile.scheduleValue', { minutes: s.minutes, days: s.daysPerWeek }),
      edit: () =>
        router.push({ pathname: '/onboarding/chat', params: { step: 'schedule', edit: '1' } }),
    },
    {
      key: 'equipment',
      value: s.location ? `${t(`locations.${s.location}`)} · ${equipment}` : equipment,
      edit: () =>
        router.push({ pathname: '/onboarding/chat', params: { step: 'schedule', edit: '1' } }),
    },
  ] as const;

  const finish = () => {
    finishOnboarding();
    // 60+ lands on the simple home, never on adult screens (QA B-07).
    router.replace(afterOnboarding(derived.mode === 'senior' ? '/home' : '/body-goals'));
  };

  return (
    <Screen
      header={<Header onBack={() => router.back()} />}
      footer={<Button label={t('profile.cta')} onPress={finish} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <AppText variant="label" color={colors.mutedStrong} style={styles.eyebrow}>
            {t('profile.eyebrow')}
          </AppText>
          <AppText variant="h1" accessibilityRole="header">
            {t('profile.title')}
          </AppText>
        </View>
        <View style={styles.preview} accessibilityLabel={t('profile.bodyPreview')}>
          {s.sex ? (
            <Image source={bodyImage(band, s.sex)} style={styles.previewImage} contentFit="cover" />
          ) : null}
        </View>
      </View>

      <Card style={styles.card}>
        {rows.map((row, i) => (
          <SummaryRow
            key={row.key}
            label={t(`profile.rows.${row.key}`)}
            value={row.value}
            editLabel={t('common.edit')}
            onEdit={row.edit}
            last={i === rows.length - 1}
          />
        ))}
      </Card>

      {summaryNotes(s, mode).map((note) => (
        <Notice key={note} tone={note === 'redFlag' ? 'warning' : 'safety'} icon>
          {t(`profile.notes.${note}`)}
        </Notice>
      ))}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  hero: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.lg },
  heroText: { flex: 1, gap: spacing.sm },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: fonts.heading },
  preview: {
    width: 96,
    height: 172,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.bodyCanvas,
  },
  previewImage: { width: '100%', height: '100%' },
  card: { paddingVertical: spacing.xs, gap: 0 },
}));
