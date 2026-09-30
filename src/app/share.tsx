import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, Share, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button, Chip, IconButton, SegmentedControl, TextLink } from '@/components/ui';
import { loadReferralCode, referralLink } from '@/features/account/cloud';
import { useAccountStore } from '@/features/account/store';
import { displayBand } from '@/features/bodymap/selection';
import { demoSexFor } from '@/features/exercises/videos';
import { activeProfile, canShare, useFamilyStore } from '@/features/family/store';
import { useMomentsStore } from '@/features/moments/store';
import { useMonthStore } from '@/features/month/store';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { usePrefsStore } from '@/features/settings/store';
import { shareCard, targetsFor, type ShareTarget } from '@/features/share/actions';
import {
  achievementCard,
  allowedCard,
  exerciseCard,
  funCard,
  monthCard,
  muscleCard,
  rangeMonthCard,
  weekCard,
  workoutCard,
} from '@/features/share/data';
import { designSize, ShareCard } from '@/features/share/ShareCard';
import { shareCode, shortLink, useShareStore } from '@/features/share/store';
import type { CardData, ShareBackground, ShareFormat, ShareTemplate } from '@/features/share/types';
import { useExerciseLibrary } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import { streakToday } from '@/features/workout/streak';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { deviceWeekStart, localDate } from '@/lib/dates';
import { colors, fonts, makeStyles, spacing, useColors } from '@/theme';

type Params = {
  template?: ShareTemplate;
  workout?: string;
  exercise?: string;
  moment?: string;
  month?: string;
  range?: string;
  source?: 'button' | 'screenshot';
};

/**
 * Phase 28 — the share composer. One component for every card: pick the
 * card (from what this screen was opened with), the background (soft coral,
 * dark, or a transparent sticker) and the format (Stories or feed), then
 * send it: Instagram Stories, WhatsApp (first for 60+), save to the gallery,
 * the system sheet, or copy the sticker. The card shows the muscle map and
 * the effort, never the body, weight or measurements. Children never get
 * here; a teen only with the parent's switch, only the cards allowed to
 * minors, with no name and no link (canShare, Phase 28 E).
 */
