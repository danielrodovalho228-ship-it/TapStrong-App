import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { usePrefsStore } from '@/features/settings/store';

/**
 * Short chime when a timer ends (improvements v1, D4 "Sounds"). Our own
 * generated tone; mixes with the person's music and respects the silent switch.
 */
let player: AudioPlayer | null = null;

export function playTimerEnd() {
  if (!usePrefsStore.getState().sounds) return;
  try {
    if (!player) {
      void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });

      player = createAudioPlayer(require('../../../assets/sounds/timer-end.wav'));
    }
    void player.seekTo(0);
    player.play();
  } catch {
    // A missing audio device never interrupts the workout.
  }
}
