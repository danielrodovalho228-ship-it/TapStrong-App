import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
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
  ToggleRow,
} from '@/components/ui';
import { remindersAvailable, requestPermission } from '@/features/notifications/apply';
import { weeklyTarget } from '@/features/rehab/daily';
import { RETURN_DAYS } from '@/features/rehab/protect';
import i18n from '@/i18n';
import { exerciseName } from '@/features/workout/format';
import { useExerciseLibrary } from '@/features/workout/hooks';
import { useRehabRun } from '@/features/rehab/hooks';
import { AFFECTED_SIDES as SIDES, PROGRAM_TAGS, usableExercises } from '@/features/rehab/programs';
import { RomPicker } from '@/features/rehab/RomPicker';
import { WeekSquares } from '@/features/rehab/WeekSquares';
import { MoreOptions } from '@/features/home/MoreOptions';
import { CLEARANCES, useRehabStore } from '@/features/rehab/store';
import { Tag } from '@/features/workout/components/Media';
import { addDays, localDate } from '@/lib/dates';
import { colors, fonts, makeStyles, radius, spacing, useColors } from '@/theme';

const SESSION_KEYS = ['A', 'B', 'C'] as const;

/**
 * A rehab program (Phase 30): what it is, the safety rules ("?"), the
 * affected side, today's plan in the daily rhythm (addendum §6.2: stretches
 * every day, two blocks taking turns) with this week's checklist, the sleeper
 * breaks, how the regular workout protects the shoulder (§6.4), the 6 weeks,
 * the physio's release and maintenance (§6.5), and the exercises to review
 * after "I feel pain".
 */
