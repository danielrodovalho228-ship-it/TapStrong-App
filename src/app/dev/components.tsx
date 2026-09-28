import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button, Card, Chip, Header, IconButton } from '@/components/ui';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n';
import { colors, makeStyles, SENIOR_TYPE_BOOST, spacing } from '@/theme';

const GOALS = ['grow', 'firm', 'strengthen', 'balance', 'mobility'] as const;

/** Phase 0 component gallery. Replaced by /welcome in Phase 1. */
export default function ComponentGallery() {
  const { t, i18n } = useTranslation();
  const [goal, setGoal] = useState<(typeof GOALS)[number]>('grow');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Header title={t('app.name')} eyebrow={t('app.tagline')} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <AppText variant="display">{t('dev.gallery.title')}</AppText>
          <AppText color={colors.muted}>{t('dev.gallery.subtitle')}</AppText>
        </View>

        <View style={styles.section}>
          <AppText variant="h2">{t('dev.gallery.language')}</AppText>
          <View style={styles.row}>
            {SUPPORTED_LOCALES.map((locale: SupportedLocale) => (
              <Chip
                key={locale}
                label={t(`language.${locale}`)}
                selected={i18n.language === locale}
                onPress={() => void i18n.changeLanguage(locale)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <AppText variant="h2">{t('dev.gallery.buttons')}</AppText>
          <Button variant="accent" label={t('dev.gallery.accent')} />
          <Button label={t('dev.gallery.primary')} />
          <Button variant="secondary" label={t('dev.gallery.secondary')} />
          <Button variant="ghost" label={t('dev.gallery.ghost')} />
          <Button label={t('dev.gallery.disabled')} disabled />
        </View>

        <View style={styles.section}>
          <AppText variant="h2">{t('dev.gallery.chips')}</AppText>
          <View style={styles.row}>
            {GOALS.map((key) => (
              <Chip
                key={key}
                label={t(`muscleGoals.${key}`)}
                selected={goal === key}
                onPress={() => setGoal(key)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <AppText variant="h2">{t('dev.gallery.cards')}</AppText>
          <Card>
            <AppText variant="h3">{t('dev.gallery.cardTitle')}</AppText>
            <AppText color={colors.muted}>{t('dev.gallery.cardBody')}</AppText>
          </Card>
          <Card tone="safety">
            <AppText variant="h3" color={colors.teal}>
              {t('dev.gallery.safetyTitle')}
            </AppText>
            <AppText>{t('dev.gallery.safetyBody')}</AppText>
          </Card>
          <Card tone="dark">
            <AppText variant="h1" color={colors.dark.accent}>
              {t('app.tagline')}
            </AppText>
          </Card>
        </View>

        <View style={styles.section}>
          <AppText variant="h2">{t('dev.gallery.iconButtons')}</AppText>
          <View style={styles.row}>
            <IconButton icon="chevron-left" accessibilityLabel={t('common.back')} />
            <IconButton icon="close" variant="outlined" accessibilityLabel={t('common.close')} />
            <IconButton icon="minus" variant="outlined" accessibilityLabel={t('common.remove')} />
            <IconButton icon="plus" variant="filled" accessibilityLabel={t('common.add')} />
          </View>
        </View>

        <View style={styles.section}>
          <AppText variant="h2">{t('dev.gallery.type')}</AppText>
          <AppText variant="h1">{t('app.tagline')}</AppText>
          <AppText variant="body">{t('dev.gallery.cardBody')}</AppText>
          <AppText variant="caption" color={colors.muted}>
            {t('dev.gallery.cardBody')}
          </AppText>
          <AppText variant="body" boost={SENIOR_TYPE_BOOST}>
            {t('dev.gallery.seniorPreview')}
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = makeStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xxl, paddingBottom: spacing.xxxl },
  section: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
}));
