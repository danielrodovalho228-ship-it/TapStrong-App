import * as Haptics from 'expo-haptics';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { usePrefsStore } from '@/features/settings/store';

/**
 * How the app feels (Phase 27, B2): light haptics when a set is logged, a
 * little more when an exercise is complete, a success tap for a record
 * (adults only; the caller checks), and a soft tap per muscle as the map
 * lights up. Optional sounds, off by default: a "tic" per set and a short
 * chord at the end. Never during the rest countdown. A missing device never
 * interrupts the workout.
 */
const players: Partial<Record<'tic' | 'chord', AudioPlayer>> = {};

function haptic(run: () => Promise<void>) {
  if (!usePrefsStore.getState().haptics) return;
  try {
    void run().catch(() => undefined);
  } catch {
    // No haptics engine (web, simulator).
  }
}

function sound(name: 'tic' | 'chord') {
  if (!usePrefsStore.getState().celebrationSounds) return;
  try {
    const player =
      players[name] ??
      (players[name] = createAudioPlayer(
        name === 'tic'
          ? require('../../../assets/sounds/set-tic.wav')
          : require('../../../assets/sounds/workout-chord.wav'),
      ));
    void player.seekTo(0);
    player.play();
  } catch {
    // No audio device.
  }
}

export const feel = {
  /** A set is logged. */
  set() {
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    sound('tic');
  },
  /** The last set of an exercise is logged. */
  exercise() {
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  /** A new record (adults only). */
  record() {
    haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  /** One muscle lights up on the map. */
  light() {
    haptic(() => Haptics.selectionAsync());
  },
  /** The workout is done. */
  finish() {
    sound('chord');
  },
};
