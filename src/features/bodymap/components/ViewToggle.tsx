import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { colors, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

import type { BodyView } from '../images';

/** Front / back, and one tap to turn the body around (Phase 29, B10). */
export function ViewToggle({
  value,
  onChange,
  inline = false,
}: {
  value: BodyView;
  onChange: (v: BodyView) => void;
  /** In the flow (a row under the body) instead of over its corner. */
  inline?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('bodyMap.view')}
      style={[styles.toggle, inline && styles.inline]}
    >
      {/* One tap turns the body around (Phase 29, B10). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('bodyMap.rotate')}
        onPress={() => onChange(value === 'front' ? 'back' : 'front')}
        style={styles.toggleItem}
        testID="body-rotate"
      >
        <Icon name="rotate" size={20} color={colors.mutedStrong} />
      </Pressable>
      {(['front', 'back'] as const).map((v) => {
        const on = v === value;
        return (
          <Pressable
            key={v}
            accessibilityRole="radio"
            // "Back view", not a second "Back" next to the header's back button (QA round 2).
            accessibilityLabel={t(`bodyMap.${v}View`)}
            accessibilityState={{ checked: on }}
            aria-checked={on}
            onPress={() => onChange(v)}
            style={[styles.toggleItem, on && styles.toggleOn]}
          >
            <AppText variant="button" color={on ? colors.onInk : colors.mutedStrong}>
              {t(`bodyMap.${v}`)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  toggle: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  inline: { position: 'relative', top: 0, right: 0, flexDirection: 'row' },
  toggleItem: {
    minHeight: sizes.touchTarget,
    minWidth: 72,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: colors.ink },
}));
