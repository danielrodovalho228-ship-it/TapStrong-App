import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText, Card, Header, Icon, Screen } from '@/components/ui';
import { PROGRAM_TAGS, REHAB_PROGRAMS } from '@/features/rehab/programs';
import { useRehabStore } from '@/features/rehab/store';
import { Tag } from '@/features/workout/components/Media';
import { makeStyles, spacing, useColors } from '@/theme';

/** Rehabilitation (Phase 30): the guided programs, one card each. */
export default function RehabScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const runs = useRehabStore((s) => s.runs);
  return (
    <Screen header={<Header onBack={() => router.back()} title={t('rehab.category')} />}>
      <AppText color={colors.mutedStrong}>{t('rehab.categoryBody')}</AppText>
      {REHAB_PROGRAMS.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={t(`rehab.programs.${p.id as 'shoulder_mobility_strength'}.title`)}
          onPress={() => router.push({ pathname: '/rehab/[id]', params: { id: p.id } })}
          testID={`rehab-program-${p.id}`}
        >
          <Card style={styles.card}>
            <View style={styles.row}>
              <AppText variant="h3" style={styles.flex}>
                {t(`rehab.programs.${p.id as 'shoulder_mobility_strength'}.title`)}
              </AppText>
              <Icon name="chevron-right" color={colors.mutedStrong} />
            </View>
            <AppText color={colors.mutedStrong}>
              {t(`rehab.programs.${p.id as 'shoulder_mobility_strength'}.body`)}
            </AppText>
            <View style={styles.tags}>
              {PROGRAM_TAGS.map((k) => (
                <Tag key={k} label={t(`rehab.tags.${k}`)} tone="teal" />
              ))}
            </View>
            {runs[p.id] ? (
              <AppText variant="caption" color={colors.teal}>
                {t('rehab.sideCurrent', {
                  side: t(`rehab.sideOptions.${runs[p.id].side}`).toLowerCase(),
                })}
              </AppText>
            ) : null}
          </Card>
        </Pressable>
      ))}
      <AppText variant="caption" color={colors.mutedStrong}>
        {t('rehab.educational')}
      </AppText>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
}));
