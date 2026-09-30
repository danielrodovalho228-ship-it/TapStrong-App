import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import type { BodySex } from '@/features/bodymap/images';
import { demoPoster } from '@/features/exercises/videos';
import { identityKey } from '@/features/home/identity';
import { momentText } from '@/features/moments/text';
import { muscleLabel } from '@/features/onboarding/summaries';
import { RecoveryBody } from '@/features/workout/components/RecoveryBody';
import type { RecoveryState } from '@/features/workout/recovery';
import { clock } from '@/lib/clock';
import { listText } from '@/lib/listText';
import { fonts, radius, shareCardColors, spacing } from '@/theme';

import { THINGS } from './fun';
import { DESIGN_SCALE, FORMAT_PX, type CardChrome, type CardData, type LitMuscles } from './types';

/** The card's layout size (captured at 3× → 1080 px wide). */
export function designSize(format: CardChrome['format']) {
  const px = FORMAT_PX[format];
  return { width: px.width / DESIGN_SCALE, height: px.height / DESIGN_SCALE };
}

const EMOJI: Record<string, string> = {
  first_workout: '🎉',
  first_back: '🦾',
  first_mobility: '🧘',
  first_week: '📅',
  map_new_muscle: '✨',
  map_all_back: '🔥',
  milestone_workouts: '🏅',
  milestone_reps: '💪',
  milestone_sets: '💪',
  fact: '💡',
  app_month: '🎈',
  app_year: '🎂',
  birthday: '🎂',
  repair_even: '⚖️',
  month_highlight: '⭐',
};

/**
 * A share card (Phase 28, A1/B). Drawn at 360 × 640 (Stories) or 360 × 450
 * (feed) and captured at 3×. Its colors are its own (soft coral, dark or a
 * transparent sticker), never the app theme. It shows the muscle map and
 * the effort, never the person's body, weight or measurements. The footer
 * has the discreet brand and the short link; the name only when turned on.
 */
