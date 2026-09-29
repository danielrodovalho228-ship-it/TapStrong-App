import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Header,
  IconButton,
  Notice,
  Screen,
  TextField,
} from '@/components/ui';
import { generateCustomSession, safePool } from '@/features/generator';
import { exerciseName } from '@/features/workout/format';
import { useExerciseLibrary, useGeneratorInput } from '@/features/workout/hooks';
import { fullWorkoutAllowed } from '@/features/workout/secondWorkout';
import { useWorkoutStore } from '@/features/workout/store';
import { useTodayState } from '@/features/workout/useTodayState';
import { spacing, useColors } from '@/theme';

/**
 * Custom workout (A6; mockup 10 list): the person's own list from the
 * library. Only exercises safe for this profile are listed; warm-up and
 * cool-down are added around it.
 */
export default function CustomWorkoutScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const library = useExerciseLibrary();
  const input = useGeneratorInput(library);
  const create = useWorkoutStore((s) => s.create);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const safe = useMemo(
    () => (input ? safePool(input).filter((e) => e.parts.includes('main')) : []),
    [input],
  );
  const today = useTodayState();
  // Same rule as Single and My plan (QA R8 P2).
  if (!fullWorkoutAllowed(today)) return <Redirect href="/home" />;
  const byId = new Map(library.map((e) => [e.id, e]));
  const q = query.trim().toLowerCase();
  const matches = safe
    .filter((e) => !chosen.includes(e.id))
    .filter((e) => !q || exerciseName(t, e, e.id).toLowerCase().includes(q))
    .slice(0, 30);

  const build = () => {
    if (!input) return;
    const session = generateCustomSession(input, chosen);
    if (session.error)
      return setError(
        t(
          session.error === 'no_library'
            ? 'workout.underReview'
            : `workout.unavailable.${session.error}`,
        ),
      );
    const id = create(session);
    router.replace({ pathname: '/workout/[id]', params: { id } });
  };

  return (
    <Screen
      header={<Header onBack={() => router.back()} title={t('custom.title')} />}
      footer={<Button label={t('custom.build')} disabled={!chosen.length} onPress={build} />}
    >
      <Notice>{t('custom.note')}</Notice>
      <AppText variant="label">{t('custom.chosen', { count: chosen.length })}</AppText>
      {chosen.length ? (
        chosen.map((id) => {
          const name = exerciseName(t, byId.get(id), id);
          return (
            <Card key={id} style={styles.row}>
              <AppText variant="bodyStrong" style={styles.flex}>
                {name}
              </AppText>
              <IconButton
                icon="close"
                accessibilityLabel={t('custom.remove', { name })}
                onPress={() => setChosen((c) => c.filter((x) => x !== id))}
              />
            </Card>
          );
        })
      ) : (
        <AppText color={colors.mutedStrong}>{t('custom.empty')}</AppText>
      )}
      <TextField label={t('custom.search')} value={query} onChangeText={setQuery} />
      <View style={styles.list}>
        {matches.map((e) => {
          const name = exerciseName(t, e, e.id);
          return (
            <Card key={e.id} style={styles.row}>
              <AppText style={styles.flex}>{name}</AppText>
              <IconButton
                icon="plus"
                accessibilityLabel={t('custom.add', { name })}
                onPress={() => setChosen((c) => [...c, e.id])}
              />
            </Card>
          );
        })}
      </View>
      {error ? <Notice tone="warning">{error}</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  list: { gap: spacing.sm },
});
