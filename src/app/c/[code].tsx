import { router, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button } from '@/components/ui';
import { useAccountStore } from '@/features/account/store';
import { loadShareLink, type OpenedLink } from '@/features/share/cloud';
import { designSize, ShareCard } from '@/features/share/ShareCard';
import { useExerciseLibrary } from '@/features/workout/hooks';
import { track } from '@/lib/analytics';
import { colors, fonts, makeStyles, spacing, useColors } from '@/theme';

/**
 * A shared card's link, tapstrong.app/c/<code> (Phase 28, D). On the web: a
 * light, fast page with the card, "Train with TapStrong" and the store
 * buttons; never indexed, no open counter. In the app (deep link): the
 * exercise sheet opens that exercise; any other card shows itself. The
 * owner's invite code, when there is one, is kept like /r/<code> (the
 * current referral rule: a week each after the first workout).
 */
export default function SharedCardPage() {
  const c = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { width } = useWindowDimensions();
  const library = useExerciseLibrary();
  const update = useAccountStore((s) => s.update);
  const redeemed = useAccountStore((s) => s.referralRedeemed);
  const [link, setLink] = useState<OpenedLink | 'missing' | null>(null);

  useEffect(() => {
    let live = true;
    void loadShareLink(code).then((found) => {
      if (!live) return;
      setLink(found ?? 'missing');
      if (!found) return;
      track('share_link_opened', { template: found.card.template });
      if (found.invite && !redeemed) update({ pendingReferral: found.invite });
      // In the app, an exercise sheet opens that exercise (Phase 28, D1).
      const exercise = found.card.template === 'exercise' ? found.card.exerciseId : null;
      if (Platform.OS !== 'web' && exercise && library.some((e) => e.id === exercise))
        router.replace({ pathname: '/exercise/[id]', params: { id: exercise } });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const size = designSize('story');
  const scale = Math.min((Math.min(width, 480) - spacing.xl * 2) / size.width, 1);
  const stores = [
    { key: 'appStore', url: process.env.EXPO_PUBLIC_APP_STORE_URL },
    { key: 'playStore', url: process.env.EXPO_PUBLIC_PLAY_STORE_URL },
  ].filter((s): s is { key: 'appStore' | 'playStore'; url: string } => !!s.url);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Head>
        {/* The public page is never indexed (Phase 28, D3). */}
        <meta name="robots" content="noindex, nofollow" />
        <title>{t('sharedCard.title')}</title>
      </Head>
      <ScrollView contentContainerStyle={styles.content}>
        {link && link !== 'missing' ? (
          <View
            style={[styles.preview, { width: size.width * scale, height: size.height * scale }]}
            testID="shared-card"
          >
            <View
              style={{
                width: size.width,
                height: size.height,
                transform: [{ scale }],
                transformOrigin: 'top left',
              }}
            >
              <ShareCard
                data={link.card}
                chrome={{
                  background: 'light',
                  format: 'story',
                  mode:
                    link.look.band === 'senior' || link.look.band === 'elder' ? 'senior' : 'adult',
                  sex: link.look.sex,
                  band: link.look.band,
                }}
              />
            </View>
          </View>
        ) : link === 'missing' ? (
          <AppText color={c.dark.accentSoft} style={styles.center}>
            {t('sharedCard.missing')}
          </AppText>
        ) : null}

        <AppText variant="h1" color={c.dark.text} style={styles.center} accessibilityRole="header">
          {t('sharedCard.cta')}
        </AppText>
        <AppText color={c.dark.accentSoft} style={styles.center}>
          {t('sharedCard.body')}
        </AppText>
        {Platform.OS === 'web' ? (
          stores.map((s, i) => (
            <Button
              key={s.key}
              variant={i === 0 ? 'accent' : 'onDark'}
              label={t(`sharedCard.${s.key}`)}
              onPress={() => void Linking.openURL(s.url)}
            />
          ))
        ) : (
          <Button
            variant="accent"
            label={t('sharedCard.open')}
            onPress={() => router.replace('/')}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.dark.background },
  content: {
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'stretch',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  preview: { alignSelf: 'center', overflow: 'hidden' },
  center: { textAlign: 'center', fontFamily: fonts.bodySemi },
}));