export function ShareCard({ data, chrome }: { data: CardData; chrome: CardChrome }) {
  const { t, i18n } = useTranslation();
  const size = designSize(chrome.format);
  const c = shareCardColors[chrome.background];
  const sticker = chrome.background === 'transparent';
  const story = chrome.format === 'story';
  // 60+: larger letters (Phase 28, E).
  const k = chrome.mode === 'senior' ? 1.15 : 1;
  const shadow: TextStyle = sticker
    ? {
        textShadowColor: shareCardColors.shadow,
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
      }
    : {};
  const text = (size: number, font: string, color: string = c.ink): TextStyle => ({
    fontSize: size * k,
    lineHeight: size * k * 1.15,
    fontFamily: font,
    color,
    ...shadow,
  });
  const tt = (key: string, options?: object) =>
    (t as unknown as (k: string, o?: object) => string)(key, options);
  const muscle = (key: string) => muscleLabel(t, key);
  const mapHeight = (share: number) => Math.round(size.height * share);

  const map = (lit: LitMuscles, share: number) => (
    <View style={styles.map} testID="card-map">
      <RecoveryBody
        band={chrome.band}
        sex={chrome.sex as BodySex}
        states={Object.fromEntries(
          Object.entries(lit).map(([m, how]) => [
            m,
            (how === 'main' ? 'fresh' : 'recovering') as RecoveryState,
          ]),
        )}
        views="both"
        maxHeight={mapHeight(share)}
      />
    </View>
  );
  const stat = (value: string | number, label: string) => (
    <View style={styles.stat} key={label}>
      <Text style={[text(story ? 30 : 26, fonts.heading), styles.tabular]}>{value}</Text>
      <Text style={text(11, fonts.bodySemi, c.muted)} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
  const eyebrow = (label: string) => (
    <Text style={[text(12, fonts.headingSemi, c.accent), styles.caps]}>{label}</Text>
  );
  const title = (label: string, big = false) => (
    <Text style={[text(big ? 32 : 26, fonts.heading), styles.caps]}>{label}</Text>
  );

  let body: ReactNode = null;
  switch (data.template) {
    case 'workout':
      body = (
        <>
          {eyebrow(tt('shareCards.workoutEyebrow'))}
          {title(
            data.targets.length
              ? listText(data.targets.map(muscle), tt('common.and'))
              : tt('home.fullBody'),
          )}
          {map(data.lit, story ? 0.42 : 0.36)}
          <View style={styles.stats}>
            {stat(data.minutes, tt('shareCards.minutes'))}
            {stat(data.exercises, tt('shareCards.exercises', { count: data.exercises }))}
            {stat(data.sets, tt('shareCards.sets', { count: data.sets }))}
          </View>
          {data.streak > 0 ? (
            <View style={[styles.pill, { backgroundColor: c.panel }]}>
              <Text style={text(14, fonts.bodySemi)}>
                {tt('shareCards.streak', { count: data.streak })}
              </Text>
            </View>
          ) : null}
        </>
      );
      break;
    case 'sticker':
      body = (
        <>
          {map(data.lit, story ? 0.55 : 0.5)}
          <View style={styles.stats}>
            {stat(tt('shareCards.minValue', { minutes: data.minutes }), tt('shareCards.time'))}
            {stat(data.sets, tt('shareCards.sets', { count: data.sets }))}
          </View>
        </>
      );
      break;
    case 'muscle':
      body = (
        <>
          {eyebrow(tt('shareCards.muscleEyebrow'))}
          {title(tt('shareCards.muscleTitle', { muscle: muscle(data.muscle) }), true)}
          {map({ [data.muscle]: 'main' }, story ? 0.52 : 0.46)}
        </>
      );
      break;
    case 'exercise': {
      const poster = data.poster ? demoPoster(data.exerciseId, chrome.sex) : null;
      const cues = tt(`exercises.${data.exerciseId}.cues`)
        .split(/(?<=[.;!?])\s+|;\s*/)
        .map((s) => s.trim().replace(/[.;]$/, ''))
        .filter(Boolean)
        .slice(0, 3);
      body = (
        <>
          {eyebrow(tt('shareCards.exerciseEyebrow'))}
          {title(tt(`exercises.${data.exerciseId}.name`))}
          <View style={styles.exerciseRow}>
            {poster ? (
              <Image
                source={typeof poster === 'string' ? { uri: poster } : poster}
                style={[styles.poster, { height: mapHeight(story ? 0.36 : 0.3) }]}
                contentFit="cover"
                contentPosition="top"
                testID="card-poster"
              />
            ) : null}
            <View style={styles.flex}>
              {map(
                Object.fromEntries([
                  ...data.secondary.map((m) => [m, 'also' as const]),
                  ...data.primary.map((m) => [m, 'main' as const]),
                ]),
                story ? 0.3 : 0.24,
              )}
            </View>
          </View>
          <Text style={text(13, fonts.bodySemi, c.muted)} numberOfLines={2}>
            {[
              tt('shareCards.primary', { muscles: data.primary.map(muscle).join(', ') }),
              data.secondary.length
                ? tt('shareCards.secondary', { muscles: data.secondary.map(muscle).join(', ') })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <View style={styles.cues}>
            {cues.map((cue, i) => (
              <Text key={i} style={text(story ? 15 : 13, fonts.body)}>
                {tt('shareCards.cue', { n: i + 1, cue })}
              </Text>
            ))}
          </View>
        </>
      );
      break;
    }
    case 'achievement':
      body = (
        <>
          <Text style={styles.emoji}>{EMOJI[data.kind] ?? '⭐'}</Text>
          {eyebrow(tt('shareCards.achievementEyebrow'))}
          <Text style={text(story ? 28 : 24, fonts.heading)}>
            {momentText(
              t,
              { kind: data.kind as never, params: data.params },
              i18n.language,
              clock.now(),
            )}
          </Text>
          {Object.keys(data.lit).length ? map(data.lit, story ? 0.4 : 0.32) : null}
        </>
      );
      break;
    case 'week':
      body = (
        <>
          {eyebrow(tt('shareCards.weekEyebrow'))}
          {title(tt('shareCards.weekTitle', { count: data.workouts }))}
          {/* Identity, not guilt (Phase 27, B4). */}
          {identityKey(data.workouts) ? (
            <Text style={text(15, fonts.bodySemi, c.accent)} testID="card-identity">
              {tt(identityKey(data.workouts)!, { count: data.workouts })}
            </Text>
          ) : null}
          <View style={styles.days}>
            {data.days.map((on, i) => (
              <View
                key={i}
                style={[
                  styles.day,
                  { backgroundColor: on ? c.accent : c.panel, borderColor: c.accent },
                ]}
              />
            ))}
          </View>
          {map(data.lit, story ? 0.46 : 0.38)}
        </>
      );
      break;
    case 'month': {
      const monthName = new Date(`${data.monthOf}T12:00:00`).toLocaleDateString(i18n.language, {
        month: 'long',
      });
      body = (
        <>
          {eyebrow(tt('shareCards.monthEyebrow', { month: monthName }))}
          {data.highlight
            ? title(tt('shareCards.monthHighlight', { muscle: muscle(data.highlight) }), true)
            : title(tt('shareCards.monthTitle', { month: monthName }), true)}
          {map(data.lit, story ? 0.44 : 0.34)}
          <View style={styles.stats}>
            {stat(data.workouts, tt('shareCards.workouts', { count: data.workouts }))}
            {stat(data.days, tt('shareCards.days', { count: data.days }))}
            {stat(
              data.minutes >= 120
                ? tt('shareCards.hours', { hours: Math.round(data.minutes / 60) })
                : tt('shareCards.minValue', { minutes: data.minutes }),
              tt('shareCards.time'),
            )}
          </View>
        </>
      );
      break;
    }
    case 'fun': {
      const thing = THINGS.find((x) => x.key === data.thing);
      body = (
        <>
          <Text style={styles.bigEmoji}>{thing?.emoji ?? '💪'}</Text>
          {eyebrow(tt('shareCards.funEyebrow'))}
          <Text style={text(story ? 34 : 28, fonts.heading)}>
            {tt('shareCards.funTitle', {
              count: data.count,
              thing: tt(`shareCards.things.${data.thing}`, { count: data.count }),
            })}
          </Text>
          <Text style={text(12, fonts.body, c.muted)}>{tt('shareCards.funNote')}</Text>
        </>
      );
      break;
    }
  }

  return (
    <View
      testID={`share-card-${data.template}`}
      style={[
        styles.card,
        { width: size.width, height: size.height, backgroundColor: c.background },
        !sticker && styles.rounded,
      ]}
    >
      <View style={[styles.content, data.template === 'sticker' && styles.center]}>{body}</View>
      <View style={styles.footer} testID="card-footer">
        <Text style={[text(14, fonts.heading), styles.caps]}>{tt('app.name')}</Text>
        <View style={styles.footerRight}>
          {chrome.name ? (
            <Text style={text(11, fonts.bodySemi, c.muted)} numberOfLines={1}>
              {chrome.name}
            </Text>
          ) : null}
          {chrome.link ? (
            <Text style={text(11, fonts.body, c.muted)} numberOfLines={1} testID="card-link">
              {chrome.link}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, justifyContent: 'space-between', overflow: 'hidden' },
  rounded: { borderRadius: radius.card },
  content: { flex: 1, gap: spacing.sm },
  center: { justifyContent: 'center' },
  caps: { textTransform: 'uppercase', letterSpacing: 0.4 },
  tabular: { fontVariant: ['tabular-nums'] },
  map: { borderRadius: radius.card, overflow: 'hidden' },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1 },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  exerciseRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  poster: { width: '42%', borderRadius: radius.card },
  flex: { flex: 1 },
  cues: { gap: spacing.xs },
  emoji: { fontSize: 44 },
  bigEmoji: { fontSize: 72 },
  days: { flexDirection: 'row', gap: spacing.xs },
  day: { flex: 1, height: 18, borderRadius: 9, borderWidth: 1.5 },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  footerRight: { alignItems: 'flex-end', flexShrink: 1 },
});
