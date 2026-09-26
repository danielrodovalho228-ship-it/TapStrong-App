import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Notice, Screen } from '@/components/ui';
import { devLibrary } from '@/features/exercises/library';
import { generateSession } from '@/features/generator';
import { inputFromProfile } from '@/features/generator/fromProfile';
import type { GeneratorNote, SessionItem } from '@/features/generator/types';
import { useOnboardingStore } from '@/features/onboarding/store';
import { muscleLabel } from '@/features/onboarding/summaries';
import { colors, fonts, spacing } from '@/theme';

/**
 * Generator preview after Goals (Phase 3). Development builds show a session
 * built from the draft library; release builds have no released exercises
 * yet and say so. The real workout screens arrive in Phase 4.
 */
export default function NextScreen() {
  const { t } = useTranslation();
  const s = useOnboardingStore();
  const library = useMemo(() => devLibrary(), []);
  const input = inputFromProfile(s, library, __DEV__);
  const session = input ? generateSession(input) : null;
  const names = new Map(library.map((e) => [e.id, e.nameKey]));

  const dose = (i: SessionItem): string => {
    const side = i.perSide ? ` ${t('preview.eachSide')}` : '';
    if (i.reps) return `${i.sets} × ${i.reps[0]}–${i.reps[1]}${side}`;
    if (i.holdSeconds) {
      const hold = t('preview.seconds', { value: `${i.holdSeconds[0]}–${i.holdSeconds[1]}` });
      return i.sets > 1 ? `${i.sets} × ${hold}${side}` : `${hold}${side}`;
    }
    const secs = i.durationSeconds ?? 0;
    return secs >= 60
      ? t('preview.minutes', { value: Math.round(secs / 60) })
      : t('preview.seconds', { value: secs });
  };

  const note = (n: GeneratorNote) => {
    if (n.key === 'generator.notes.balance') {
      return t(n.key, { groups: n.groups.map((g) => t(`generator.notes.groups.${g}`)).join(', ') });
    }
    if (n.key === 'generator.notes.rested') {
      return t(n.key, { muscles: n.muscles.map((m) => muscleLabel(t, m)).join(', ') });
    }
    return t(n.key);
  };

  return (
    <Screen
      footer={
        <>
          <Button label={t('next.bodyMap')} onPress={() => router.replace('/body')} />
          <Button
            variant="ghost"
            label={t('next.restart')}
            onPress={() => {
              s.reset();
              router.replace('/welcome');
            }}
          />
        </>
      }
    >
      <AppText variant="h1" accessibilityRole="header">
        {t('preview.title')}
      </AppText>

      {!session || session.error ? (
        <Notice icon>{t('preview.underReview')}</Notice>
      ) : (
        <>
          {__DEV__ ? <Notice tone="warning">{t('preview.devOnly')}</Notice> : null}
          <AppText color={colors.mutedStrong}>
            {t('preview.summary', {
              minutes: session.estimatedMinutes,
              warmup: session.warmupMinutes,
              cooldown: session.cooldownMinutes,
            })}
          </AppText>
          {session.notes.map((n) => (
            <Notice key={n.key}>{note(n)}</Notice>
          ))}
          <Card style={styles.list}>
            {session.items.map((item, i) => (
              <View key={item.id} style={[styles.row, i > 0 && styles.divider]}>
                <AppText variant="caption" color={colors.muted} style={styles.part}>
                  {t(`preview.parts.${item.part}`)}
                </AppText>
                <AppText variant="bodyStrong">
                  {t((names.get(item.exerciseId) ?? item.exerciseId) as 'app.name')}
                </AppText>
                <AppText variant="caption" color={colors.mutedStrong}>
                  {dose(item)}
                </AppText>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.xs, gap: 0 },
  row: { paddingVertical: spacing.sm, gap: spacing.xxs },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  part: { textTransform: 'uppercase', letterSpacing: 1, fontFamily: fonts.headingSemi },
});