export default function RehabProgramScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    program,
    run,
    week,
    suggestion,
    missing,
    done,
    today,
    minor,
    start,
    daily,
    dailyDone,
    firstDone,
    dailyMinutes,
    finish,
    inWorkout,
    trainingDay,
    setTiming,
    counts,
    startDaily,
    swapBlock,
    startSleeper,
    sleeperToday,
    care,
    askRelease,
    strengthOpen,
    dayKind: dayKindToday,
    logSleeper,
    streak,
    weekDone,
    romWeeks,
    romToday,
    logRom,
  } = useRehabRun(id);
  const store = useRehabStore();
  const library = useExerciseLibrary();
  const [notYet, setNotYet] = useState(false);
  if (!program) return <Redirect href="/rehab" />;
  const returnDate = run?.releasedAt
    ? new Date(`${addDays(run.releasedAt, RETURN_DAYS)}T12:00:00`).toLocaleDateString(
        i18n.language,
        { day: 'numeric', month: 'short' },
      )
    : '';
  const toggleReminders = async (on: boolean) => {
    if (on && !(await requestPermission())) return;
    store.setSleeperReminders(program.id, on);
  };
  const name = `rehab.programs.${program.id as 'shoulder_mobility_strength'}` as const;
  const weeks = program.weeks[1];
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

  const todayKey = daily ? null : (suggestion?.session ?? null);
  // Older runs stored only yes/no; nothing is shown selected until answered (Phase 32 A2).
  const answer =
    run.clearance ?? (run.cleared === true ? 'yes' : run.cleared === false ? 'no' : null);
  const doneDays = new Set(
    done.map((w) => localDate(new Date(w.endedAt ?? w.startedAt ?? w.createdAt))),
  );
  const reviews = Object.keys(run.review);
  const bySlug = new Map(library.map((e) => [e.slug, e]));
  const byN = new Map(program.exercises.map((x) => [x.n, x]));
  const nameOf = (slug: string) => exerciseName(t, bySlug.get(slug), slug);
  // On a training day the block's strengthening can come after the workout (Daniel, Oct 3).
  const block = finish?.block ?? daily?.block;
  const otherBlock = block === 'standing' ? 'floor' : 'standing';
  // Exercises this person never does (behind the back): not in the checklist either.
  const usable = new Set(usableExercises(program, library, strengthOpen).map((x) => x.n));

  // "Today": one big button (Phase 32 C, "Simple").
  const footer = daily ? (
    !available || dailyDone ? undefined : !firstDone ? (
      <Button size="xl" label={t('rehab.daily.start')} onPress={startDaily} />
    ) : finish ? (
      <Button size="xl" label={t('rehab.split.startAfter')} onPress={finish.start} />
    ) : undefined
  ) : todayKey && available ? (
    <Button
      size="xl"
      label={t('rehab.startSession', { session: todayKey })}
      onPress={() => start(todayKey)}
    />
  ) : undefined;

  return (
    <Screen
      header={
        <Header
          onBack={() => router.back()}
          title={t(`${name}.title`)}
          eyebrow={
            run.maintenance
              ? t('rehab.maintenanceOn')
              : t('rehab.week', { week: Math.min(week, weeks), total: weeks })
          }
          right={help}
        />
      }
      footer={footer}
    >
      {minor ? <Notice tone="warning">{t('rehab.minor')}</Notice> : null}
      {!available ? <Notice>{t('rehab.unavailable')}</Notice> : null}

      {/* "Week 1 done. Your shoulder thanks you." (Phase 32 C, "Surprising"). */}
      {weekDone ? (
        <Card style={[styles.card, styles.cheer]} testID="rehab-week-done">
          <AppText variant="h3" color={colors.teal}>
            {t('rehab.weekDone', { n: weekDone })}
          </AppText>
        </Card>
      ) : null}

      {askRelease && !notYet ? (
        <Card style={styles.card} testID="rehab-release">
          <AppText variant="bodyStrong">{t('rehab.release.question')}</AppText>
          <AppText variant="caption" color={colors.mutedStrong}>
            {t('rehab.release.body')}
          </AppText>
          <Button
            variant="secondary"
            label={t('rehab.release.yes')}
            onPress={() => store.release(program.id, today)}
          />
          <TextLink label={t('rehab.release.no')} onPress={() => setNotYet(true)} />
        </Card>
      ) : null}

      {/* 1. Today */}
      {daily ? (
        <Card style={styles.card} testID="rehab-today">
          <AppText variant="h2">{t('rehab.daily.title')}</AppText>
          {/* What today really is (Phase 32 B4): mobility, + band, + light dumbbell. */}
          <AppText variant="bodyStrong" testID="rehab-day-kind">
            {t(`rehab.dayKind.${dayKindToday ?? 'mobility'}`)}
          </AppText>
          {dailyDone ? (
            <AppText color={colors.teal} testID="rehab-today-done">
              {t('rehab.daily.done')}
            </AppText>
          ) : (
            <>
              <AppText variant="caption" color={colors.mutedStrong}>
                {t('rehab.daily.minutes', { count: dailyMinutes })}
              </AppText>
              {finish ? (
                <AppText variant="caption" color={colors.mutedStrong} testID="rehab-split-first">
                  {t('rehab.split.stretchFirst')}
                </AppText>
              ) : null}
              {finish ? (
                <AppText variant="caption" testID="rehab-split-after">
                  {t('rehab.split.after', { block: t(`rehab.daily.blocks.${finish.block}`) })}
                </AppText>
              ) : null}
              {(finish?.numbers ?? daily.numbers).map((n) => (
                <AppText key={n} variant="caption">
                  {t('rehab.numbered', { n, name: nameOf(byN.get(n)!.slug) })}
                </AppText>
              ))}
              {inWorkout.length ? (
                <AppText variant="caption" color={colors.mutedStrong} testID="rehab-in-workout">
                  {t('rehab.split.inWorkout', {
                    names: inWorkout.map((n) => nameOf(byN.get(n)!.slug)).join(', '),
                  })}
                </AppText>
              ) : null}
              {daily.catchUp.length ? (
                <AppText variant="caption" color={colors.mutedStrong}>
                  {t('rehab.daily.catchUp', { count: daily.catchUp.length })}
                </AppText>
              ) : null}
              {daily.nextWeek.length ? (
                <AppText variant="caption" color={colors.mutedStrong}>
                  {t('rehab.daily.nextWeek')}
                </AppText>
              ) : null}
              {trainingDay && !finish && daily.numbers.length ? (
                <AppText variant="caption" color={colors.mutedStrong}>
                  {t('rehab.daily.gymHint')}
                </AppText>
              ) : null}
              {block && block !== 'stretch' ? (
                <TextLink
                  label={t('rehab.daily.swap', {
                    block: t(`rehab.sessionNames.${otherBlock}`),
                  })}
                  onPress={() => swapBlock(otherBlock)}
                />
              ) : null}
            </>
          )}
          {strengthOpen ? null : (
            <AppText variant="caption" testID="rehab-strength-locked">
              {t('rehab.care.strengthLocked')}
            </AppText>
          )}
        </Card>
      ) : (
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
      )}

      {/* The sleeper stretch: 1 tap to log a break (Phase 32 C). */}
      {daily ? (
        <Card style={styles.card} testID="rehab-sleeper">
          <View style={styles.reviewRow}>
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{t('rehab.sleeper.title')}</AppText>
              <AppText variant="caption" color={colors.mutedStrong}>
                {t('rehab.sleeper.today', { n: Math.min(sleeperToday, 3) })}
              </AppText>
            </View>
            <Button
              variant="secondary"
              label={t('rehab.sleeper.log')}
              disabled={!available || sleeperToday >= 3}
              onPress={logSleeper}
              testID="rehab-sleeper-log"
            />
          </View>
          <TextLink label={t('rehab.sleeper.start')} onPress={startSleeper} disabled={!available} />
        </Card>
      ) : null}

      {/* 2. Week: the 7 squares, the days in a row, the range of the week. */}
      <Card style={styles.card} testID="rehab-week-card">
        <AppText variant="h3">{t('rehab.weekTitle')}</AppText>
        <WeekSquares today={today} done={doneDays} streak={streak} />
        <AppText variant="bodyStrong">{t('rehab.rom.title')}</AppText>
        <RomPicker value={romToday} onPick={logRom} weeks={romWeeks} />
      </Card>

      {reviews.length ? (
        <Card style={styles.card} testID="rehab-review">
          <AppText variant="h3">{t('rehab.review')}</AppText>
          {reviews.map((slug) => (
            <View key={slug} style={styles.reviewRow}>
              <AppText style={styles.flex}>{nameOf(slug)}</AppText>
              <TextLink
                label={t('rehab.reviewDone')}
                onPress={() => store.clearReview(program.id, slug)}
              />
            </View>
          ))}
        </Card>
      ) : null}

      {/* 3. Shoulder settings, collapsed. */}
      <MoreOptions label={t('rehab.settingsTitle')} testID="rehab-settings">
        <Card style={styles.card} testID="rehab-care">
          <AppText variant="h3">{t('rehab.care.title')}</AppText>
          {care === 'none' ? null : (
            <AppText variant="caption" testID={`rehab-care-${care}`}>
              {care === 'returning'
                ? t('rehab.care.returning', { date: returnDate })
                : t(`rehab.care.${care}`)}
            </AppText>
          )}
          {!run.releasedAt ? (
            <>
              <AppText variant="caption" color={colors.mutedStrong}>
                {t('rehab.care.question')}
              </AppText>
              <View style={styles.chips} accessibilityRole="radiogroup">
                {CLEARANCES.map((v) => (
                  <Chip
                    key={v}
                    testID={`rehab-clear-${v}`}
                    label={t(`rehab.care.${v}`)}
                    selected={answer === v}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: answer === v }}
                    onPress={() => store.setCleared(program.id, v)}
                  />
                ))}
              </View>
            </>
          ) : null}
        </Card>
        <Card style={styles.card}>
          <AppText variant="bodyStrong">
            {t('rehab.sideCurrent', {
              side: t(`rehab.sideOptions.${run.side}`).toLowerCase(),
            })}
          </AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {SIDES.map((sd) => (
              <Chip
                key={sd}
                label={t(`rehab.sideOptions.${sd}`)}
                selected={run.side === sd}
                accessibilityRole="radio"
                accessibilityState={{ checked: run.side === sd }}
                onPress={() => store.setSide(program.id, sd)}
              />
            ))}
          </View>
        </Card>
        <Card style={styles.card}>
          <AppText variant="caption" color={colors.mutedStrong}>
            {t('rehab.daily.rhythm')}
          </AppText>
          {/* The day's dose by default; the physio's full dose on request (Daniel, Oct 2). */}
          <ToggleRow
            label={t('rehab.dose.full')}
            value={!!run.fullDose}
            onChange={(v) => store.setFullDose(program.id, v)}
          />
          <AppText variant="caption" color={colors.mutedStrong} testID="rehab-dose-note">
            {t(
              run.fullDose
                ? week === 1
                  ? 'rehab.dose.week1'
                  : 'rehab.dose.fullOn'
                : 'rehab.dose.reduced',
            )}
          </AppText>
          {/* After the workout by default; "before" on request (Daniel, Oct 3). */}
          {strengthOpen ? (
            <>
              <ToggleRow
                label={t('rehab.split.timing')}
                value={run.strengthTiming === 'before'}
                onChange={(v) => setTiming(v ? 'before' : 'after')}
              />
              <AppText variant="caption" color={colors.mutedStrong}>
                {t('rehab.split.timingNote')}
              </AppText>
            </>
          ) : null}
          {remindersAvailable ? (
            <ToggleRow
              label={t('rehab.sleeper.reminders')}
              value={run.sleeperReminders}
              onChange={(v) => void toggleReminders(v)}
            />
          ) : (
            <AppText variant="caption" color={colors.mutedStrong}>
              {t('rehab.sleeper.appOnly')}
            </AppText>
          )}
        </Card>
        <Button
          variant="ghost"
          label={t('rehab.stop')}
          onPress={() => {
            store.stop(program.id);
            router.replace('/rehab');
          }}
        />
      </MoreOptions>

      {/* Details: the week checklist, the 6 weeks, the other sessions (Phase 32 C). */}
      <MoreOptions label={t('rehab.details')} testID="rehab-details">
        {daily ? (
          <Card style={styles.card} testID="rehab-checklist">
            <AppText variant="h3">{t('rehab.checklist.title')}</AppText>
            {program.exercises
              .filter((x) => usable.has(x.n))
              .map((x) => {
                const n = counts[x.slug] ?? 0;
                const total = weeklyTarget(program, x);
                return (
                  <View key={x.n} style={styles.reviewRow}>
                    <AppText variant="caption" style={styles.flex}>
                      {t('rehab.numbered', { n: x.n, name: nameOf(x.slug) })}
                    </AppText>
                    <AppText
                      variant="caption"
                      color={n >= total ? colors.teal : colors.mutedStrong}
                      style={styles.count}
                    >
                      {t('rehab.checklist.of', { n: Math.min(n, total), total })}
                    </AppText>
                  </View>
                );
              })}
            <AppText variant="caption" color={colors.mutedStrong}>
              {t('rehab.checklist.hint')}
            </AppText>
          </Card>
        ) : null}

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

        <AppText variant="h3">{t('rehab.otherSessions')}</AppText>
        {SESSION_KEYS.filter((k) => k !== todayKey).map((k) => (
          <Card key={k} style={styles.card}>
            <AppText variant="bodyStrong">{t(`rehab.sessions.${k}.title`)}</AppText>
            <AppText variant="caption" color={colors.mutedStrong}>
              {t(`rehab.sessions.${k}.body`)}
            </AppText>
            {k === 'A' || strengthOpen ? (
              <Button
                variant="secondary"
                label={t('rehab.startSession', { session: k })}
                disabled={!available}
                onPress={() => start(k)}
              />
            ) : (
              <AppText variant="caption" testID={`rehab-locked-${k}`}>
                {t('rehab.lockedSession')}
              </AppText>
            )}
          </Card>
        ))}
      </MoreOptions>
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
  dayDone: { backgroundColor: colors.accent },
  cheer: { backgroundColor: colors.tealTint },
  dayToday: { borderWidth: 2, borderColor: colors.ink },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  count: { fontFamily: fonts.headingSemi },
  flex: { flex: 1 },
  footerNote: { gap: spacing.xs },
}));
