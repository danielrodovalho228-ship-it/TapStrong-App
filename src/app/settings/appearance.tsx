import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Header, RadioCard, Screen } from '@/components/ui';
import { useAppearanceStore, type Appearance } from '@/features/appearance/store';
import { colors, makeStyles, spacing } from '@/theme';

const OPTIONS: Appearance[] = ['auto', 'light', 'dark'];

/**
 * Settings → Appearance (theme v2): Automatic follows the phone, or a fixed
 * Light / Dark. Applies instantly and is saved on this device.
 */
export default function AppearanceScreen() {
  const { t } = useTranslation();
  const { appearance, setAppearance } = useAppearanceStore();

  return (
    <Screen header={<Header onBack={() => router.back()} title={t('appearance.title')} />}>
      <View style={styles.list} accessibilityRole="radiogroup">
        {OPTIONS.map((o) => (
          <RadioCard
            key={o}
            label={t(`appearance.options.${o}`)}
            description={t(`appearance.detail.${o}`)}
            selected={appearance === o}
            onPress={() => setAppearance(o)}
          />
        ))}
      </View>
      <AppText variant="caption" color={colors.mutedStrong}>
        {t('appearance.note')}
      </AppText>
    </Screen>
  );
}

const styles = makeStyles(() => ({
  list: { gap: spacing.sm },
}));
