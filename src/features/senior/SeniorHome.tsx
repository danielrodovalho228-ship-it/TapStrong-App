import * as Speech from 'expo-speech';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText, Icon, Screen, TextLink, type IconName } from '@/components/ui';
import { currentPlan } from '@/features/billing/rules';
import { MOBILITY_MINUTES } from '@/features/generator';
import { WeekStrip } from '@/features/program/components/WeekStrip';
import { useBillingStore } from '@/features/billing/store';
import { activeProfile, useFamilyStore } from '@/features/family/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { MonthHomeCard, useMonthCardVisible } from '@/features/month/components/MonthHomeCard';
import { MoreOptions } from '@/features/home/MoreOptions';
import { StartHero } from '@/features/home/StartHero';
import { CareHomeCards } from '@/features/rehab/CareHomeCard';
import { easyDayKey } from '@/features/workout/secondWorkout';
import { useWorkoutStore } from '@/features/workout/store';
import { clock } from '@/lib/clock';
import { colors, fonts, makeStyles, radius, sizes, spacing, useColors } from '@/theme';
import { listText } from '@/lib/listText';

import { dayPart, lastWorkout, relativeDay } from './summary';

/**
 * Mockup 23 — 60+ home: one big "Start", then progress, then an audio
 * summary of the last workout. Links stay inside the simple screens
 * (SPEC §11.10): no body-map or camera entry points from here.
 *
 * Phase 27 (A2): at most 3 things on the screen: the big button (with its
 * greeting and "See workout"), the month card or the last workout, and
 * "More options" (short mobility and balance, the week, progress).
 */
