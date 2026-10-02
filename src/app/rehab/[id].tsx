import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Chip,
  Header,
  IconButton,
  Notice,
  Screen,
  TextLink,
} from '@/components/ui';
import { exerciseName } from '@/features/workout/format';
import { useExerciseLibrary } from '@/features/workout/hooks';
import { useRehabRun } from '@/features/rehab/hooks';
import { AFFECTED_SIDES as SIDES, PROGRAM_TAGS } from '@/features/rehab/programs';
import { useRehabStore } from '@/features/rehab/store';
import { Tag } from '@/features/workout/components/Media';
import { addDays, localDate } from '@/lib/dates';
import { colors, fonts, makeStyles, radius, spacing, useColors } from '@/theme';

const SESSION_KEYS = ['A', 'B', 'C'] as const;

/**
 * A rehab program (Phase 30): what it is, the safety rules ("?"), the
 * affected side, today's suggested session, the 6 weeks, maintenance after
 * them, and the exercises to review after "I feel pain".
 */
export default function RehabProgramScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { program, run, week, suggestion, missing, done, today, minor, start } = useRehabRun(id);
  const store = useRehabStore();
  const library = useExerciseLibrary();
  if (!program) return <Redirect href="/rehab" />;
  const name = `rehab.programs.${program.id as 'shoulder_mobility_strength'}` as const;
  const weeks = program.weeks[1];
  const after = week > weeks;
  const available = missing.length === 0;

  const help = (
    <IconButton
      icon="help"
      accessibilityLabel={t('rehab.help')}
      onPress={() =>
        router.push({ pathname: '/rehab/safety', params: { id: program.id, mode: 'help' } })
      }
    />
  );

  const footerNote = (
    <View style={styles.footerNote}>
      <AppText variant="caption" color={colors.mutedStrong}>
        {t(`${name}.source`)}
      </AppText>
      <AppText variant="caption" color={colors.mutedStrong}>
        {t('rehab.educational')}
      </AppText>
    </View>
  );

  if (!run) {
    return (
      <Screen
        header={<Header onBack={() => router.back()} title={t(`${name}.title`)} right={help} />}
        footer={
          <Button
            label={t('rehab.startProgram')}
            disabled={!available}
            onPress={() =>
              router.push({ pathname: '/rehab/safety', params: { id: program.id, mode: 'start' } })
            }
          />
        }
      >
        {minor ? <Notice tone="warning">{t('rehab.minor')}</Notice> : null}
        <AppText>{t(`${name}.body`)}</AppText>
        <View style={styles.tags}>
          {PROGRAM_TAGS.map((k) => (
            <Tag key={k} label={t(`rehab.tags.${k}`)} tone="teal" />
          ))}
        </View>
        {SESSION_KEYS.map((k) => (
          <Card key={k} style={styles.card}>
            <AppText variant="bodyStrong">{t(`rehab.sessions.${k}.title`)}</AppText>
            <AppText variant="caption" color={colors.mutedStrong}>
              {t(`rehab.sessions.${k}.body`)}
            </AppText>
          </Card>
        ))}
        {!available ? <Notice>{t('rehab.unavailable')}</Notice> : null}
        {footerNote}
      </Screen>
    );
  }

  const todayKey = suggestion?.session ?? null;
  const doneDays = new Set(
    done.map((w) => localDate(new Date(w.endedAt ?? w.startedAt ?? w.createdAt))),
  );
  const reviews = Object.keys(run.review);
  const bySlug = new Map(library.map((e) => [e.slug, e]));

  return (
    <Screen
      header={
        <Header
          onBack={() => router.back()}
          title={t(`${name}.title`)}
          eyebrow={
            after && run.maintenance
              ? t('rehab.maintenanceOn')
              : t('rehab.week', { week: Math.min(week, weeks), total: weeks })
          }
          right={help}
        />
      }
      footer={
        todayKey && available ? (
          <Button
            label={t('rehab.startSession', { session: todayKey })}
            onPress={() => start(todayKey)}
          />
        ) : undefined
      }
    >
      {minor ? <Notice tone="warning">{t('rehab.minor')}</Notice> : null}
      {!available ? <Notice>{t('rehab.unavailable')}</Notice> : null}

      {after && !run.maintenance ? (
        <Card style={styles.card} testID="rehab-maintenance-offer">
          <AppText variant="bodyStrong">{t('rehab.maintenanceOffer')}</AppText>
          <Button
            variant="secondary"
            label={t('rehab.maintenanceYes')}
            onPress={() => store.setMaintenance(program.id, true)}
          />
        </Card>
      ) : null}

      <Card style={styles.card} testID="rehab-today">
        {todayKey ? (
          <>
            <AppText variant="h2">{t('rehab.today', { session: todayKey })}</AppText>
            <AppText variant="bodyStrong">{t(`rehab.sessions.${todayKey}.title`)}</AppText>
            <AppText variant="caption" color={colors.mutedStrong}>
              {t(`rehab.sessions.${todayKey}.body`)}
            </AppText>
          </>
        ) : (
          <AppText>{t('rehab.restToday')}</AppText>
        )}
      </Card>

      <Card style={styles.card}>
        <AppText variant="bodyStrong">
          {t('rehab.sideCurrent', {
            side: t(`rehab.sideOptions.${run.side}`).toLowerCase(),
          })}
        </AppText>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {SIDES.map((s) => (
            <Chip
              key={s}
              label={t(`rehab.sideOptions.${s}`)}
              selected={run.side === s}
              accessibilityRole="radio"
              accessibilityState={{ checked: run.side === s }}
              onPress={() => store.setSide(program.id, s)}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.card} testID="rehab-calendar">
        <AppText variant="h3">{t('rehab.calendar')}</AppText>
        {Array.from({ length: weeks }, (_, w) => {
          const days = Array.from({ length: 7 }, (_, d) => addDays(run.startedAt, w * 7 + d));
          const count = days.filter((d) => doneDays.has(d)).length;
          return (
            <View
              key={w}
              style={styles.weekRow}
              accessible
              accessibilityLabel={`${t('rehab.week', { week: w + 1, total: weeks })}: ${t(
                'rehab.calendarDone',
                { count },
              )}`}
            >
              <AppText
                variant="caption"
                color={w + 1 === week ? colors.ink : colors.mutedStrong}
                style={styles.weekLabel}
              >
                {t('rehab.calendarWeek', { n: w + 1 })}
              </AppText>
              {days.map((d) => (
                <View
                  key={d}
                  testID={doneDays.has(d) ? 'rehab-day-done' : undefined}
                  style={[
                    styles.day,
                    doneDays.has(d) && styles.dayDone,
                    d === today && styles.dayToday,
                  ]}
                />
              ))}
            </View>
          );
        })}
      </Card>

      {reviews.length ? (
        <Card style={styles.card} testID="rehab-review">
          <AppText variant="h3">{t('rehab.review')}</AppText>
          {reviews.map((slug) => (
            <View key={slug} style={styles.reviewRow}>
              <AppText style={styles.flex}>{exerciseName(t, bySlug.get(slug), slug)}</AppText>
              <TextLink
                label={t('rehab.reviewDone')}
                onPress={() => store.clearReview(program.id, slug)}
              />
            </View>
          ))}
        </Card>
      ) : null}

      <AppText variant="h3">{t('rehab.otherSessions')}</AppText>
      {SESSION_KEYS.filter((k) => k !== todayKey).map((k) => (
        <Card key={k} style={styles.card}>
          <AppText variant="bodyStrong">{t(`rehab.sessions.${k}.title`)}</AppText>
          <AppText variant="caption" color={colors.mutedStrong}>
            {t(`rehab.sessions.${k}.body`)}
          </AppText>
          <Button
            variant="secondary"
            label={t('rehab.startSession', { session: k })}
            disabled={!available}
            onPress={() => start(k)}
          />
        </Card>
      ))}

      <Button
        variant="ghost"
        label={t('rehab.stop')}
        onPress={() => {
          store.stop(program.id);
          router.replace('/rehab');
        }}
      />
      {footerNote}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  card: { gap: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  weekLabel: { width: 32, fontFamily: fonts.headingSemi },
  day: {
    flex: 1,
    height: 22,
    borderRadius: radius.chip,
    backgroundColor: colors.line,
  },
  dayDone: { backgroundColor: colors.teal },
  dayToday: { borderWidth: 2, borderColor: colors.ink },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  footerNote: { gap: spacing.xs },
}));
