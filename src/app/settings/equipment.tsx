import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Chip, Header, Screen, TextField, ToggleRow } from '@/components/ui';
import {
  EQUIPMENT_GROUPS,
  normalizeEquipment,
  PRESET_KEYS,
  PRESETS,
  presetOf,
  type EquipmentGroup,
  type EquipmentItem,
} from '@/features/equipment/catalog';
import { usePlacesStore } from '@/features/equipment/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { discardPlannedWorkouts } from '@/features/workout/hooks';
import { uuid } from '@/lib/uuid';
import { spacing, useColors } from '@/theme';

/**
 * Settings → Equipment (improvements v1, C1–C2; mockup 20 grouped toggles):
 * presets, saved places, and every item with a switch.
 */
export default function EquipmentScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const s = useOnboardingStore();
  const { places, activeId, save, use } = usePlacesStore();
  const items = normalizeEquipment(s.equipment);
  const location = s.location ?? 'home';
  const preset = presetOf(items, location);
  const [placeName, setPlaceName] = useState('');

  const { syncActive } = usePlacesStore();
  // Any change rebuilds today's planned workout and drops a place that no
  // longer matches (QA R4-09).
  const apply = (patch: { location?: typeof location; equipment: EquipmentItem[] }) => {
    s.update(patch);
    syncActive(patch.location ?? location, patch.equipment);
    discardPlannedWorkouts();
  };
  const setItems = (next: EquipmentItem[]) => apply({ equipment: next });
  const toggle = (item: EquipmentItem, on: boolean) =>
    setItems(on ? [...new Set([...items, item])] : items.filter((i) => i !== item));

  return (
    <Screen header={<Header onBack={() => router.back()} title={t('equipmentSettings.title')} />}>
      <AppText color={colors.mutedStrong}>{t('equipmentSettings.hint')}</AppText>

      <AppText variant="label">{t('equipmentSettings.presets')}</AppText>
      <View style={styles.chips}>
        {PRESET_KEYS.map((k) => (
          <Chip
            key={k}
            label={t(`equipmentSettings.presetNames.${k}`)}
            selected={preset === k}
            onPress={() => apply({ location: PRESETS[k].location, equipment: PRESETS[k].items })}
          />
        ))}
      </View>

      <AppText variant="label">{t('equipmentSettings.profiles')}</AppText>
      <View style={styles.chips}>
        {places.map((p) => (
          <Chip
            key={p.id}
            label={p.name}
            selected={activeId === p.id}
            onPress={() => {
              use(p.id);
              discardPlannedWorkouts();
            }}
          />
        ))}
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label={t('equipmentSettings.placeName')}
            value={placeName}
            onChangeText={setPlaceName}
            maxLength={24}
          />
        </View>
      </View>
      <Button
        variant="secondary"
        label={t('equipmentSettings.save')}
        disabled={!placeName.trim()}
        onPress={() => {
          save({ id: uuid(), name: placeName.trim(), location, items });
          setPlaceName('');
        }}
      />

      <AppText variant="caption" color={colors.mutedStrong}>
        {t('equipmentSettings.count', { count: items.length })}
      </AppText>
      {(Object.keys(EQUIPMENT_GROUPS) as EquipmentGroup[]).map((g) => (
        <Card key={g} style={styles.card}>
          <AppText variant="h3">{t(`equipmentSettings.groups.${g}`)}</AppText>
          {(EQUIPMENT_GROUPS[g] as readonly EquipmentItem[]).map((item) => (
            <ToggleRow
              key={item}
              label={t(`equipment.${item}`)}
              value={items.includes(item)}
              onChange={(on) => toggle(item, on)}
            />
          ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  card: { gap: spacing.xs },
});