export function SeniorHome({
  onStart,
  onPreview,
  onMobility,
  onBalance,
  targets,
  minutes,
  allRecovering = false,
  weeklyCap = false,
  stoppedToday = false,
  doneToday = false,
}: {
  onStart: () => void;
  /** The workout preview ("See workout"). */
  onPreview?: () => void;
  onMobility: () => void;
  /** Missing when no balance session can be built today (QA R6-07). */
  onBalance?: () => void;
  targets: string[];
  /** The session's own length, not the profile setting (QA R3-06). */
  minutes: number;
  allRecovering?: boolean;
  /** This week's sets are used up for today's muscles (QA R10 P2). */
  weeklyCap?: boolean;
  /** Sharp pain stopped a workout today: gentle options only (QA R5 P2). */
  stoppedToday?: boolean;
  /** Today's workout is done: only mobility, balance or rest (Daniel, Phase 19). */
  doneToday?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t, i18n } = useTranslation();
  const profile = useOnboardingStore();
  const { workouts } = useWorkoutStore();
  const member = useFamilyStore(activeProfile);
  const owner = useFamilyStore((s) => s.profiles.find((p) => p.kind === 'self'));
  const plan = currentPlan(
    useBillingStore((s) => s.entitlement),
    clock.now(),
  );
  const [speaking, setSpeaking] = useState(false);
  const [resting, setResting] = useState(false);
  const now = clock.now();
  const active = workouts.find((w) => w.status === 'active');
  const last = lastWorkout(workouts);
  const goals = targets;
  const managed = !!member && member.kind !== 'self';

  const meta = [
    t('home.senior.today'),
    t('home.senior.minutes', { count: minutes }),
    ...(profile.position === 'seated_only'
      ? [t('home.senior.seated')]
      : profile.position === 'with_support'
        ? [t('home.senior.supported')]
        : []),
  ].join(' · ');

  const lastText = last
    ? [
        t('home.senior.lastBody', { count: last.exercises, minutes: last.minutes }),
        managed && plan === 'family'
          ? owner?.name
            ? t('home.senior.familySees', { name: owner.name })
            : t('home.senior.familySeesPlan')
          : '',
      ]
        .filter(Boolean)
        .join(' ')
    : '';
  // "today" / "yesterday" instead of a weekday that reads like last week (QA P2).
  const lastDay = last ? relativeDay(last.endedAt, now, i18n.language, t) : '';

  const readAloud = async () => {
    if (speaking) {
      await Speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    Speech.speak(`${t('home.senior.lastTitle', { day: lastDay })}. ${lastText}`, {
      language: i18n.language,
      rate: 0.9,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const easyKey = easyDayKey({ stoppedToday, doneToday, weeklyCap });
  const easy = allRecovering && !active;
  const month = useMonthCardVisible();

  return (
    <Screen>
      {/* 1. The greeting and the one big button. */}
      <View style={styles.block}>
        {managed && member.name ? (
          <>
            <AppText color={colors.mutedStrong}>
              {t(`home.senior.greeting.${dayPart(now)}`)}
            </AppText>
            <AppText variant="display" accessibilityRole="header">
              {member.name}
            </AppText>
          </>
        ) : (
          // No name: just "Good morning", never "Good morning, TODAY" (QA P2).
          <AppText variant="h1" accessibilityRole="header">
            {t(`home.senior.greetingAlone.${dayPart(now)}`)}
          </AppText>
        )}
        {easy ? (
          // Everything is still recovering (QA R3-03): balance, mobility or rest.
          <>
            <AppText variant="h2" accessibilityRole="header">
              {t(`home.${easyKey}Title`)}
            </AppText>
            <AppText>{t(`home.${easyKey}Body`)}</AppText>
            <StartHero
              large
              title={onBalance ? t('home.senior.balanceTitle') : t('home.mobilityTitle')}
              detail={t('home.senior.minutes', { count: MOBILITY_MINUTES })}
              onPress={onBalance ?? onMobility}
            />
            <View style={styles.links}>
              <TextLink label={t('home.rest')} onPress={() => setResting(true)} />
            </View>
            {resting ? <AppText color={colors.mutedStrong}>{t('home.restNote')}</AppText> : null}
          </>
        ) : (
          <>
            <StartHero
              large
              eyebrow={meta}
              title={active ? t('home.continue') : t('home.senior.start')}
              detail={goals.length ? listText(goals, t('common.and')) : t('home.senior.balance')}
              onPress={onStart}
            />
            {onPreview ? (
              <View style={styles.links}>
                <TextLink label={t('home.seeWorkout')} onPress={onPreview} />
              </View>
            ) : null}
          </>
        )}
      </View>

      {/* A care program's own card (Phase 30 addendum §6.1). */}
      <CareHomeCards />

      {/* 2. The month's summary (Phase 26), else the last workout. */}
      {month ? (
        <MonthHomeCard onStart={onStart} />
      ) : last ? (
        <View style={styles.last}>
          <AppText variant="bodyStrong" color={colors.teal}>
            {t('home.senior.lastTitle', { day: lastDay })}
          </AppText>
          <AppText color={colors.teal}>{lastText}</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={speaking ? t('home.senior.stopReading') : t('home.senior.readIt')}
            onPress={readAloud}
            style={styles.read}
          >
            <Icon name="speaker" color={colors.teal} />
            <AppText variant="bodyStrong" color={colors.teal}>
              {speaking ? t('home.senior.stopReading') : t('home.senior.readIt')}
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {/* 3. Everything else, one tap away. Short mobility and balance for
          60+ (QA R3-06, R5 P2): free, and they count for the streak. */}
      <MoreOptions>
        {!active && !easy ? (
          <>
            <BigLink
              icon="body"
              label={t('home.mobility', { minutes: MOBILITY_MINUTES })}
              onPress={onMobility}
            />
            {onBalance ? (
              <BigLink
                icon="shield"
                label={t('home.balance', { minutes: MOBILITY_MINUTES })}
                onPress={onBalance}
              />
            ) : null}
          </>
        ) : easy && onBalance ? (
          <BigLink
            icon="body"
            label={t('home.mobility', { minutes: MOBILITY_MINUTES })}
            onPress={onMobility}
          />
        ) : null}
        <BigLink
          icon="progress"
          label={t('home.senior.progress')}
          onPress={() => router.push('/progress')}
        />
        <WeekStrip large />
        <AppText variant="caption" color={colors.mutedStrong} style={styles.center}>
          {t('home.senior.note')}
        </AppText>
      </MoreOptions>
    </Screen>
  );
}

function BigLink({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Icon name={icon} size={28} />
      <AppText variant="h3" style={styles.linkText}>
        {label}
      </AppText>
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  block: { gap: spacing.md },
  links: { flexDirection: 'row', justifyContent: 'center' },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: sizes.touchTarget + spacing.xl,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  linkText: { fontFamily: fonts.bodySemi, textTransform: 'none', flex: 1 },
  pressed: { backgroundColor: colors.background },
  last: {
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.card,
    backgroundColor: colors.tealTint,
  },
  read: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: colors.teal,
  },
  center: { textAlign: 'center' },
}));