export default function ShareScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const params = useLocalSearchParams<Params>();
  const profile = useOnboardingStore();
  const derived = derive(profile);
  const member = useFamilyStore(activeProfile);
  const account = useAccountStore();
  const library = useExerciseLibrary();
  const { workouts, streak } = useWorkoutStore();
  const moments = useMomentsStore((s) => s.shown);
  const markShared = useMomentsStore((s) => s.markShared);
  const history = useMonthStore((s) => s.history);
  const showName = usePrefsStore((s) => s.showNameOnCards);
  const addLink = useShareStore((s) => s.add);
  const { width } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const [code] = useState(() => shareCode());
  const [referral, setReferral] = useState<string | null>(account.referralCode ?? null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<ShareTarget | null>(null);

  const mode = derived?.mode ?? 'adult';
  const minor = mode === 'teen' || mode === 'child';
  const now = clock.now();

  // Every card this screen can make, allowed for this age mode.
  const cards = useMemo(() => {
    const out: CardData[] = [];
    const finished = workouts.filter((w) => w.status === 'done' || w.status === 'partial');
    const w = params.workout
      ? finished.find((x) => x.id === params.workout)
      : finished.filter((x) => x.kind !== 'mobility').at(-1);
    const days = streakToday(streak, localDate(now), deviceWeekStart());
    const exercise = params.exercise ? library.find((e) => e.id === params.exercise) : undefined;
    const moment = params.moment ? moments.find((m) => m.id === params.moment) : undefined;
    const month = params.month ? history.find((m) => m.id === params.month) : undefined;
    if (exercise && !exercise.custom) out.push(exerciseCard(exercise, demoSexFor(profile)));
    if (moment && moment.kind !== 'coach_pain') out.push(achievementCard(moment));
    if (month) out.push(monthCard(month.summary));
    if (params.range === '4w') out.push(rangeMonthCard(workouts, library, now));
    if (w) {
      out.push(workoutCard(w, library, days, now));
      out.push(workoutCard(w, library, days, now, 'sticker'));
      const muscle = muscleCard(w);
      if (muscle) out.push(muscle);
    }
    if (finished.length) out.push(weekCard(workouts, library, now, deviceWeekStart()));
    const fun = funCard(workouts, now, deviceWeekStart());
    if (fun) out.push(fun);
    return out.filter((c) => allowedCard(c, mode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    workouts,
    library,
    moments,
    history,
    mode,
    params.workout,
    params.exercise,
    params.moment,
    params.month,
    params.range,
  ]);

  const moment = params.moment ? moments.find((m) => m.id === params.moment) : undefined;
  const first = cards.find((c) => c.template === params.template) ?? cards[0];
  const [template, setTemplate] = useState<ShareTemplate | undefined>(first?.template);
  const card = cards.find((c) => c.template === template) ?? first;
  const [background, setBackground] = useState<ShareBackground>(
    first?.template === 'sticker' ? 'transparent' : 'light',
  );
  const [format, setFormat] = useState<ShareFormat>('story');

  useEffect(() => {
    if (account.saved && !referral && !minor) void loadReferralCode().then(setReferral);
  }, [account.saved, referral, minor]);
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !card) return;
    opened.current = true;
    track('share_opened', {
      template: card.template,
      source: params.source === 'screenshot' ? 'screenshot' : 'button',
    });
  }, [card, params.source]);

  if (!derived || !canShare(member, derived.mode)) return <Redirect href="/home" />;

  const band = displayBand(profile.bodyModel.band, derived.band, derived.mode);
  const sex = profile.bodyModel.sex ?? (profile.sex === 'f' ? 'f' : 'm');
  const chrome = {
    background,
    format,
    mode,
    sex,
    band,
    // A minor's card never has a name or a link (Phase 28, E).
    name: !minor && showName ? (member?.name ?? null) : null,
    link: minor ? null : shortLink(code),
  } as const;

  const size = designSize(format);
  // The preview fits the screen; the full-size card is drawn off screen for capture.
  const scale = Math.min((width - spacing.xl * 2) / size.width, 1);

  const send = async (target: ShareTarget) => {
    if (!card) return;
    setBusy(target);
    setFailed(false);
    const outcome = await shareCard({
      ref: cardRef,
      target,
      format,
      background,
      template: card.template,
      message: chrome.link ? `https://${chrome.link}` : undefined,
    });
    setBusy(null);
    if (outcome === 'failed') return setFailed(true);
    if (outcome === 'cancelled') return;
    // The link's page draws this card (adults and 60+ only; never minors).
    if (!minor) addLink(card, code, clock.now());
    if (card.template === 'achievement' && moment) {
      markShared(moment.id);
      track('moment_shared', { kind: moment.kind });
    }
  };

  const invite = async () => {
    if (!referral) return;
    await Share.share({ message: t('share.inviteMessage', { link: referralLink(referral) }) });
    track('share_card_shared', { target: 'link' });
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <IconButton
          icon="close"
          color={colors.dark.text}
          accessibilityLabel={t('common.close')}
          onPress={close}
        />
        <AppText variant="caption" color={colors.dark.accentSoft} style={styles.caps}>
          {t('shareSheet.title')}
        </AppText>
        <View style={styles.spacer} />
      </View>
      {!card ? (
        <View style={styles.content}>
          <AppText color={colors.dark.text}>{t('shareSheet.nothing')}</AppText>
          {/* "Share with friends" = the invite link (QA), adults only. */}
          {!minor ? (
            referral ? (
              <View style={styles.links}>
                <TextLink label={t('share.shareLink')} onPress={invite} />
              </View>
            ) : !account.saved ? (
              <AppText variant="caption" color={colors.dark.accentSoft} style={styles.center}>
                {t('share.saveForLink')}
              </AppText>
            ) : null
          ) : null}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {cards.length > 1 ? (
            <View style={styles.chips} accessibilityRole="radiogroup">
              {cards.map((c) => (
                <Chip
                  key={c.template}
                  label={t(`shareSheet.templates.${c.template}`)}
                  selected={c.template === card.template}
                  onPress={() => {
                    setTemplate(c.template);
                    if (c.template === 'sticker') setBackground('transparent');
                  }}
                />
              ))}
            </View>
          ) : null}

          <View
            style={[styles.preview, { width: size.width * scale, height: size.height * scale }]}
            accessibilityLabel={t('shareSheet.preview')}
          >
            <View
              style={{
                width: size.width,
                height: size.height,
                transform: [{ scale }],
                transformOrigin: 'top left',
              }}
            >
              <ShareCard data={card} chrome={chrome} />
            </View>
          </View>

          <SegmentedControl
            accessibilityLabel={t('shareSheet.background')}
            value={background}
            onChange={setBackground}
            options={(['light', 'dark', 'transparent'] as const).map((v) => ({
              value: v,
              label: t(`shareSheet.backgrounds.${v}`),
            }))}
          />
          <SegmentedControl
            accessibilityLabel={t('shareSheet.format')}
            value={format}
            onChange={setFormat}
            options={(['story', 'feed'] as const).map((v) => ({
              value: v,
              label: t(`shareSheet.formats.${v}`),
            }))}
          />

          <View style={styles.targets}>
            {targetsFor(mode, background).map((target, i) => (
              <Button
                key={target}
                // One main button (Phase 27): the first target; 60+ get WhatsApp.
                variant={i === 0 ? 'accent' : 'onDark'}
                label={t(`shareSheet.targets.${target}`)}
                loading={busy === target}
                onPress={() => send(target)}
              />
            ))}
          </View>
          {failed ? (
            <AppText variant="caption" color={colors.dark.accentSoft} style={styles.center}>
              {t('share.failed')}
            </AppText>
          ) : null}
          {Platform.OS === 'web' ? (
            <AppText variant="caption" color={colors.dark.accentSoft} style={styles.center}>
              {t('shareSheet.webNote')}
            </AppText>
          ) : null}

          {/* "Share with friends" = the invite link (QA), adults only. */}
          {!minor ? (
            referral ? (
              <View style={styles.links}>
                <TextLink label={t('share.shareLink')} onPress={invite} />
              </View>
            ) : !account.saved ? (
              <AppText variant="caption" color={colors.dark.accentSoft} style={styles.center}>
                {t('share.saveForLink')}
              </AppText>
            ) : null
          ) : null}
        </ScrollView>
      )}

      {/* The full-size card, off screen, for the PNG. */}
      {card ? (
        <View style={styles.offscreen} pointerEvents="none" aria-hidden>
          <View ref={cardRef} collapsable={false}>
            <ShareCard data={card} chrome={chrome} />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const useStyles = makeStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.dark.background },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  spacer: { width: 44 },
  caps: {
    flex: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: fonts.headingSemi,
  },
  content: { padding: spacing.xl, gap: spacing.md, alignItems: 'stretch' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  preview: { alignSelf: 'center', overflow: 'hidden' },
  targets: { gap: spacing.sm },
  links: { flexDirection: 'row', justifyContent: 'center' },
  center: { textAlign: 'center' },
  offscreen: { position: 'absolute', top: 0, left: -10000 },
}));
