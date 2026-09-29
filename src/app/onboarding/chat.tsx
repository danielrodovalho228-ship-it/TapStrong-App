import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';

import {
  AppText,
  Button,
  CoachMessage,
  Header,
  IconButton,
  Notice,
  Screen,
  StepProgress,
  UserMessage,
} from '@/components/ui';
import { interpretAnswer } from '@/features/onboarding/coach';
import { StepControls } from '@/features/onboarding/components/StepControls';
import { derive } from '@/features/onboarding/derived';
import { allowsFreeText, isStepComplete } from '@/features/onboarding/interview';
import {
  INTERVIEW_STEPS,
  MAX_USER_TEXT,
  STEP_NUMBER,
  TOTAL_STEPS,
  type InterviewStep,
} from '@/features/onboarding/options';
import { useOnboardingStore } from '@/features/onboarding/store';
import { answerSummary, coachAck } from '@/features/onboarding/summaries';
import { visibleMainGoals } from '@/features/onboarding/visible';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n';
import { track } from '@/lib/analytics';
import { colors, fonts, makeStyles, radius, sizes, spacing, useColors, useScheme } from '@/theme';

function isInterviewStep(value: unknown): value is InterviewStep {
  return typeof value === 'string' && (INTERVIEW_STEPS as readonly string[]).includes(value);
}

