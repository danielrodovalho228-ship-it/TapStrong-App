import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import type { BodyBand } from '@/features/profile/age';
import { ExerciseCard, PhaseCard } from '@/features/plan/PlanCards';
import type { SessionItem } from '@/features/generator/types';
import { doseText, exerciseName } from '@/features/workout/format';
import { useExerciseLibrary } from '@/features/workout/hooks';
import { colors, makeStyles, radius, spacing, useColors } from '@/theme';

import { useRehabRun } from './hooks';
import { programById } from './programs';
import { useRehabStore } from './store';

/**
 * While the shoulder program runs it is the main plan (Phase 32 B7, Daniel):
 * the plan tab shows its week, today's shoulder session as the exercise list
 * (clips and posters), and its start button. After the physio's release the
 * regular plan comes back as the main one.
 */
export function useShoulderMain(): string | null {
  const runs = useRehabStore((s) => s.runs);
  const entry = Object.entries(runs).find(
    ([id, run]) => programById(id)?.area === 'shoulder' && !run.releasedAt && !run.maintenance,
  );
  return entry?.[0] ?? null;
}

export function ShoulderPlanPanel({ programId, band }: { programId: string; band: BodyBand }) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const library = useExerciseLibrary();
  const { program, run, week, todaySession, dayKind, dailyDone, dailyMinutes } =
    useRehabRun(programId);
  if (!program || !run) return null;
  const byId = new Map(library.map((e) => [e.id, e]));
  const weeks = program.weeks[1];
  const items = todaySession?.items ?? [];
  const warm = items.filter((i) => i.role === 'warmup');
  const mains = items.filter((i) => i.role === 'main');
  const cool = items.filter((i) => i.role === 'cooldown');
  const minutes = todaySession?.minutes ?? dailyMinutes;
  const phaseMinutes = (of: SessionItem[]) =>
    Math.max(1, Math.round(of.reduce((n, i) => n + i.estSeconds, 0) / 60));
  const open = () => router.push({ pathname: '/rehab/[id]', params: { id: program.id } });

  return (
    <View style={styles.today} testID="shoulder-main">
      <View style={styles.titleBlock}>
        <AppText variant="bodyStrong" color={colors.accentText} style={styles.center}>
          {t('rehab.main.eyebrow', { week: Math.min(week, weeks), total: weeks })}
        </AppText>
        <AppText variant="h1" style={styles.split} accessibilityRole="header">
          {t(`rehab.dayKind.${dayKind ?? 'mobility'}`)}
        </AppText>
      </View>
      {dailyDone || !todaySession ? (
        <View style={styles.done} testID="shoulder-main-done">
          <Icon name="check" size={28} color={colors.teal} />
          <AppText color={colors.teal}>{t('rehab.daily.done')}</AppText>
        </View>
      ) : (
        <View style={styles.panel}>
          {/* "N exercises · X min" (Phase 32 B7: this line was an empty bar). */}
          <View
            style={styles.summaryRow}
            accessible
            accessibilityLabel={t('program.summary', { count: mains.length, minutes })}
            testID="shoulder-summary"
          >
            <Icon name="bolt" size={18} color={colors.mutedStrong} />
            <AppText variant="h3">{t('plan.exercises', { count: mains.length })}</AppText>
            <Icon name="clock" size={18} color={colors.mutedStrong} />
            <AppText variant="h3">{t('plan.minutes', { count: minutes })}</AppText>
          </View>
          {warm.length ? (
            <PhaseCard
              exercise={byId.get(warm[0].exerciseId)}
              title={t('plan.warmup')}
              detail={t('home.minutesShort', { minutes: phaseMinutes(warm) })}
              onOpen={open}
              testID="shoulder-warmup"
            />
          ) : null}
          {mains.map((item) => {
            const e = byId.get(item.exerciseId);
            return (
              <ExerciseCard
                key={item.id}
                exercise={e}
                name={exerciseName(t, e, item.exerciseId)}
                badge={doseText(t, item)}
                band={band}
                onOpen={open}
              />
            );
          })}
          {cool.length ? (
            <PhaseCard
              exercise={byId.get(cool[0].exerciseId)}
              title={t('plan.cooldown')}
              detail={t('home.minutesShort', { minutes: phaseMinutes(cool) })}
              onOpen={open}
              testID="shoulder-cooldown"
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  today: { gap: spacing.md },
  titleBlock: { alignItems: 'center', gap: spacing.xxs },
  split: { textAlign: 'center', fontStyle: 'italic' },
  center: { textAlign: 'center' },
  done: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  panel: {
    gap: spacing.md,
    marginHorizontal: -spacing.md,
    padding: spacing.md,
    borderRadius: radius.card * 2,
    backgroundColor: colors.sunken,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
}));
