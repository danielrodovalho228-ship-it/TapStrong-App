import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { spacing, useColors } from '@/theme';

import { captchaSiteKey, finishCaptcha, useCaptchaStore } from './captcha';
import { TurnstileWidget } from './TurnstileWidget';

/** Shows the Turnstile check when an anonymous sign-in or an email code asks for it. */
export function CaptchaHost() {
  const { t } = useTranslation();
  const colors = useColors();
  const pending = useCaptchaStore((s) => s.pending);
  if (!pending) return null;
  return (
    <Modal transparent animationType="fade" onRequestClose={() => finishCaptcha(null)}>
      <View style={[styles.backdrop, { backgroundColor: colors.scrim }]}>
        <Card style={styles.card}>
          <AppText variant="h3" accessibilityRole="header">
            {t('captcha.title')}
          </AppText>
          <AppText>{t('captcha.body')}</AppText>
          <TurnstileWidget siteKey={captchaSiteKey()} onToken={finishCaptcha} />
          <Button variant="ghost" label={t('common.cancel')} onPress={() => finishCaptcha(null)} />
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: { gap: spacing.sm, alignItems: 'stretch' },
});
