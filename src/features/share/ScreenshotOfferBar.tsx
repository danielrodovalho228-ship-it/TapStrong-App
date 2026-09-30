import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, IconButton } from '@/components/ui';
import { usePrefsStore } from '@/features/settings/store';
import { track } from '@/lib/analytics';
import { colors, makeStyles, radius, spacing, useColors } from '@/theme';

import { openShare } from './open';
import { OFFER_SECONDS, useScreenshotOfferStore } from './screenshot';

/**
 * The bar a screenshot brings up (Phase 28, C), drawn once above every
 * screen from the root layout. It goes away by itself after 5 s; [x] counts
 * as a "no" (3 in a row and it stops); [Create card] opens that screen's card.
 */
export function ScreenshotOfferBar() {
  const { t } = useTranslation();
  const c = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const offer = useScreenshotOfferStore((s) => s.offer);
  const hide = useScreenshotOfferStore((s) => s.hide);

  useEffect(() => {
    if (!offer) return;
    const timer = setTimeout(hide, OFFER_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [offer, hide]);

  if (!offer) return null;

  const create = () => {
    hide();
    usePrefsStore.getState().set({ shareOfferDeclines: 0 });
    openShare({ ...offer, source: 'screenshot' });
  };
  const decline = () => {
    hide();
    const prefs = usePrefsStore.getState();
    prefs.set({ shareOfferDeclines: prefs.shareOfferDeclines + 1 });
    track('share_offer_declined', { template: offer.template });
  };

  return (
    <View
      style={[styles.bar, { bottom: insets.bottom + spacing.md }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID="screenshot-offer"
    >
      <AppText color={c.dark.text} style={styles.text}>
        {t('shareOffer.text')}
      </AppText>
      <Button variant="accent" label={t('shareOffer.create')} onPress={create} />
      <IconButton
        icon="close"
        color={c.dark.text}
        accessibilityLabel={t('shareOffer.close')}
        onPress={decline}
      />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  bar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.dark.background,
  },
  text: { flex: 1, minWidth: 160 },
}));
