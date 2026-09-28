import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Chip, TextField } from '@/components/ui';
import { colors, fonts, spacing } from '@/theme';

import { NEUTRAL_BODY_AVAILABLE } from '../../bodymap/images';
import { FOCUS_CHIP_KEYS, muscleByKey } from '../../muscles';
import type { AppMode } from '../../profile/age';
import {
  cmToFeetInches,
  feetInchesToCm,
  HEIGHT_CM_RANGE,
  inRange,
  kgToLb,
  lbToKg,
  WEIGHT_KG_RANGE,
} from '../../profile/units';
import { normalizeEquipment, PRESET_KEYS, PRESETS, presetOf } from '../../equipment/catalog';
import { allowsMeasurements } from '../interview';
import { DAYS_OPTIONS, LOCATIONS, MINUTES_OPTIONS, type InterviewStep } from '../options';
import { toggleInList } from '../safety';
import { useOnboardingStore } from '../store';
import { sexLabelKey, visibleMainGoals } from '../visible';

function Group({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      {label ? (
        <AppText variant="label" color={colors.mutedStrong} style={styles.groupLabel}>
          {label}
        </AppText>
      ) : null}
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

export function StepControls({ step, mode }: { step: InterviewStep; mode: AppMode }) {
  switch (step) {
    case 'goals':
      return <GoalsControls mode={mode} />;
    case 'schedule':
      return <ScheduleControls />;
    case 'focus':
      return <FocusControls />;
    case 'body':
      return <BodyControls mode={mode} />;
  }
}

function GoalsControls({ mode }: { mode: AppMode }) {
  const { t } = useTranslation();
  const mainGoals = useOnboardingStore((s) => s.mainGoals);
  const update = useOnboardingStore((s) => s.update);
  return (
    <Group>
      {visibleMainGoals(mode).map((g) => (
        <Chip
          key={g}
          label={t(`mainGoals.${g}`)}
          selected={mainGoals.includes(g)}
          onPress={() => update({ mainGoals: toggleInList(mainGoals, g) })}
        />
      ))}
    </Group>
  );
}

function ScheduleControls() {
  const { t } = useTranslation();
  const s = useOnboardingStore();
  // Presets for the place (improvements v1, C4); the detailed list is in Settings.
  const presetOptions = PRESET_KEYS.filter((k) => PRESETS[k].location === s.location);
  const chosenPreset = presetOf(normalizeEquipment(s.equipment), s.location);
  const minuteOptions = [...new Set([...MINUTES_OPTIONS, ...(s.minutes ? [s.minutes] : [])])].sort(
    (a, b) => a - b,
  );
  const dayOptions = [
    ...new Set([...DAYS_OPTIONS, ...(s.daysPerWeek ? [s.daysPerWeek] : [])]),
  ].sort((a, b) => a - b);

  return (
    <View style={styles.stack}>
      <Group label={t('chat.where')}>
        {LOCATIONS.map((l) => (
          <Chip
            key={l}
            label={t(`locations.${l}`)}
            selected={s.location === l}
            onPress={() => s.setLocation(l)}
          />
        ))}
      </Group>
      <Group label={t('chat.howLong')}>
        {minuteOptions.map((m) => (
          <Chip
            key={m}
            label={t('chat.minutesOption', { count: m })}
            selected={s.minutes === m}
            onPress={() => s.update({ minutes: m })}
          />
        ))}
      </Group>
      <Group label={t('chat.daysPerWeek')}>
        {dayOptions.map((d) => (
          <Chip
            key={d}
            label={t('chat.daysOption', { count: d })}
            selected={s.daysPerWeek === d}
            onPress={() => s.update({ daysPerWeek: d })}
          />
        ))}
      </Group>
      {presetOptions.length ? (
        <Group label={t('chat.equipment')}>
          {presetOptions.map((k) => (
            <Chip
              key={k}
              label={t(`equipmentSettings.presetNames.${k}`)}
              selected={chosenPreset === k}
              onPress={() => s.update({ equipment: PRESETS[k].items })}
            />
          ))}
        </Group>
      ) : null}
    </View>
  );
}

function FocusControls() {
  const { t } = useTranslation();
  const s = useOnboardingStore();
  // Chips for the common areas, plus any other muscle the coach understood.
  const keys = [
    ...FOCUS_CHIP_KEYS,
    ...s.muscleGoals
      .map((m) => m.muscleKey)
      .filter((k) => !(FOCUS_CHIP_KEYS as readonly string[]).includes(k)),
  ];
  return (
    <Group>
      {keys.map((key) => {
        const muscle = muscleByKey(key);
        if (!muscle) return null;
        return (
          <Chip
            key={key}
            label={t(muscle.labelKey as 'muscles.chest')}
            selected={s.muscleGoals.some((m) => m.muscleKey === key)}
            onPress={() => s.toggleFocusMuscle(key)}
          />
        );
      })}
      <Chip
        label={t('chat.focusLater')}
        selected={s.focusDeferred}
        onPress={() => s.update({ focusDeferred: !s.focusDeferred, muscleGoals: [] })}
      />
    </Group>
  );
}

const BODY_OPTIONS: ('m' | 'f' | null)[] = NEUTRAL_BODY_AVAILABLE ? ['m', 'f', null] : ['m', 'f'];

function numberOrUndefined(text: string): number | undefined {
  const n = Number(text.replace(',', '.'));
  return text.trim() && Number.isFinite(n) ? n : undefined;
}

function BodyControls({ mode }: { mode: AppMode }) {
  const { t } = useTranslation();
  const s = useOnboardingStore();
  const imperial = s.units === 'imperial';
  const initialFtIn = s.heightCm ? cmToFeetInches(s.heightCm) : undefined;

  const [feet, setFeet] = useState(initialFtIn ? String(initialFtIn.feet) : '');
  const [inches, setInches] = useState(initialFtIn ? String(initialFtIn.inches) : '');
  const [cm, setCm] = useState(s.heightCm ? String(Math.round(s.heightCm)) : '');
  const [weight, setWeight] = useState(
    s.weightKg ? String(imperial ? kgToLb(s.weightKg) : Math.round(s.weightKg)) : '',
  );

  const commitHeight = (next: { feet?: string; inches?: string; cm?: string }) => {
    let heightCm: number | undefined;
    if (imperial) {
      const f = numberOrUndefined(next.feet ?? feet);
      const i = numberOrUndefined(next.inches ?? inches) ?? 0;
      heightCm = f !== undefined ? feetInchesToCm(f, i) : undefined;
    } else {
      heightCm = numberOrUndefined(next.cm ?? cm);
    }
    s.update({ heightCm: heightCm && inRange(heightCm, HEIGHT_CM_RANGE) ? heightCm : undefined });
  };

  const commitWeight = (text: string) => {
    setWeight(text);
    const n = numberOrUndefined(text);
    const kg = n === undefined ? undefined : imperial ? lbToKg(n) : n;
    s.update({ weightKg: kg && inRange(kg, WEIGHT_KG_RANGE) ? kg : undefined });
  };

  return (
    <View style={styles.stack}>
      <Group>
        {BODY_OPTIONS.map((sex) => (
          <Chip
            key={sex ?? 'neutral'}
            label={t(sexLabelKey(sex, mode))}
            selected={s.sex === sex}
            onPress={() => s.update({ sex })}
          />
        ))}
      </Group>
      {allowsMeasurements(mode) ? (
        <View style={styles.row}>
          {imperial ? (
            <View style={[styles.row, styles.flex]}>
              <TextField
                label={t('chat.height')}
                accessibilityLabel={t('chat.feet')}
                suffix={t('chat.units.ft')}
                keyboardType="number-pad"
                maxLength={1}
                value={feet}
                onChangeText={(v) => {
                  setFeet(v);
                  commitHeight({ feet: v });
                }}
              />
              <TextField
                label=" "
                accessibilityLabel={t('chat.inches')}
                suffix={t('chat.units.in')}
                keyboardType="number-pad"
                maxLength={2}
                value={inches}
                onChangeText={(v) => {
                  setInches(v);
                  commitHeight({ inches: v });
                }}
              />
            </View>
          ) : (
            <TextField
              label={t('chat.height')}
              suffix={t('chat.units.cm')}
              keyboardType="number-pad"
              maxLength={3}
              value={cm}
              onChangeText={(v) => {
                setCm(v);
                commitHeight({ cm: v });
              }}
            />
          )}
          <TextField
            label={t('chat.weight')}
            suffix={t(imperial ? 'chat.units.lb' : 'chat.units.kg')}
            keyboardType="decimal-pad"
            maxLength={5}
            value={weight}
            onChangeText={commitWeight}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  group: { gap: spacing.sm },
  groupLabel: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 2 },
});
