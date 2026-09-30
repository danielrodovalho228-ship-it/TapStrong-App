import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LocalDate } from '@/lib/dates';
import { kvStorage } from '@/lib/storage';

import { CARD_DAYS, daysFrom, UNDO_DAYS } from './cycle';
import type { FocusPick } from './focus';
import type { Change, RenewResult } from './renew';
import type { MonthSummary } from './summary';

/**
 * The monthly cycle per profile (Daniel, Phase 26, G): which block was
 * reviewed, the pending choice, this month's plan (what the generator
 * prefers, leaves out and focuses on), the previous plan for "Undo" (7 days),
 * sharp-pain bans, and past months for Progress > Months.
 */
export type MonthChoice = 'continue' | 'repeat' | 'body' | 'auto';

export type MonthPlan = {
  /** First day of the month it applies to. */
  from: LocalDate;
  next: string[];
  avoid: string[];
  focus: string[];
};

export type MonthEntry = {
  id: string;
  blockNo: number;
  from: LocalDate;
  to: LocalDate;
  summary: MonthSummary;
  choice: MonthChoice | null;
  changes: Change[];
  focus: FocusPick[];
  undoUntil: string | null;
  createdAt: string;
};

/** What the "Your next month" card offers, computed when the block closes. */
export type MonthOffer = {
  entryId: string;
  recommended: RenewResult;
  repeat: RenewResult;
  focus: FocusPick[];
};

export type MonthData = {
  reviewedFrom: LocalDate | null;
  offer: MonthOffer | null;
  /** The skipped summary stays on Home until then. */
  cardUntil: string | null;
  /** The light "Shall we pick it up again?" card (fewer than 4 workouts). */
  resumeUntil: string | null;
  plan: MonthPlan | null;
  previousPlan: MonthPlan | null;
  banned: string[];
  history: MonthEntry[];
  /** "Renewed N exercises · Undo" after an automatic choice. */
  autoNotice: { count: number; until: string } | null;
};

type State = MonthData & {
  openMonth: (entry: MonthEntry, offer: Omit<MonthOffer, 'entryId'>, now: Date) => void;
  markResume: (from: LocalDate, now: Date) => void;
  choose: (choice: MonthChoice, now: Date, focus?: string[]) => MonthPlan | null;
  undo: (now: Date) => boolean;
  dismissCard: () => void;
  dismissAutoNotice: () => void;
  reset: () => void;
};

export const MAX_MONTHS = 24;

export const initialMonth = (): MonthData => ({
  reviewedFrom: null,
  offer: null,
  cardUntil: null,
  resumeUntil: null,
  plan: null,
  previousPlan: null,
  banned: [],
  history: [],
  autoNotice: null,
});

/** The plan a choice gives. "Body" keeps the recommended moves with the person's own focus. */
export function planFor(
  offer: MonthOffer,
  choice: MonthChoice,
  from: LocalDate,
  focus?: string[],
): MonthPlan {
  const r = choice === 'repeat' ? offer.repeat : offer.recommended;
  return {
    from,
    next: r.next,
    avoid: r.avoid,
    focus: choice === 'repeat' ? [] : (focus ?? offer.focus.map((f) => f.muscle)),
  };
}

export const useMonthStore = create<State>()(
  persist(
    (set, get) => ({
      ...initialMonth(),
      openMonth: (entry, offer, now) =>
        set((s) => ({
          reviewedFrom: entry.from,
          offer: { ...offer, entryId: entry.id },
          cardUntil: daysFrom(now, CARD_DAYS),
          resumeUntil: null,
          history: [entry, ...s.history.filter((h) => h.id !== entry.id)].slice(0, MAX_MONTHS),
        })),
      markResume: (from, now) =>
        set({
          reviewedFrom: from,
          resumeUntil: daysFrom(now, CARD_DAYS),
          offer: null,
          cardUntil: null,
        }),
      choose: (choice, now, focus) => {
        const s = get();
        if (!s.offer) return null;
        const entry = s.history.find((h) => h.id === s.offer!.entryId);
        const plan = planFor(s.offer, choice, entry?.to ?? s.reviewedFrom ?? '', focus);
        const result = choice === 'repeat' ? s.offer.repeat : s.offer.recommended;
        const undoUntil = daysFrom(now, UNDO_DAYS);
        set({
          plan,
          previousPlan: s.plan,
          banned: [...new Set([...s.banned, ...result.banned])],
          offer: null,
          cardUntil: null,
          history: s.history.map((h) =>
            h.id === s.offer!.entryId
              ? {
                  ...h,
                  choice,
                  changes: choice === 'repeat' ? [] : result.changes,
                  focus:
                    choice === 'repeat'
                      ? []
                      : focus
                        ? focus.map((muscle) => ({ muscle, reason: 'lowGoal' as const }))
                        : s.offer!.focus,
                  undoUntil,
                }
              : h,
          ),
          autoNotice:
            choice === 'auto'
              ? { count: result.changes.filter((c) => c.to).length, until: undoUntil }
              : null,
        });
        return plan;
      },
      undo: (now) => {
        const s = get();
        const entry = s.history.find((h) => h.choice && h.undoUntil);
        if (!entry?.undoUntil || now.getTime() >= Date.parse(entry.undoUntil)) return false;
        set({
          plan: s.previousPlan,
          previousPlan: null,
          autoNotice: null,
          history: s.history.map((h) =>
            h.id === entry.id ? { ...h, choice: null, changes: [], undoUntil: null } : h,
          ),
        });
        return true;
      },
      dismissCard: () => set({ cardUntil: null, resumeUntil: null }),
      dismissAutoNotice: () => set({ autoNotice: null }),
      reset: () => set(initialMonth()),
    }),
    {
      name: 'month',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({
        reviewedFrom,
        offer,
        cardUntil,
        resumeUntil,
        plan,
        previousPlan,
        banned,
        history,
        autoNotice,
      }) => ({
        reviewedFrom,
        offer,
        cardUntil,
        resumeUntil,
        plan,
        previousPlan,
        banned,
        history,
        autoNotice,
      }),
    },
  ),
);

/** The generator inputs for this month (preferred, left out, banned, focus). */
export function monthInputs(data: Pick<MonthData, 'plan' | 'banned'>) {
  return {
    preferred: data.plan?.next ?? [],
    avoid: data.plan?.avoid ?? [],
    banned: data.banned,
    focusMuscles: data.plan?.focus ?? [],
  };
}
