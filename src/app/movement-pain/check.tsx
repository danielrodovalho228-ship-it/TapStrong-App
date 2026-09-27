import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Card, Header, Notice, Screen } from '@/components/ui';
import { lightFor } from '@/features/movement/progress';
import { useMovementPainStore } from '@/features/movement/store';
import { reportTitle, ScoreChips } from '@/features/movement/ui';
import { useWorkoutStore } from '@/features/workout/store';
import { clock } from '@/lib/clock';

/** Pain traffic light check (SPEC §8): right after a workout, or the next morning. */
export default function PainCheckScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; kind?: string; workout?: string }>();
  const report = useMovementPainStore((s) => s.reports.find((r) => r.id === params.id));
  const addCheck = useMovementPainStore((s) => s.addCheck);
  const lastWorkout = useWorkoutStore(
    (s) =>
      [...s.workouts]
        .filter((w) => w.status === 'done' || w.status === 'partial')
        .sort((a, b) => ((a.endedAt ?? a.createdAt) < (b.endedAt ?? b.createdAt) ? 1 : -1))[0],
  );
  const [score, setScore] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const workoutId = params.workout ?? lastWorkout?.id;
  if (!report || !workoutId) return <Redirect href="/restrictions" />;
  const kind = params.kind === 'morning' ? 'morning' : 'after';
  const area = reportTitle(t, report);

  const save = () => {
    if (score == null) return;
    addCheck(report.id, { kind, workoutId, score, at: clock.now().toISOString() });
    setSaved(true);
  };

  return (
    <Screen
      header={
        <Header
          onBack={() => router.back()}
          eyebrow={t('movementPain.plan.lightTitle')}
          title={t(`movementPain.check.${kind}`, { area })}
        />
      }
      footer={
        saved ? (
          <Button label={t('common.continue')} onPress={() => router.back()} />
        ) : (
          <Button label={t('movementPain.check.save')} disabled={score == null} onPress={save} />
        )
      }
    >
      <Card>
        <ScoreChips value={score} onChange={setScore} />
      </Card>
      {saved && score != null ? (
        <Notice>
          {t('movementPain.check.saved', {
            light: t(`movementPain.plan.lights.${lightFor(score)}`),
          })}
        </Notice>
      ) : null}
      <Notice>{t('movementPain.plan.lightRule')}</Notice>
    </Screen>
  );
}
