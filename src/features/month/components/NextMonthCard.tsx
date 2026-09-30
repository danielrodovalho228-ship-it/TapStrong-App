import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Button, Card, Checkbox, TextLink } from '@/components/ui';
import type { Exercise } from '@/features/exercises/types';
import { muscleLabel } from '@/features/onboarding/summaries';
import { exerciseName } from '@/features/workout/format';
import { listText } from '@/lib/listText';
import { spacing, useColors } from '@/theme';

import type { MonthOffer } from '../store';

/**
 * "Your next month" (Phase 26, B): one choice with the default ready. The
 * main button keeps the muscles and goals, renews the moves and adds the
 * suggested focus; "See / adjust" locks moves to keep them; "Repeat the
 * same" and "Choose on the body" are the only other options.
 */
export function NextMonthCard({
  offer,
  library,
  onContinue,
  onRepeat,
  onBody,
  onLock,
}: {
  offer: MonthOffer;
  library: Exercise[];
  onContinue: () => void;
  onRepeat: () => void;
  onBody: () => void;
  onLock: (locked: string[]) => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState<string[]>([]);
  const byId = new Map(library.map((e) => [e.id, e]));
  const name = (id: string) => exerciseName(t, byId.get(id), id);
  const r = offer.recommended;
  const swaps = r.changes.filter((c) => c.to).length;
  const kept = r.keep.slice(0, 3).map(name);
  const focus = offer.focus.map((f) => muscleLabel(t, f.muscle));
  const all = [...r.keep, ...r.changes.map((c) => c.from)];

  const toggle = (id: string) => {
    const next = locked.includes(id) ? locked.filter((x) => x !== id) : [...locked, id];
    setLocked(next);
    onLock(next);
  };

  return (
    <Card style={{ gap: spacing.sm }}>
      <AppText variant="h3" accessibilityRole="header">
        {t('month.nextTitle')}
      </AppText>
      <View testID="month-preview" style={{ gap: 2 }}>
        {kept.length ? (
          <AppText color={colors.mutedStrong}>
            {t('month.previewKeep', { list: listText(kept, t('common.and')) })}
          </AppText>
        ) : null}
        <AppText color={colors.mutedStrong}>
          {swaps ? t('month.previewSwap', { count: swaps }) : t('month.previewSwapNone')}
        </AppText>
        {focus.length ? (
          <AppText color={colors.mutedStrong}>
            {t('month.previewFocus', { list: listText(focus, t('common.and')) })}
          </AppText>
        ) : null}
        {offer.focus.map((f) => (
          <AppText key={f.muscle} variant="caption" color={colors.muted}>
            {t('month.focusWhy', {
              muscle: muscleLabel(t, f.muscle),
              reason: t(`month.reasons.${f.reason}`),
            })}
          </AppText>
        ))}
      </View>
      <Button variant="accent" label={t('month.continue')} onPress={onContinue} />
      <TextLink label={t('month.adjust')} onPress={() => setOpen((o) => !o)} />
      {open ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" color={colors.mutedStrong}>
            {t('month.adjustHint')}
          </AppText>
          {all.map((id) => {
            const change = r.changes.find((c) => c.from === id);
            const isLocked = locked.includes(id);
            return (
              <Checkbox
                key={id}
                checked={isLocked}
                onChange={() => toggle(id)}
                label={`${name(id)} — ${
                  change?.to && !isLocked
                    ? t('month.willSwap', { exercise: name(change.to) })
                    : t('month.willKeep')
                }`}
              />
            );
          })}
        </View>
      ) : null}
      <Button variant="secondary" label={t('month.repeat')} onPress={onRepeat} />
      <AppText variant="caption" color={colors.muted}>
        {t('month.repeatHint')}
      </AppText>
      <Button variant="ghost" label={t('month.body')} onPress={onBody} />
    </Card>
  );
}
