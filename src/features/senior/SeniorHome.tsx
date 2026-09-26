import * as Speech from 'expo-speech';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Icon, Screen, type IconName } from '@/components/ui';
import { currentPlan } from '@/features/billing/rules';
import { useBillingStore } from '@/features/billing/store';
import { activeProfile, useFamilyStore } from '@/features/family/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { muscleLabel } from '@/features/onboarding/summaries';
import { checkinDue } from '@/features/progress/checkin';
import { useProgressStore } from '@/features/progress/store';
import { useWorkoutStore } from '@/features/workout/store';
import { clock } from '@/lib/clock';
import { colors, fonts, radius, sizes, spacing } from '@/theme';

import { dayPart, lastWorkout } from './summary';

/**
 * Mockup 23 — 60+ home: one big "Start", then progress, then an audio
 * summary of the last workout. Links stay inside the simple screens
 * (SPEC §11.10): no body-map or camera entry points from here.
 */
export function SeniorHome({ onStart }: { onStart: () => void }) {
  const { t, i18n } = useTranslation();
  const profile = useOnboardingStore();
  const { workouts } = useWorkoutStore();
  const checkins = useProgressStore((s) => s.checkins);
  const member = useFamilyStore(activeProfile);
  const owner = useFamilyStore((s) => s.profiles.find((p) => p.kind === 'self'));
  const plan = currentPlan(
    useBillingStore((s) => s.entitlement),
    clock.now(),
  );
  const [speaking, setSpeaking] = useState(false);
  const now = clock.now();
  const active = workouts.find((w) => w.status === 'active');
  const last = lastWorkout(workouts);
  const minutes = profile.minutes ?? 15;
  const goals = profile.muscleGoals.slice(0, 2).map((g) => muscleLabel(t, g.muscleKey));
  const managed = !!member && member.kind !== 'self';

  const meta = [
    t('home.senior.today'),
    t('home.senior.minutes', { count: minutes }),
    ...(profile.position !== 'standing' ? [t('home.senior.seated')] : []),
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
  const lastDay = last
    ? new Date(last.endedAt).toLocaleDateString(i18n.language, { weekday: 'long' })
    : '';

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

  return (
    <Screen>
      <View>
        <AppText color={colors.mutedStrong}>{t(`home.senior.greeting.${dayPart(now)}`)}</AppText>
        {managed && member.name ? (
          <AppText variant="display" accessibilityRole="header">
            {member.name}
          </AppText>
        ) : (
          <AppText variant="h1" accessibilityRole="header">
            {t('home.title')}
          </AppText>
        )}
      </View>

      <Card style={styles.today}>
        <AppText color={colors.mutedStrong}>{meta}</AppText>
        <AppText variant="h1">
          {goals.length ? goals.join(' & ') : t('home.senior.balance')}
        </AppText>
        <AppText>{t('home.withWarmup', { minutes })}</AppText>
        <Button
          variant="teal"
          label={active ? t('home.continue') : t('home.senior.start')}
          onPress={onStart}
        />
      </Card>

      {checkinDue(workouts, checkins, now) ? (
        <BigLink
          icon="check"
          label={t('home.checkinReady')}
          onPress={() => router.push('/checkin')}
        />
      ) : null}
      <BigLink
        icon="progress"
        label={t('home.senior.progress')}
        onPress={() => router.push('/progress')}
      />

      {last ? (
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

      <AppText variant="caption" color={colors.mutedStrong} style={styles.center}>
        {t('home.senior.note')}
      </AppText>
    </Screen>
  );
}

function BigLink({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
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

const styles = StyleSheet.create({
  today: {
    gap: spacing.md,
    padding: spacing.xl,
    borderWidth: 2,
    borderColor: colors.ink,
  },
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
});