/** Mockup 03 — Coach interview (steps 2–5 of 7). */
export default function ChatScreen() {
  const colors = useColors();
  const scheme = useScheme();
  const styles = useStyles();
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ step?: string; edit?: string }>();
  const s = useOnboardingStore();
  const scrollRef = useRef<ScrollView>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  // The coach couldn't be reached without a person check (S2-P2-8).
  const [coachOff, setCoachOff] = useState(false);

  const derived = derive(s);
  if (!derived) return <Redirect href="/onboarding/who" />;
  const { mode } = derived;

  const editing = !!params.edit && isInterviewStep(params.step);
  const current: InterviewStep | undefined = editing
    ? (params.step as InterviewStep)
    : INTERVIEW_STEPS.find((step) => !s.completedSteps.includes(step));
  const history = editing ? [] : INTERVIEW_STEPS.filter((step) => s.completedSteps.includes(step));
  const allDone = !editing && !current;
  const stepNumber = STEP_NUMBER[current ?? 'body'];
  const canType = allowsFreeText(mode) && !!current;
  const complete = current ? isStepComplete(current, s) : true;

  const question = (step: InterviewStep) =>
    t(
      step === 'body' && mode === 'child'
        ? 'chat.questions.bodyChild'
        : // Teens have no height or weight fields (QA R4 P2).
          step === 'body' && mode === 'teen'
          ? 'chat.questions.bodyTeen'
          : `chat.questions.${step}`,
    );

  const finishStep = (step: InterviewStep) => {
    s.completeStep(step);
    if (editing) {
      router.back();
      return;
    }
    if (step === 'body') {
      track('chat_completed', { mode });
      router.push('/onboarding/safety');
    }
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const send = async () => {
    const text = draft.trim().slice(0, MAX_USER_TEXT);
    if (!text || !current || busy || mode === 'child') return;
    setBusy(true);
    setDraft('');
    const locale = (SUPPORTED_LOCALES as readonly string[]).includes(i18n.language)
      ? (i18n.language as SupportedLocale)
      : 'en';
    const birth =
      s.birthYear && s.birthMonth ? { year: s.birthYear, month: s.birthMonth } : undefined;
    const result = await interpretAnswer(current, text, { locale, mode, birth });
    if (result.unavailable) setCoachOff(true);
    const answer = { ...result.answer };
    if (answer.mainGoals) {
      const allowed = visibleMainGoals(mode);
      answer.mainGoals = answer.mainGoals.filter((g) => allowed.includes(g));
    }
    const understood = Object.values(answer).some((v) => v !== undefined);
    s.applyAnswer(current, answer);
    s.setChatTurn(current, {
      userText: text,
      reply:
        result.reply ??
        // Coach not reached: say so instead of blaming the answer (QA P2).
        t(
          understood
            ? 'chat.understood'
            : result.source === 'none'
              ? 'chat.offline'
              : 'chat.notUnderstood',
        ),
    });
    setBusy(false);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const title = t('chat.title');
  const eyebrow = t('onboarding.step', { current: stepNumber, total: TOTAL_STEPS });

  return (
    <Screen
      scroll={false}
      header={
        <View style={styles.headerWrap}>
          <Header onBack={() => router.back()} title={title} eyebrow={eyebrow} />
          <View style={styles.progress}>
            <StepProgress
              current={stepNumber}
              total={TOTAL_STEPS}
              accessibilityLabel={t('onboarding.progress', {
                current: stepNumber,
                total: TOTAL_STEPS,
              })}
            />
          </View>
        </View>
      }
      footer={
        <>
          {current === 'body' || allDone ? (
            <Button
              variant="accent"
              label={editing ? t('chat.saveEdit') : t('chat.next')}
              disabled={!complete}
              onPress={() => (allDone ? router.push('/onboarding/safety') : finishStep('body'))}
            />
          ) : null}
          {canType ? (
            <View style={styles.inputBar}>
              <TextInput
                accessibilityLabel={t('chat.inputLabel')}
                placeholder={t('chat.inputPlaceholder')}
                placeholderTextColor={colors.muted}
                // The keyboard follows the theme (theme v2).
                keyboardAppearance={scheme}
                value={draft}
                onChangeText={setDraft}
                maxLength={MAX_USER_TEXT}
                onSubmitEditing={() => void send()}
                returnKeyType="send"
                editable={!busy}
                style={styles.input}
              />
              <IconButton
                icon="send"
                variant="filled"
                accessibilityLabel={t('chat.send')}
                onPress={() => void send()}
                disabled={busy || !draft.trim()}
              />
            </View>
          ) : current && mode === 'child' ? (
            <AppText variant="caption" color={colors.muted} style={styles.center}>
              {t('chat.guidedOnly')}
            </AppText>
          ) : null}
        </>
      }
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.thread}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {coachOff ? <Notice>{t('chat.coachUnavailable')}</Notice> : null}
        {history.map((step) => {
          const ack = coachAck(t, step, s);
          return (
            <View key={step} style={styles.turn}>
              <CoachMessage text={question(step)} />
              <UserMessage text={s.chat[step]?.userText ?? answerSummary(t, step, s)} />
              {ack ? <CoachMessage text={ack} /> : null}
            </View>
          );
        })}

        {current ? (
          <View style={styles.turn}>
            <CoachMessage text={question(current)} />
            {s.chat[current]?.userText ? <UserMessage text={s.chat[current]!.userText!} /> : null}
            {s.chat[current]?.reply ? <CoachMessage text={s.chat[current]!.reply} /> : null}
            {busy ? (
              <View style={styles.thinking} accessibilityLiveRegion="polite">
                <ActivityIndicator color={colors.muted} />
                <AppText variant="caption" color={colors.muted}>
                  {t('chat.thinking')}
                </AppText>
              </View>
            ) : null}
            <StepControls step={current} mode={mode} />
            {current !== 'body' ? (
              <Button
                label={editing ? t('chat.saveEdit') : t('chat.done')}
                disabled={!complete}
                onPress={() => finishStep(current)}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  headerWrap: { gap: spacing.sm },
  progress: { paddingHorizontal: spacing.xl },
  thread: { gap: spacing.xl, paddingBottom: spacing.lg, paddingTop: spacing.sm },
  turn: { gap: spacing.md },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  input: {
    flex: 1,
    minHeight: sizes.touchTarget + 4,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.ink,
  },
  center: { textAlign: 'center' },
}));
