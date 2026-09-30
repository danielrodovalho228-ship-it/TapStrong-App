import type { RefObject } from 'react';
import { Platform, Share, type View } from 'react-native';

import { track } from '@/lib/analytics';

import { FORMAT_PX, type ShareBackground, type ShareFormat, type ShareTemplate } from './types';

/**
 * Where a card goes (Phase 28, A4): Instagram Stories (straight in, with the
 * Facebook App ID from .env; without it the system share sheet), WhatsApp,
 * the photo gallery, the system sheet ("More…") and, for the transparent
 * sticker, the clipboard. Native modules load lazily so tests and the web
 * never pull them in.
 */
export type ShareTarget = 'instagram' | 'whatsapp' | 'save' | 'more' | 'copy';

/** The PNG at full size: 1080 × 1920 (Stories) or 1080 × 1350 (feed). */
export async function captureCard(
  ref: RefObject<View | null>,
  format: ShareFormat,
  result: 'tmpfile' | 'base64' = 'tmpfile',
): Promise<string> {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { captureRef } =
    require('react-native-view-shot') as typeof import('react-native-view-shot');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return captureRef(ref, { format: 'png', result, ...FORMAT_PX[format] });
}

export type ShareOutcome = 'done' | 'fallback' | 'cancelled' | 'failed';

/** Sends the captured card to a target. Falls back to the system sheet. */
export async function shareCard({
  ref,
  target,
  format,
  background,
  template,
  message,
}: {
  ref: RefObject<View | null>;
  target: ShareTarget;
  format: ShareFormat;
  background: ShareBackground;
  template: ShareTemplate;
  /** The short link, sent as text where the target takes it. */
  message?: string;
}): Promise<ShareOutcome> {
  // The web cannot capture a view: share the words instead (QA round 1).
  if (Platform.OS === 'web') {
    try {
      await Share.share({ message: message ?? '' });
      track('share_completed', { target: 'text', template });
      return 'fallback';
    } catch {
      return 'failed';
    }
  }
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    if (target === 'copy') {
      const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
      const base64 = await captureCard(ref, format, 'base64');
      await Clipboard.setImageAsync(base64);
    } else {
      const uri = await captureCard(ref, format);
      const file = uri.startsWith('file://') ? uri : `file://${uri}`;
      if (target === 'save') {
        const Media = require('expo-media-library') as typeof import('expo-media-library');
        const permission = await Media.requestPermissionsAsync(true);
        if (!permission.granted) return 'cancelled';
        await Media.saveToLibraryAsync(file);
      } else if (target === 'instagram' || target === 'whatsapp') {
        const RNShare = (require('react-native-share') as typeof import('react-native-share'))
          .default;
        const appId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
        if (target === 'instagram' && !appId) return sheet(file, template);
        try {
          if (target === 'instagram')
            await RNShare.shareSingle({
              social: RNShare.Social.INSTAGRAM_STORIES as never,
              appId: appId!,
              ...(background === 'transparent'
                ? { stickerImage: file }
                : { backgroundImage: file }),
            } as never);
          else
            await RNShare.shareSingle({
              social: RNShare.Social.WHATSAPP as never,
              url: file,
              type: 'image/png',
              message,
            });
        } catch {
          // The app isn't installed (or refused): the system sheet instead.
          return sheet(file, template);
        }
      } else {
        return sheet(file, template);
      }
    }
    /* eslint-enable @typescript-eslint/no-require-imports */
    track('share_completed', { target, template });
    return 'done';
  } catch {
    return 'failed';
  }
}

async function sheet(file: string, template: ShareTemplate): Promise<ShareOutcome> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) return 'failed';
  await Sharing.shareAsync(file, { mimeType: 'image/png' });
  track('share_completed', { target: 'more', template });
  return 'fallback';
}

/** The share buttons in order: 60+ get WhatsApp first (the family's channel). */
export function targetsFor(mode: string, background: ShareBackground): ShareTarget[] {
  const main: ShareTarget[] =
    mode === 'senior'
      ? ['whatsapp', 'instagram', 'save', 'more']
      : ['instagram', 'whatsapp', 'save', 'more'];
  return background === 'transparent' ? [...main, 'copy'] : main;
}
