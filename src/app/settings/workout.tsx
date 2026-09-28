import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, Chip, Header, Screen, ToggleRow } from '@/components/ui';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { REST_PRESETS, usePrefsStore, type Experience } from '@/features/settings/store';
import { colors, spacing } from '@/theme';

const EXPERIENCE: Experience[] = ['new', 'some', 'experienced'];

/**
 * Settings → Workout preferences (improvements v1, D4): units, rest defaults,
 * voice cues, warm-up length and experience. None of these can switch off a
 * safety rule: a short warm-up still has a warm-up and a cool-down.
 */
export default function WorkoutPrefsScreen() {
  const { t } = useTranslation();
  const profile = useOnboardingStore();
  const senior = derive(profile)?.mode === 'senior';
  const prefs = usePrefsStore();
  const strength = senior ? REST_PRESETS.seniorStrength : REST_PRESETS.strength;

  return (
    <Screen header={<Header onBack={() => router.back()} title={t('prefs.title')} />}>
      <Card style={styles.card}>
        <AppText variant="h3">{t('prefs.units')}</AppText>
        <View style={styles.chips}>
          <Chip
            label={t('prefs.unitsImperial')}
            selected={profile.units === 'imperial'}
            onPress={() => profile.update({ units: 'imperial' })}
          />
          <Chip
            label={t('prefs.unitsMetric')}
            selected={profile.units === 'metric'}
            onPress={() => profile.update({ units: 'metric' })}
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <AppText variant="h3">{t('prefs.rest')}</AppText>
        <View style={styles.chips}>
          <Chip
            label={t('prefs.restAuto')}
            selected={prefs.restStrength === null}
            onPress={() => prefs.set({ restStrength: null })}
          />
          {strength.map((s) => (
            <Chip
              key={s}
              label={t('prefs.seconds', { count: s })}
              selected={prefs.restStrength === s}
              onPress={() => prefs.set({ restStrength: s })}
            />
          ))}
        </View>
        <AppText variant="h3">{t('prefs.restHold')}</AppText>
        <View style={styles.chips}>
          {REST_PRESETS.hold.map((s) => (
            <Chip
              key={s}
              label={t('prefs.seconds', { count: s })}
              selected={prefs.restHold === s}
              onPress={() => prefs.set({ restHold: s })}
            />
          ))}
        </View>
      </Card>

      <Card>
        <ToggleRow
          label={t('prefs.sounds')}
          detail={t('prefs.soundsDetail')}
          value={prefs.sounds}
          onChange={(sounds) => prefs.set({ sounds })}
        />
        <ToggleRow
          label={t('prefs.voice')}
          detail={t('prefs.voiceDetail')}
          value={prefs.voice}
          onChange={(voice) => prefs.set({ voice })}
        />
      </Card>

      <Card style={styles.card}>
        <AppText variant="h3">{t('prefs.warmup')}</AppText>
        <View style={styles.chips}>
          <Chip
            label={t('prefs.warmupStandard')}
            selected={prefs.warmup === 'standard'}
            onPress={() => prefs.set({ warmup: 'standard' })}
          />
          <Chip
            label={t('prefs.warmupShort')}
            selected={prefs.warmup === 'short'}
            onPress={() => prefs.set({ warmup: 'short' })}
          />
        </View>
        <AppText variant="caption" color={colors.mutedStrong}>
          {t('prefs.warmupNote')}
        </AppText>
      </Card>

      <Card style={styles.card}>
        <AppText variant="h3">{t('prefs.experience')}</AppText>
        <View style={styles.chips}>
          {EXPERIENCE.map((e) => (
            <Chip
              key={e}
              label={t(`prefs.experienceLevels.${e}`)}
              selected={prefs.experience === e}
              onPress={() => prefs.set({ experience: e })}
            />
          ))}
        </View>
        <AppText variant="caption" color={colors.mutedStrong}>
          {t('prefs.experienceNote')}
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
