import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Chip, TextLink } from '@/components/ui';
import type { BodySex } from '@/features/bodymap/images';
import { modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import type { BodyBand } from '@/features/profile/age';
import { achievementCard, allowedCard } from '@/features/share/data';
import { openShare } from '@/features/share/open';
import { RecoveryBody } from '@/features/workout/components/RecoveryBody';
import { clock } from '@/lib/clock';
import { colors, fonts, makeStyles, radius, spacing, useColors } from '@/theme';

import { useMomentsStore, type StoredMoment } from './store';
import { momentEyebrow, momentText } from './text';

/**
 * A Moment (Phase 27, C): a small card on the end screen or Home, never
 * during a workout. Map Moments light their muscles on a small body. The
 * coach's question keeps its answer in the history. Sharing is only offered
 * where the profile may share (never minors without permission).
 */
export function MomentCard({
  moment,
  band,
  sex,
  canShare = false,
  at,
}: {
  moment: Pick<StoredMoment, 'id' | 'kind' | 'params' | 'muscles' | 'asks' | 'answer'>;
  band: BodyBand;
  sex: BodySex;
  canShare?: boolean;
  /** The date the text refers to (the month's name for the month highlight). */
  at?: Date;
}) {
  const { t, i18n } = useTranslation();
  const c = useColors();
  const styles = useStyles();
  const answer = useMomentsStore((s) => s.answer);
  const mode = useOnboardingStore(modeOf);
  const now = at ?? clock.now();
  const text = momentText(t, moment, i18n.language, now);
  const lit = moment.muscles?.length && moment.kind !== 'fact' ? moment.muscles : null;

  // "Share" opens the composer on this Moment's achievement card (Phase 28,
  // B4); a minor only for the habit Moments (E).
  const shareable =
    canShare &&
    !moment.asks &&
    allowedCard(achievementCard({ ...moment, muscles: moment.muscles ?? [] }), mode);

  return (
    <View style={styles.card} testID={`moment-${moment.kind}`}>
      <AppText variant="caption" color={c.accentText} style={styles.caps}>
        {momentEyebrow(t, moment)}
      </AppText>
      <AppText variant="h3" style={styles.text}>
        {text}
      </AppText>
      {lit ? (
        <RecoveryBody
          band={band}
          sex={sex}
          states={Object.fromEntries(lit.map((k) => [k, 'fresh' as const]))}
          views="both"
          maxHeight={200}
        />
      ) : null}
      {moment.asks ? (
        moment.answer ? (
          <AppText color={c.mutedStrong}>{t('moments.thanks')}</AppText>
        ) : (
          <View style={styles.row}>
            <Chip label={t('moments.good')} onPress={() => answer(moment.id, 'good')} />
            <Chip label={t('moments.notYet')} onPress={() => answer(moment.id, 'not_yet')} />
          </View>
        )
      ) : null}
      {shareable ? (
        <View style={styles.row}>
          <TextLink
            label={t('moments.share')}
            onPress={() => openShare({ template: 'achievement', moment: moment.id })}
          />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.primarySoft,
  },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  text: { textTransform: 'none', fontFamily: fonts.bodySemi },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
}));
