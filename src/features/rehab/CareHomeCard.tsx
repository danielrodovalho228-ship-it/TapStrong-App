import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { colors, makeStyles, radius, spacing, useColors } from '@/theme';

import { dayKind } from './daily';
import { useRehabRun } from './hooks';
import { useRehabStore } from './store';

/**
 * The care program's own card on Home (Phase 30 addendum §6.1), next to
 * "Today's workout": one doesn't replace the other, each has its progress.
 * On a training day only the stretches go first, as a warm-up, and the
 * strengthening comes after the workout (Daniel, Oct 3).
 */
export function CareHomeCards({ skip }: { skip?: string | null } = {}) {
  const runs = useRehabStore((s) => s.runs);
  return (
    <>
      {Object.keys(runs)
        .filter((id) => id !== skip)
        .map((id) => (
          <CareHomeCard key={id} programId={id} />
        ))}
    </>
  );
}

function CareHomeCard({ programId }: { programId: string }) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const {
    program,
    run,
    daily,
    dailyDone,
    firstDone,
    dailyMinutes,
    suggestion,
    missing,
    finish,
    trainingDay,
  } = useRehabRun(programId);
  if (!program || !run || missing.length) return null;
  // Maintenance: only on its 2–3 days a week.
  if (!daily && !suggestion?.session) return null;
  // After today's workout: "Finish with the shoulder" (Daniel, Oct 3).
  if (finish?.due) return <CareFinishCard programId={programId} />;
  const name = t(`rehab.short.${program.id as 'shoulder_mobility_strength'}`);
  const done = daily ? (finish ? firstDone : dailyDone) : false;
  const detail = daily
    ? // What the session really is (Phase 32 B4), never "stretches only" over a strength list.
      [
        t(`rehab.dayKind.${dayKind(program, daily.numbers)}`),
        t('rehab.daily.minutes', { count: dailyMinutes }),
      ]
    : [t(`rehab.sessions.${suggestion!.session!}.title`)];
  const title = done ? t('rehab.home.done', { name }) : t('rehab.home.title', { name });
  // Only the stretches before the workout; or the whole block, when set to "before".
  const hint = finish
    ? t('rehab.split.stretchFirst')
    : trainingDay && daily?.numbers.length
      ? t('rehab.daily.gymHint')
      : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail.join(', ')}`}
      onPress={() => router.push({ pathname: '/rehab/[id]', params: { id: program.id } })}
      style={styles.card}
      testID={`care-home-${program.id}`}
    >
      <View style={styles.flex}>
        <AppText variant="bodyStrong" color={colors.teal}>
          {title}
        </AppText>
        {!done ? (
          <AppText variant="caption" color={colors.mutedStrong}>
            {detail.join(' · ')}
          </AppText>
        ) : null}
        {!done && hint ? (
          <AppText variant="caption" color={colors.mutedStrong} testID="care-home-hint">
            {hint}
          </AppText>
        ) : null}
      </View>
      <Icon name={done ? 'check' : 'chevron-right'} color={colors.teal} />
    </Pressable>
  );
}

/** "Finish with the shoulder" on the end screen of every regular workout (Daniel, Oct 3). */
export function CareFinishCards() {
  const runs = useRehabStore((s) => s.runs);
  return (
    <>
      {Object.keys(runs).map((id) => (
        <CareFinishCard key={id} programId={id} onlyDue />
      ))}
    </>
  );
}

/** The block's strengthening, after the workout: one tap starts it. */
function CareFinishCard({ programId, onlyDue }: { programId: string; onlyDue?: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const { run, missing, finish } = useRehabRun(programId);
  if (!run || missing.length || !finish || finish.done || (onlyDue && !finish.due)) return null;
  const title = t('rehab.split.finishTitle', { minutes: finish.minutes });
  const body = t('rehab.split.finishBody', { block: t(`rehab.daily.blocks.${finish.block}`) });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      onPress={finish.start}
      style={styles.card}
      testID={`care-finish-${programId}`}
    >
      <View style={styles.flex}>
        <AppText variant="bodyStrong" color={colors.teal}>
          {title}
        </AppText>
        <AppText variant="caption" color={colors.mutedStrong}>
          {body}
        </AppText>
      </View>
      <Icon name="chevron-right" color={colors.teal} />
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.tealTint,
  },
  flex: { flex: 1, gap: spacing.xs },
}));
