import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Share, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Chip,
  Header,
  Icon,
  Screen,
  ToggleRow,
  type IconName,
} from '@/components/ui';
import { loadReferralCode, referralLink } from '@/features/account/cloud';
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

  return (
    <Screen header={<Header title={t('settings.title')} />}>
      {/* The plan card. */}
      <Card style={styles.planCard} testID="settings-plan">
        <AppText variant="label" color={colors.mutedStrong} style={styles.caps}>
          {t('settings.yourPlan')}
        </AppText>
        <AppText variant="h2">{t(`billing.plans.${plan}.name`)}</AppText>
        <Button
          variant={plan === 'free' ? 'accent' : 'secondary'}
          label={t('settings.plan')}
          onPress={() => router.push(plan === 'free' ? '/plans' : '/billing')}
        />
      </Card>

      <Section title={t('settings.sections.profile')}>
        <Row
          icon="body"
          label={t('settings.profile')}
          onPress={() => router.push('/onboarding/profile')}
        />
        <Row icon="shield" label={t('settings.account')} onPress={() => router.push('/account')} />
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
          label={t('settings.demoModel')}
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
          value={t('settings.soon')}
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
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      accessibilityValue={value ? { text: value } : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Icon name={icon} size={20} color={colors.accentText} />
      <AppText variant="bodyStrong" style={styles.flex}>
        {label}
      </AppText>
      {value ? (
        <AppText variant="caption" color={colors.mutedStrong}>
          {value}
        </AppText>
      ) : null}
      {onPress ? <Icon name="chevron-right" size={18} color={colors.mutedStrong} /> : null}
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  flex: { flex: 1 },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  planCard: { gap: spacing.sm },
  section: { gap: spacing.sm, marginTop: spacing.lg },
  group: {
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touchTarget + spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pressed: { backgroundColor: colors.line },
  toggle: { paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  block: {
    gap: spacing.xs,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
}));
