import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { useAccountStore } from '@/features/account/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { kvStorage } from '@/lib/storage';
import { colors, fonts, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

import { FAMILY_MAX_PROFILES } from '../../billing/rules';
import { summarize } from '../profiles';
import { useFamilyStore, type LocalProfile } from '../store';
import { ensureSelfProfile } from '../switch';

/** Family profiles and the "Add" card (mockup 19). */
export function FamilyStrip() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const live = useOnboardingStore();
  const { profiles, activeId } = useFamilyStore();
  // Registering the owner writes to a store: in an effect, never during
  // render (QA A-10, R2-12).
  useEffect(() => {
    if (!profiles.length) ensureSelfProfile();
  }, [profiles.length]);
  const selfId = useAccountStore((st) => st.profileId);
  const list: LocalProfile[] = profiles.length
    ? profiles
    : [{ id: selfId, kind: 'self', createdAt: '' }];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {list.map((p) => {
        const s = summarize(p, activeId, live, kvStorage.getItem);
        const name = p.kind === 'self' ? t('family.you') : (p.name ?? t('family.member'));
        return (
          <View key={p.id} style={styles.card}>
            <View style={styles.avatar}>
              <AppText variant="h2" color={colors.ink}>
                {name.slice(0, 1).toUpperCase()}
              </AppText>
            </View>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {s.age != null && p.kind !== 'self' ? `${name}, ${s.age}` : name}
            </AppText>
            <AppText variant="caption" color={colors.muted} style={styles.caps}>
              {s.mode ? t(`family.modes.${s.mode}`) : t('family.setUp')}
            </AppText>
          </View>
        );
      })}
      {list.length < FAMILY_MAX_PROFILES ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('family.add')}
          onPress={() => router.push('/family/add')}
          style={styles.card}
        >
          <View style={[styles.avatar, styles.add]}>
            <Icon name="plus" />
          </View>
          <AppText variant="bodyStrong">{t('family.add')}</AppText>
          <AppText variant="caption" color={colors.muted} style={styles.caps}>
            {t('family.upTo', { count: FAMILY_MAX_PROFILES })}
          </AppText>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles(() => ({
  row: { gap: spacing.md },
  card: { width: 88, gap: spacing.xs, minHeight: sizes.touchTarget },
  avatar: {
    width: 88,
    height: 104,
    borderRadius: radius.card,
    // A letter, not a body image: the soft tint of each mode (QA R6 P2).
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.muted,
  },
  caps: { textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: fonts.headingSemi },
}));
