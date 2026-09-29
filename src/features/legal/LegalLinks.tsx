import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, TextLink } from '@/components/ui';
import { restore, restoreMessageKey } from '@/features/billing/actions';
import { openLegal, PRIVACY_URL, TERMS_URL } from '@/lib/legal';
import { makeStyles, spacing, useColors } from '@/theme';

/**
 * Terms of Use and Privacy Policy links (QA R7-04), with "Restore purchases"
 * where a subscription can be bought (paywall, Plans, Billing).
 */
export function LegalLinks({ withRestore = false }: { withRestore?: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {withRestore ? (
          <TextLink
            label={t('billing.restore')}
            onPress={async () => {
              const r = await restore();
              setMessage(t(restoreMessageKey(r)));
            }}
          />
        ) : null}
        {/* Unset in a dev build: hidden, never a link that looks live (QA R8 P2). */}
        {TERMS_URL ? (
          <TextLink label={t('legal.terms')} onPress={() => openLegal(TERMS_URL)} />
        ) : null}
        {PRIVACY_URL ? (
          <TextLink label={t('legal.privacy')} onPress={() => openLegal(PRIVACY_URL)} />
        ) : null}
      </View>
      {message ? (
        <AppText variant="caption" color={colors.mutedStrong} style={styles.center}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { gap: spacing.xs, alignItems: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: spacing.md },
  center: { textAlign: 'center' },
}));
