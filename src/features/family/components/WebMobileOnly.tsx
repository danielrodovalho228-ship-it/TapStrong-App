import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Notice, Screen } from '@/components/ui';
import { modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { familyAvailable } from '@/lib/features';
import { spacing } from '@/theme';

import { activeProfile, useFamilyStore } from '../store';

/**
 * Security round 1, S1-03 (Daniel's decision): until the server-checked PIN
 * has passed QA on the web, the web is for adults without family. A family
 * profile or a teen / child profile opened on the web gets a note instead of
 * the app (no profile switch: switching back would need the parent PIN,
 * which the web can't keep safe).
 */
export function useWebFamilyBlocked(): 'family' | 'teen' | null {
  const member = useFamilyStore(activeProfile);
  const mode = modeOf(useOnboardingStore());
  if (familyAvailable()) return null;
  if (member && member.kind !== 'self') return 'family';
  if (mode === 'teen' || mode === 'child') return 'teen';
  return null;
}

export function WebMobileOnly({ kind }: { kind: 'family' | 'teen' }) {
  const { t } = useTranslation();
  return (
    <Screen>
      <View style={styles.box}>
        <AppText variant="h1" accessibilityRole="header">
          {t('family.mobileOnlyTitle')}
        </AppText>
        <Notice>{t(kind === 'family' ? 'family.mobileOnly' : 'family.teenMobileOnly')}</Notice>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ box: { gap: spacing.md, paddingTop: spacing.xl } });
