/**
 * QA round 3 (P2) — copy, accessibility and small UI fixes.
 */
import { render, screen } from '@testing-library/react-native';

import { SegmentedControl } from '@/components/ui';
import { sameMuscleGroup } from '@/features/muscles';
import i18n, { resources } from '@/i18n';

const allStrings = (node: unknown, skip = ''): string[] =>
  typeof node === 'string'
    ? [node]
    : node && typeof node === 'object'
      ? Object.entries(node).flatMap(([k, v]) => (k === skip ? [] : allStrings(v)))
      : [];

describe('copy', () => {
  it('the recovery legend no longer says "neutral"', () => {
    for (const lng of ['en', 'es', 'pt-BR']) {
      expect(i18n.t('workout.legend.fade', { lng })).not.toMatch(/neutral|neutro/i);
      expect(i18n.t('home.recoveryNote', { lng })).toMatch(/5/);
    }
  });

  it('PT streak reminder: "Mantenha sua sequência de N dias"', () => {
    expect(i18n.t('notifications.streakSaver.title', { lng: 'pt-BR', count: 1 })).toBe(
      'Mantenha sua sequência de 1 dia',
    );
    expect(i18n.t('notifications.streakSaver.title', { lng: 'pt-BR', count: 4 })).toBe(
      'Mantenha sua sequência de 4 dias',
    );
  });

  it('legend adjectives agree with the list', () => {
    expect(
      i18n.t('home.recovery.never', { lng: 'pt-BR', muscles: 'Peito, Ombros', count: 2 }),
    ).toBe('Peito, Ombros · ainda não treinados');
    expect(i18n.t('home.recovery.fresh', { lng: 'es', muscles: 'Pecho, Hombros', count: 2 })).toBe(
      'Pecho, Hombros · recién entrenados',
    );
    expect(i18n.t('home.recovery.fresh', { lng: 'es', muscles: 'Pecho', count: 1 })).toBe(
      'Pecho · recién entrenado',
    );
  });

  it('Spanish uses one verb for Start ("Empezar") and "darles" for a group', () => {
    const es = allStrings(
      (resources as Record<string, { translation: unknown }>).es.translation,
      'exercises',
    );
    expect(es.filter((s) => s.includes('Comenzar'))).toEqual([]);
    expect(es.filter((s) => /tus \{\{group\}\}|darle prioridad/.test(s))).toEqual([]);
  });
});

describe('player chip', () => {
  it('"Chest · also Upper chest" never shows: same group', () => {
    expect(sameMuscleGroup('upperChest', 'chest')).toBe(true);
    expect(sameMuscleGroup('chest', 'midChest')).toBe(true);
    expect(sameMuscleGroup('triceps', 'chest')).toBe(false);
    expect(sameMuscleGroup('triceps', null)).toBe(false);
  });
});

describe('accessibility', () => {
  it('segmented options expose their checked state', async () => {
    await render(
      <SegmentedControl
        value="a"
        accessibilityLabel="Pick"
        onChange={() => undefined}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
      />,
    );
    // Native folds aria-checked into the accessibility state; web renders it as is.
    expect(screen.getByRole('radio', { name: 'A' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'B' })).not.toBeChecked();
  });
});
