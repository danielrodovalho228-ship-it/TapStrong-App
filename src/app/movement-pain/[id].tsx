import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Header, Notice, Screen, TextLink } from '@/components/ui';
import { generateSession } from '@/features/generator';
import { movementCatalog } from '@/features/movement/catalog';
import {
  levelFor,
  lightHistory,
  phaseFor,
  recoveryInput,
  retestDue,
  RETEST_DAYS,
  retestSeries,
  seeTherapist,
} from '@/features/movement/progress';
import { useMovementPainStore } from '@/features/movement/store';
import { LIGHT_COLOR, movementName, PainBars, reportTitle } from '@/features/movement/ui';
import { useExerciseLibrary, useGeneratorInput } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { colors, fonts, radius, spacing } from '@/theme';

const SESSION_MINUTES = 15;
const DAY = 86_400_000;

/** A recovery plan for a movement that hurts (SPEC §8), inside Repair. */
export default function MovementPlanScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const report = useMovementPainStore((s) => s.reports.find((r) => r.id === id));
  const setActive = useMovementPainStore((s) => s.setActive);
  const catalog = useMemo(() => movementCatalog(), []);
  const library = useExerciseLibrary();
  const input = useGeneratorInput(library);
  const create = useWorkoutStore((s) => s.create);
  if (!report || !catalog) return <Redirect href="/restrictions" />;

  const now = clock.now();
  const level = levelFor(report);
  const phase = phaseFor(level);
  const lights = lightHistory(report).slice(-6);
  const series = retestSeries(report);
  const lastRetest = report.retests.at(-1)?.at ?? report.createdAt;
  const nextRetest = new Date(Date.parse(lastRetest) + RETEST_DAYS * DAY).toLocaleDateString(
    i18n.language,
    { month: 'short', day: 'numeric' },
  );
  const list = (keys: typeof report.painful) => keys.map((k) => movementName(t, k)).join(', ');

  const start = () => {
    if (!input) return;
    const session = generateSession(recoveryInput(input, report, catalog, SESSION_MINUTES));
    if (session.error) return;
    const workoutId = create(session, 'repair');
    // No pain details in analytics (SPEC §8): only that a session was built.
    track('workout_generated');
    router.push({ pathname: '/workout/[id]', params: { id: workoutId } });
  };

  return (
    <Screen
      header={
        <Header
          onBack={() => router.back()}
          eyebrow={t('movementPain.eyebrow')}
          title={reportTitle(t, report)}
        />
      }
      footer={
        <Button
          variant="accent"
          label={t('movementPain.plan.start', { minutes: SESSION_MINUTES })}
          onPress={start}
          disabled={!input}
        />
      }
    >
      <Card style={styles.card}>
        <AppText variant="caption" style={styles.caps}>
          {t('movementPain.plan.phase', { phase })}
        </AppText>
        <AppText variant="h3">{t(`movementPain.plan.phases.${phase}`)}</AppText>
        <AppText variant="caption" color={colors.mutedStrong}>
          {t('movementPain.plan.level', { level })}
        </AppText>
        <AppText color={colors.accent}>
          {t('movementPain.plan.hurts', { list: list(report.painful) })}
        </AppText>
        {report.painFree.length ? (
          <AppText color={colors.teal}>
            {t('movementPain.plan.fine', { list: list(report.painFree) })}
          </AppText>
        ) : null}
      </Card>

      {seeTherapist(report, now) ? (
        <Notice tone="warning" title={t('movementPain.plan.seePT')}>
          {t('movementPain.plan.seePTBody')}
        </Notice>
      ) : null}

      <Card style={styles.card}>
        <AppText variant="h3">{t('movementPain.plan.lightTitle')}</AppText>
        {lights.length ? (
          <View style={styles.lights}>
            {lights.map((l) => (
              <View
                key={l.workoutId}
                style={[styles.light, { borderColor: LIGHT_COLOR[l.light] }]}
                accessible
                accessibilityLabel={t(`movementPain.plan.lights.${l.light}`)}
              >
                <AppText variant="caption" color={LIGHT_COLOR[l.light]}>
                  {t(`movementPain.plan.lights.${l.light}`)}
                </AppText>
              </View>
            ))}
          </View>
        ) : (
          <AppText color={colors.mutedStrong}>{t('movementPain.plan.noLights')}</AppText>
        )}
        <AppText variant="caption" color={colors.mutedStrong}>
          {t('movementPain.plan.lightRule')}
        </AppText>
      </Card>

      <Card style={styles.card}>
        <AppText variant="h3">{t('movementPain.plan.retest')}</AppText>
        <AppText variant="caption" color={colors.mutedStrong}>
          {t('movementPain.plan.chart')}
        </AppText>
        <PainBars points={series.map((p) => p.score)} />
        {retestDue(report, now) ? (
          <Button
            variant="secondary"
            label={t('movementPain.plan.retestDue')}
            onPress={() =>
              router.push({ pathname: '/movement-pain/retest', params: { id: report.id } })
            }
          />
        ) : (
          <AppText color={colors.mutedStrong}>
            {t('movementPain.plan.retestNext', { date: nextRetest })}
          </AppText>
        )}
      </Card>

      <TextLink
        label={t('movementPain.plan.better')}
        onPress={() => {
          setActive(report.id, false);
          router.back();
        }}
      />
      <AppText variant="caption" color={colors.muted}>
        {t('movementPain.disclaimer')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  caps: {
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: fonts.headingSemi,
    color: colors.muted,
  },
  lights: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  light: {
    borderWidth: 1.5,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
});
