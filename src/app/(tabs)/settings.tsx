import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Share, View } from 'react-native';

import {
  AppText,
  Button,
  Chip,
  Header,
  Icon,
  Screen,
  ToggleRow,
  type IconName,
} from '@/components/ui';
import { loadReferralCode, referralLink } from '@/features/account/cloud';
import { Tag } from '@/features/workout/components/Media';
import { isInternalBuild } from '@/lib/variant';
import { currentPlan } from '@/features/billing/rules';
import { useBillingStore } from '@/features/billing/store';
import { useOwnerAccess } from '@/features/family/OwnerOnly';
import { ParentGate, ParentPinSetup } from '@/features/family/ParentGate';
import { useParentPinStore } from '@/features/family/parentPin';
import { activeProfile, canShare, useFamilyStore } from '@/features/family/store';
import { LegalLinks } from '@/features/legal/LegalLinks';
import { modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { usePrefsStore } from '@/features/settings/store';
import { clock } from '@/lib/clock';
import { familyAvailable } from '@/lib/features';
import { openStore, storeLinks } from '@/lib/storeLinks';
import { contactSupport, SUPPORT_EMAIL } from '@/lib/support';
import { colors, fonts, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

/**
 * Settings (QA round 1; Phase 31, F): a grouped list — the plan card,
 * profile and account, the workout preferences, connections, help and the
 * legal links, with Delete account at the bottom (App Store rule). Owner-only
 * screens keep their own parent gate.
 */
export default function SettingsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const entitlement = useBillingStore((s) => s.entitlement);
  const plan = currentPlan(entitlement, clock.now());
  const owner = useOwnerAccess() === 'owner';
  const hasPin = useParentPinStore((s) => !!s.hash || s.serverHasPin);
  const prefs = usePrefsStore();
  const profile = useOnboardingStore();
  // Changing the parent PIN asks for the current one first (QA R2-05).
  const [pinStep, setPinStep] = useState<'check' | 'set' | 'saved' | null>(null);
  // The PIN just checked: the server needs it to change the PIN (S2-P2-2).
  const [currentPin, setCurrentPin] = useState<string | undefined>();
  // "Share with friends" shares the invite link, only where sharing is on (QA R4 P2).
  const member = useFamilyStore(activeProfile);
  const mode = modeOf(profile);
  const minor = mode === 'child' || mode === 'teen';
  const shareOk = canShare(member, mode);
  const store = storeLinks()[Platform.OS === 'ios' ? 'ios' : 'android'];
  const shareInvite = async () => {
    const code = await loadReferralCode();
    if (!code) return router.push('/share');
    await Share.share({ message: t('share.inviteMessage', { link: referralLink(code) }) });
  };
  const workoutPrefs = () => router.push('/settings/workout');
  const planTitle = `${t('app.name')} ${t(`billing.plans.${plan}.name`)}`;

  return (
    <Screen
      header={
        <Header
          title={t('settings.title')}
          // The internal test build says so, small (Daniel, Oct 3).
          right={
            isInternalBuild() ? (
              <View testID="test-build-badge">
                <Tag label={t('settings.testBuild')} />
              </View>
            ) : undefined
          }
        />
      }
    >
      {/* The plan card, like a membership card (Phase 31, G). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t(`billing.plans.${plan}.name`)}, ${t('settings.plan')}`}
        onPress={() => router.push(plan === 'free' ? '/plans' : '/billing')}
        style={styles.planCard}
        testID="settings-plan"
      >
        <View style={styles.planStripes} aria-hidden>
          {[0, 1, 2, 3, 4].map((n) => (
            <View key={n} style={styles.stripe} />
          ))}
        </View>
        <Icon name="dumbbell" size={30} color={colors.onAccent} />
        <View style={styles.planText}>
          <AppText color={colors.onAccent}>{t('settings.yourPlan')}</AppText>
          <AppText variant="h2" color={colors.onAccent} style={styles.planName}>
            {planTitle}
          </AppText>
        </View>
      </Pressable>

      {/* Profile and account in one card. */}
      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.profile')}
          onPress={() => router.push('/onboarding/profile')}
          style={styles.profileRow}
        >
          <View style={styles.avatar}>
            <Icon name="body" size={28} color={colors.mutedStrong} />
          </View>
          <View style={styles.flex}>
            <AppText variant="h3" numberOfLines={1}>
              {member?.name ?? t('settings.profile')}
            </AppText>
            <AppText color={colors.mutedStrong}>{t('settings.personalInfo')}</AppText>
          </View>
          <Icon name="chevron-right" color={colors.ink} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.account')}
          onPress={() => router.push('/account')}
          style={styles.accountRow}
        >
          <Icon name="shield" size={20} color={colors.accentText} />
          <AppText variant="bodyStrong" style={styles.flex}>
            {t('settings.myAccount')}
          </AppText>
          <AppText variant="bodyStrong">{t('settings.manage')}</AppText>
        </Pressable>
      </View>

      <Section title={t('settings.sections.profile')}>
        {familyAvailable() ? (
          <Row icon="family" label={t('tabs.family')} onPress={() => router.push('/family')} />
        ) : null}
        <Row
          icon="star"
          label={t('prefs.experience')}
          value={t(`prefs.experienceLevels.${prefs.experience}`)}
          onPress={workoutPrefs}
        />
        <Row
          icon="list"
          label={t('prefs.units')}
          value={profile.units === 'imperial' ? t('prefs.unitsImperial') : t('prefs.unitsMetric')}
          onPress={workoutPrefs}
        />
      </Section>

      <Section title={t('settings.sections.workout')}>
        {/* Minors never see a load: no load suggestions to turn on or off. */}
        {!minor ? (
          <View style={styles.toggle}>
            <ToggleRow
              label={t('settings.smartLoads')}
              detail={t('settings.smartLoadsDetail')}
              value={prefs.smartLoads}
              onChange={(smartLoads) => prefs.set({ smartLoads })}
            />
          </View>
        ) : null}
        <Row
          icon="clock"
          label={t('prefs.rest')}
          value={
            prefs.restStrength
              ? t('settings.seconds', { count: prefs.restStrength })
              : t('prefs.restAuto')
          }
          onPress={workoutPrefs}
        />
        {/* Shortened, never removed (SPEC §8). */}
        <View style={styles.block}>
          <AppText variant="bodyStrong">{t('prefs.warmup')}</AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {(['standard', 'short'] as const).map((w) => (
              <Chip
                key={w}
                label={t(w === 'standard' ? 'prefs.warmupStandard' : 'prefs.warmupShort')}
                selected={prefs.warmup === w}
                accessibilityRole="radio"
                accessibilityState={{ checked: prefs.warmup === w }}
                onPress={() => prefs.set({ warmup: w })}
              />
            ))}
          </View>
          <AppText variant="caption" color={colors.mutedStrong}>
            {t('prefs.warmupNote')}
          </AppText>
        </View>
        <View style={styles.block}>
          <AppText variant="bodyStrong">{t('settings.planView')}</AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {(['cards', 'list'] as const).map((v) => (
              <Chip
                key={v}
                label={t(`settings.planViews.${v}`)}
                selected={prefs.planView === v}
                accessibilityRole="radio"
                accessibilityState={{ checked: prefs.planView === v }}
                onPress={() => prefs.set({ planView: v })}
              />
            ))}
          </View>
        </View>
        <Row
          icon="body"
          label={t('settings.chooseModel')}
          detail={t('settings.chooseModelDetail')}
          action={t('settings.choose')}
          onPress={() =>
            router.push({ pathname: '/onboarding/chat', params: { step: 'body', edit: '1' } })
          }
        />
        <Row
          icon="dumbbell"
          label={t('equipmentSettings.title')}
          onPress={() => router.push('/settings/equipment')}
        />
        <Row
          icon="alert"
          label={t('settings.restrictions')}
          onPress={() => router.push('/restrictions')}
        />
        <Row icon="settings" label={t('settings.workout')} onPress={workoutPrefs} />
        <Row
          icon="calendar"
          label={t('settings.reminders')}
          onPress={() => router.push('/settings/reminders')}
        />
        <Row
          icon="settings"
          label={t('settings.appearance')}
          onPress={() => router.push('/settings/appearance')}
        />
      </Section>

      <Section title={t('settings.sections.connections')}>
        {/* Needs a native module and Daniel's OK (stack change): shown, not live. */}
        <Row
          icon="progress"
          label={t(Platform.OS === 'android' ? 'settings.healthConnect' : 'settings.appleHealth')}
          detail={t('settings.healthDetail')}
          action={t('settings.soon')}
        />
      </Section>

      <Section title={t('settings.sections.support')}>
        {SUPPORT_EMAIL ? (
          <Row
            icon="info"
            label={t('settings.help')}
            onPress={() => void contactSupport(t('settings.helpSubject'))}
          />
        ) : null}
        {store ? (
          <Row icon="star" label={t('settings.rate')} onPress={() => void openStore(store)} />
        ) : null}
        {shareOk ? (
          <Row icon="share" label={t('settings.shareFriends')} onPress={() => void shareInvite()} />
        ) : null}
        {/* No parent PIN on the web: family profiles are mobile-only (S1-03). */}
        {owner && familyAvailable() ? (
          <Row
            icon="shield"
            label={hasPin ? t('settings.changePin') : t('settings.setPin')}
            onPress={() => setPinStep(hasPin ? 'check' : 'set')}
          />
        ) : null}
        {pinStep === 'check' ? (
          <ParentGate
            onPass={(pin) => {
              setCurrentPin(pin);
              setPinStep('set');
            }}
            onCancel={() => setPinStep(null)}
          />
        ) : pinStep === 'set' ? (
          <ParentPinSetup
            oldPin={currentPin}
            onDone={() => {
              setCurrentPin(undefined);
              setPinStep('saved');
            }}
            onCancel={() => {
              setCurrentPin(undefined);
              setPinStep(null);
            }}
          />
        ) : pinStep === 'saved' ? (
          <AppText color={colors.teal}>{t('settings.pinSaved')}</AppText>
        ) : null}
      </Section>

      {/* About: Terms of Use and Privacy Policy (QA R7-04). */}
      <View style={styles.section}>
        <AppText variant="h3">{t('legal.title')}</AppText>
        <AppText variant="caption" color={colors.mutedStrong}>
          {t('legal.body')}
        </AppText>
        <LegalLinks />
      </View>
      <View style={styles.section}>
        <AppText variant="caption" color={colors.mutedStrong}>
          {t('settings.deleteNote')}
        </AppText>
        <Button
          variant="ghost"
          label={t('settings.delete')}
          onPress={() => router.push('/delete-account')}
        />
      </View>
      {/* Test builds carry draft exercises: said once, small, here (Phase 32 B8). */}
      {__DEV__ || isInternalBuild() ? (
        <AppText variant="caption" color={colors.muted} testID="settings-draft-note">
          {t('workout.draftBadge')}
        </AppText>
      ) : null}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <AppText
        variant="label"
        color={colors.mutedStrong}
        style={styles.caps}
        accessibilityRole="header"
      >
        {title}
      </AppText>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  detail,
  action,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  /** A second line under the label. */
  detail?: string;
  /** An outlined pill on the right ("Choose", "Coming soon") instead of a chevron. */
  action?: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      accessibilityValue={value || action ? { text: value ?? action } : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Icon name={icon} size={22} color={colors.accentText} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{label}</AppText>
        {detail ? (
          <AppText variant="caption" color={colors.mutedStrong}>
            {detail}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="caption" color={colors.mutedStrong}>
          {value}
        </AppText>
      ) : null}
      {action ? (
        <View style={styles.pill}>
          <AppText variant="bodyStrong" color={colors.accentText}>
            {action}
          </AppText>
        </View>
      ) : onPress ? (
        <Icon name="chevron-right" size={20} color={colors.ink} />
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  flex: { flex: 1 },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  planCard: {
    alignSelf: 'center',
    width: '78%',
    aspectRatio: 1.6,
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: radius.card * 2,
    overflow: 'hidden',
    backgroundColor: colors.accent,
  },
  planStripes: {
    position: 'absolute',
    right: -40,
    top: -20,
    bottom: -20,
    width: '60%',
    flexDirection: 'row',
    gap: spacing.sm,
    transform: [{ skewX: '-25deg' }],
  },
  stripe: { flex: 1, backgroundColor: colors.accentPressed, opacity: 0.6 },
  planText: { gap: spacing.xxs },
  planName: { fontStyle: 'italic', textTransform: 'uppercase' },
  card: { borderRadius: radius.card * 1.5, backgroundColor: colors.sunken, overflow: 'hidden' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  divider: { height: 1, marginLeft: spacing.xxxl * 2, backgroundColor: colors.line },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touchTarget + spacing.md,
    paddingHorizontal: spacing.md,
  },
  section: { gap: spacing.sm, marginTop: spacing.lg },
  group: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touchTarget + spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.card * 1.5,
    backgroundColor: colors.sunken,
  },
  pressed: { backgroundColor: colors.surface },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.chip * 2,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  toggle: {
    paddingHorizontal: spacing.md,
    borderRadius: radius.card * 1.5,
    backgroundColor: colors.sunken,
  },
  block: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.card * 1.5,
    backgroundColor: colors.sunken,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
}));
