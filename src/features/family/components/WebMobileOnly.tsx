import { router, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Notice, Screen } from '@/components/ui';
import { modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { familyAvailable } from '@/lib/features';
import { openStore, storeLinks } from '@/lib/storeLinks';
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
  const stores = storeLinks();
  return (
    <Screen>
      <View style={styles.box}>
        <AppText variant="h1" accessibilityRole="header">
          {t(kind === 'family' ? 'family.mobileOnlyTitle' : 'family.teenMobileOnlyTitle')}
        </AppText>
        <Notice>{t(kind === 'family' ? 'family.mobileOnly' : 'family.teenMobileOnly')}</Notice>
        {kind === 'teen' ? (
          // A wrong birth date is the one thing to fix here (round 2, P3).
          <Button
            variant="secondary"
            label={t('family.changeDate')}
            onPress={() => router.push({ pathname: '/onboarding/who', params: { edit: '1' } })}
          />
        ) : null}
        {/* Where to get the app, once the store pages exist (round 2, P3). */}
        {stores.ios ? (
          <Button
            variant="ghost"
            label={t('family.getIos')}
            onPress={() => void openStore(stores.ios!)}
          />
        ) : null}
        {stores.android ? (
          <Button
            variant="ghost"
            label={t('family.getAndroid')}
            onPress={() => void openStore(stores.android!)}
          />
        ) : null}
      </View>
    </Screen>
  );
}

/**
 * The only screens a blocked profile may open on the web: fixing the birth
 * date, the account (sign out) and deleting it (security round 2, S2-P2-1).
 */
export const WEB_BLOCKED_ALLOWED = ['/onboarding/who', '/account', '/delete-account'];

/**
 * Security round 2, S2-P2-1: the web block sits at the root, so no address
 * (/settings, /workout/new, /programs…) opens the app for a teen or a family
 * profile. The navigator stays mounted (hidden) so the allowed screens work.
 */
export function WebFamilyGate({ children }: { children: ReactNode }) {
  const kind = useWebFamilyBlocked();
  const path = usePathname();
  const blocked = !!kind && !WEB_BLOCKED_ALLOWED.includes(path);
  return (
    <View style={styles.fill}>
      <View
        style={[styles.fill, blocked && styles.hidden]}
        aria-hidden={blocked}
        importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {blocked && kind ? (
        <View style={StyleSheet.absoluteFill} testID="web-family-gate">
          <WebMobileOnly kind={kind} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md, paddingTop: spacing.xl },
  fill: { flex: 1 },
  hidden: { display: 'none' },
});
