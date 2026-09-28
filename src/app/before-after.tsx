import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Header,
  Icon,
  Notice,
  Screen,
  SegmentedControl,
} from '@/components/ui';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { photosAllowed } from '@/features/progress/checkin';
import { deletePhotoFile, takePhoto } from '@/features/progress/photos';
import { useProgressStore, type Pose, type ProgressPhoto } from '@/features/progress/store';
import { colors, makeStyles, radius, spacing } from '@/theme';

/**
 * Mockup 26 — before & after. Adults only (SPEC §2.3–2.4: never for minors);
 * in 60+ mode only once turned on in Progress (off by default). Photos stay on this
 * phone; sharing uses the muscle map, never a photo.
 */
export default function BeforeAfterScreen() {
  const { t, i18n } = useTranslation();
  const mode = derive(useOnboardingStore())?.mode;
  const { photos, addPhoto, removePhoto, seniorPhotos } = useProgressStore();
  const [pose, setPose] = useState<Pose>('front');
  const [message, setMessage] = useState<string | null>(null);
  if (!photosAllowed(mode, seniorPhotos)) return <Redirect href="/progress" />;

  const ofPose = photos
    .filter((p) => p.pose === pose)
    .sort((a, b) => (a.takenAt < b.takenAt ? -1 : 1));
  const first = ofPose[0];
  const latest = ofPose.length > 1 ? ofPose.at(-1) : undefined;
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });

  const take = async () => {
    setMessage(null);
    const result = await takePhoto(pose);
    if (result.status === 'ok') addPhoto(result.photo);
    else if (result.status !== 'cancelled') setMessage(t(`photos.errors.${result.status}`));
  };

  const remove = (p: ProgressPhoto) => {
    deletePhotoFile(p.uri);
    removePhoto(p.id);
  };

  const slot = (photo: ProgressPhoto | undefined, label: string, empty: string) => (
    <View style={styles.slot}>
      {photo ? (
        <>
          <Image
            source={{ uri: photo.uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            alt=""
          />
          <View style={styles.slotLabel}>
            <AppText variant="caption" color={colors.onInk}>
              {t('photos.slotLabel', { label, date: date(photo.takenAt) })}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('photos.delete', { label })}
            onPress={() => remove(photo)}
            style={styles.delete}
          >
            <Icon name="close" color={colors.onInk} size={18} />
          </Pressable>
        </>
      ) : (
        <View style={styles.empty}>
          <Icon name="body" color={colors.onCanvasMuted} size={32} />
          <AppText variant="bodyStrong" color={colors.onCanvas}>
            {label}
          </AppText>
          <AppText variant="caption" color={colors.onCanvasMuted} style={styles.center}>
            {empty}
          </AppText>
        </View>
      )}
    </View>
  );

  return (
    <Screen
      header={
        <Header
          onBack={() => router.back()}
          eyebrow={t('photos.eyebrow')}
          title={t('photos.title')}
        />
      }
      footer={
        <>
          {/* Photos live only in the phone's private storage: on web, say so (QA round 1). */}
          {Platform.OS === 'web' ? (
            <AppText variant="caption" color={colors.mutedStrong} style={styles.center}>
              {t('photos.webOnly')}
            </AppText>
          ) : (
            <Button label={t('photos.take')} onPress={take} />
          )}
          <Button
            variant="secondary"
            label={t('photos.shareMap')}
            onPress={() => router.push('/share')}
          />
          <AppText variant="caption" color={colors.muted} style={styles.center}>
            {t('photos.shareNote')}
          </AppText>
        </>
      }
    >
      <SegmentedControl
        accessibilityLabel={t('photos.pose')}
        value={pose}
        onChange={setPose}
        options={(['front', 'side', 'back'] as Pose[]).map((p) => ({
          value: p,
          label: t(`photos.poses.${p}`),
        }))}
      />
      <View style={styles.pair}>
        {slot(first, t('photos.before'), t('photos.firstEmpty'))}
        {slot(latest, t('photos.after'), t('photos.latestEmpty'))}
      </View>
      {message ? <Notice tone="warning">{message}</Notice> : null}
      <Card style={styles.card}>
        {(['private', 'pose', 'reminder'] as const).map((k) => (
          <View key={k} style={styles.row}>
            <Icon
              name={k === 'private' ? 'shield' : k === 'pose' ? 'body' : 'check'}
              color={colors.teal}
            />
            <AppText style={styles.flex}>{t(`photos.points.${k}`)}</AppText>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = makeStyles(() => ({
  pair: { flexDirection: 'row', gap: spacing.md },
  slot: {
    flex: 1,
    aspectRatio: 0.62,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.muted,
    backgroundColor: colors.bodyCanvas,
    overflow: 'hidden',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
  },
  slotLabel: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: colors.ink,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  delete: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
}));
