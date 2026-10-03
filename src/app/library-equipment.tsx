import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Chip,
  Header,
  Notice,
  Screen,
  TextField,
  TextLink,
  ToggleRow,
} from '@/components/ui';
import {
  ALL_EQUIPMENT,
  normalizeEquipment,
  PRESETS,
  type EquipmentItem,
  type PresetKey,
} from '@/features/equipment/catalog';
import { usePlanFilterStore } from '@/features/library/planFilter';
import { useOnboardingStore } from '@/features/onboarding/store';
import { makeStyles, spacing, useColors } from '@/theme';

const LIBRARY_PRESETS: PresetKey[] = ['fullGym', 'smallGym', 'homeGym', 'bodyweight'];

/**
 * Library → Equipment (Phase 31, F): which plans to show. "SELECTED
 * EQUIPMENT (n)", a search, presets, "Deselect all" and a switch per item;
 * Discard or Done. It never changes the current plan or the profile.
 */
export default function LibraryEquipmentScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const profile = useOnboardingStore();
  const current = usePlanFilterStore((s) => s.equipment);
  const setEquipment = usePlanFilterStore((s) => s.setEquipment);
  const [items, setItems] = useState<EquipmentItem[]>(
    () => current ?? normalizeEquipment(profile.equipment),
  );
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const label = (i: EquipmentItem) => t(`equipment.${i}`);
  const list = ALL_EQUIPMENT.filter((i) => !q || label(i).toLowerCase().includes(q));

  return (
    <Screen
      header={<Header onBack={() => router.back()} title={t('libraryEquipment.title')} />}
      footer={
        <View style={styles.footer}>
          <View style={styles.flex}>
            <Button
              variant="secondary"
              label={t('libraryEquipment.discard')}
              onPress={() => router.back()}
            />
          </View>
          <View style={styles.flex}>
            <Button
              label={t('libraryEquipment.done')}
              onPress={() => {
                setEquipment(items);
                router.back();
              }}
            />
          </View>
        </View>
      }
    >
      <Notice>{t('libraryEquipment.notice')}</Notice>
      <View style={styles.presets}>
        {LIBRARY_PRESETS.map((k) => (
          <Chip
            key={k}
            label={t(`libraryEquipment.presets.${k as 'fullGym'}`)}
            selected={
              PRESETS[k].items.length === items.length &&
              PRESETS[k].items.every((i) => items.includes(i))
            }
            onPress={() => setItems([...PRESETS[k].items])}
          />
        ))}
      </View>
      <TextField label={t('libraryEquipment.search')} value={query} onChangeText={setQuery} />
      <View style={styles.countRow}>
        <AppText variant="label" style={styles.flex} testID="equipment-count">
          {t('libraryEquipment.selected', { count: items.length })}
        </AppText>
        <TextLink label={t('libraryEquipment.clear')} onPress={() => setItems([])} />
      </View>
      <Card style={styles.card}>
        {list.map((item) => (
          <ToggleRow
            key={item}
            label={label(item)}
            value={items.includes(item)}
            onChange={(on) =>
              setItems((now) => (on ? [...now, item] : now.filter((x) => x !== item)))
            }
          />
        ))}
        {!list.length ? (
          <AppText color={colors.mutedStrong}>{t('libraryEquipment.none')}</AppText>
        ) : null}
      </Card>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  flex: { flex: 1 },
  footer: { flexDirection: 'row', gap: spacing.sm },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  card: { gap: spacing.xs },
}));
