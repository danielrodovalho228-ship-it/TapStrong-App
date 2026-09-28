import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Chip,
  Header,
  Notice,
  Screen,
  SegmentedControl,
  TextField,
} from '@/components/ui';
import { BodyPicker } from '@/features/bodymap/components/BodyPicker';
import {
  canCreateExercise,
  customJoints,
  customPositions,
  usesFreeWeights,
} from '@/features/library/custom';
import { useLibraryStore } from '@/features/library/store';
import { JOINTS, type JointKey } from '@/features/movement/catalog';
import { derive } from '@/features/onboarding/derived';
import type { Position } from '@/features/onboarding/options';
import { useOnboardingStore } from '@/features/onboarding/store';
import { EQUIPMENT } from '../../../supabase/functions/_shared/interview';
import { clock } from '@/lib/clock';
import { uuid } from '@/lib/uuid';
import { colors, spacing } from '@/theme';

/**
 * Create exercise (improvements v1, B5; mockup 09 body-map pick), adults
 * only: name, main and secondary muscles on the body map, equipment and the
 * joints it moves. Never auto-programmed; "Not reviewed by a coach".
 */
export default function CreateExerciseScreen() {
  const { t } = useTranslation();
  const mode = derive(useOnboardingStore())?.mode ?? 'adult';
  const addCustom = useLibraryStore((s) => s.addCustom);
  const [name, setName] = useState('');
  const [picking, setPicking] = useState<'primary' | 'secondary'>('primary');
  const [primary, setPrimary] = useState<string[]>([]);
  const [secondary, setSecondary] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [joints, setJoints] = useState<JointKey[]>([]);
  const [positions, setPositions] = useState<Position[]>(['standing']);
  const [error, setError] = useState(false);
  const flip = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  if (!canCreateExercise(mode)) {
    return (
      <Screen header={<Header onBack={() => router.back()} title={t('createExercise.title')} />}>
        <Notice>{t('createExercise.adultsOnly')}</Notice>
      </Screen>
    );
  }

  const toggle = (k: string) => {
    if (picking === 'primary') {
      setPrimary((p) => flip(p, k));
      setSecondary((s) => s.filter((x) => x !== k));
    } else {
      setSecondary((s) => flip(s, k));
      setPrimary((p) => p.filter((x) => x !== k));
    }
  };

  const save = () => {
    if (!name.trim() || !primary.length) return setError(true);
    const id = `custom_${uuid()}`;
    addCustom({
      id,
      name: name.trim().slice(0, 60),
      primary,
      secondary,
      equipment,
      joints,
      positions: customPositions({ positions, equipment }),
      createdAt: clock.now().toISOString(),
    });
    router.replace({ pathname: '/exercise/[id]', params: { id } });
  };

  return (
    <Screen
      header={<Header onBack={() => router.back()} title={t('createExercise.title')} />}
      footer={<Button label={t('createExercise.save')} onPress={save} />}
    >
      <Notice>{t('createExercise.note')}</Notice>
      <TextField
        label={t('createExercise.name')}
        value={name}
        onChangeText={setName}
        maxLength={60}
      />
      <SegmentedControl
        accessibilityLabel={t('createExercise.mode')}
        value={picking}
        onChange={setPicking}
        options={[
          { value: 'primary', label: t('createExercise.primaryMode') },
          { value: 'secondary', label: t('createExercise.secondaryMode') },
        ]}
      />
      <AppText variant="caption" color={colors.mutedStrong}>
        {t(picking === 'primary' ? 'createExercise.primary' : 'createExercise.secondary')}
      </AppText>
      <BodyPicker selected={primary} outlined={secondary} onToggle={toggle} maxHeight={360} />
      <AppText variant="label">{t('createExercise.equipment')}</AppText>
      <View style={styles.chips}>
        {EQUIPMENT.map((q) => (
          <Chip
            key={q}
            label={t(`equipment.${q}`)}
            selected={equipment.includes(q)}
            onPress={() => setEquipment((l) => flip(l, q))}
          />
        ))}
      </View>
      <AppText variant="label">{t('createExercise.joints')}</AppText>
      <AppText variant="caption" color={colors.mutedStrong}>
        {t('createExercise.jointsFromMuscles')}
      </AppText>
      <View style={styles.chips}>
        {JOINTS.map((j) => {
          const fromMuscles = customJoints({ primary, joints: [] }).includes(j);
          return (
            <Chip
              key={j}
              label={t(`createExercise.jointNames.${j}`)}
              selected={fromMuscles || joints.includes(j)}
              disabled={fromMuscles}
              onPress={() => setJoints((l) => flip(l, j))}
            />
          );
        })}
      </View>
      <AppText variant="label">{t('createExercise.positions')}</AppText>
      <View style={styles.chips}>
        {(['standing', 'with_support', 'seated_only'] as const).map((p) => {
          const blocked = p === 'with_support' && usesFreeWeights(equipment);
          return (
            <Chip
              key={p}
              label={t(`safety.positions.${p}`)}
              selected={!blocked && positions.includes(p)}
              disabled={blocked}
              onPress={() =>
                setPositions((l) => (l.includes(p) && l.length === 1 ? l : flip(l, p)))
              }
            />
          );
        })}
      </View>
      {usesFreeWeights(equipment) ? (
        <AppText variant="caption" color={colors.mutedStrong}>
          {t('createExercise.noSupportWithWeights')}
        </AppText>
      ) : null}
      {error ? <Notice tone="warning">{t('createExercise.needName')}</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
