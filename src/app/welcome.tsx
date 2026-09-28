import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import { AppText, Button, Screen, SegmentedControl, TextLink } from '@/components/ui';
import { bodyImage } from '@/features/bodymap/images';
import { useOnboardingStore } from '@/features/onboarding/store';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n';
import { track } from '@/lib/analytics';
import { kidsUnder13Enabled } from '@/lib/features';
import { colors, fonts, makeStyles, radius, spacing } from '@/theme';

// Kids under 13 off for launch (Phase 12): the fourth tile shows teens 13+.
const models = () => [
  { key: 'men' as const, source: bodyImage('young', 'm') },
  { key: 'women' as const, source: bodyImage('young', 'f') },
  kidsUnder13Enabled()
    ? { key: 'kids' as const, source: bodyImage('kid', 'f') }
    : { key: 'teens' as const, source: bodyImage('teen', 'f') },
  { key: 'seniors' as const, source: bodyImage('senior', 'm') },
];

/** Mockup 01 — Welcome. */
export default function Welcome() {
  const { t, i18n } = useTranslation();
  const update = useOnboardingStore((s) => s.update);
  const locale = (SUPPORTED_LOCALES as readonly string[]).includes(i18n.language)
    ? (i18n.language as SupportedLocale)
    : 'en';

  const changeLocale = (next: SupportedLocale) => {
    void i18n.changeLanguage(next);
    update({ locale: next });
  };

  const start = () => {
    update({ locale });
    track('onboarding_started', { locale });
    router.push('/onboarding/who');
  };

  return (
    <Screen
      footer={
        <>
          <Button label={t('welcome.cta')} onPress={start} />
          <TextLink
            label={t('welcome.haveAccount')}
            onPress={() =>
              Alert.alert(t('welcome.accountSoonTitle'), t('welcome.accountSoon'), [
                { text: t('welcome.ok') },
              ])
            }
          />
        </>
      }
    >
      <View style={styles.brandRow}>
        <AppText variant="h2" accessibilityRole="header" style={styles.brand}>
          {t('app.name')}
        </AppText>
        <AppText variant="label" color={colors.mutedStrong} style={styles.kicker}>
          {t('welcome.kicker')}
        </AppText>
      </View>

      <View style={styles.models}>
        {models().map((m) => (
          <View key={m.key} style={styles.model}>
            <Image
              source={m.source}
              style={styles.modelImage}
              contentFit="cover"
              contentPosition="top"
              // Decorative; the label below names the model.
              alt=""
            />
            <AppText variant="label" color={colors.mutedStrong} style={styles.modelLabel}>
              {t(`welcome.models.${m.key}`)}
            </AppText>
          </View>
        ))}
      </View>

      <AppText variant="display" accessibilityRole="header">
        {t('welcome.tap')} {t('welcome.talk')}{' '}
        <AppText variant="display" color={colors.accentText}>
          {t('welcome.train')}
        </AppText>
      </AppText>
      <AppText color={colors.mutedStrong}>{t('welcome.body')}</AppText>

      <SegmentedControl
        accessibilityLabel={t('welcome.language')}
        value={locale}
        onChange={changeLocale}
        options={SUPPORTED_LOCALES.map((l) => ({
          value: l,
          label: t(`welcome.languageShort.${l}`),
        }))}
      />
    </Screen>
  );
}

const styles = makeStyles(() => ({
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  brand: { letterSpacing: 3 },
  kicker: { textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: fonts.headingSemi },
  models: { flexDirection: 'row', gap: spacing.sm },
  model: { flex: 1, gap: spacing.sm, alignItems: 'center' },
  modelImage: {
    width: '100%',
    aspectRatio: 0.25,
    borderRadius: radius.card,
    backgroundColor: colors.bodyCanvas,
  },
  modelLabel: { textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: fonts.headingSemi },
}));
