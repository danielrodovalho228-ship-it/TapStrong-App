import { Platform } from 'react-native';

import { clock } from '@/lib/clock';
import { uuid } from '@/lib/uuid';

import type { Pose, ProgressPhoto } from './store';

/**
 * Before/after photos (SPEC §2.4): adults only, stored ON THIS PHONE only,
 * in the app's private documents folder. Never uploaded, never synced, not
 * part of backups the app controls.
 */
const FOLDER = 'progress-photos';

type FS = typeof import('expo-file-system');

function fs(): FS | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-file-system') as FS;
  } catch {
    return null;
  }
}

export type TakeResult =
  { status: 'ok'; photo: ProgressPhoto } | { status: 'cancelled' | 'denied' | 'unavailable' };

export async function takePhoto(pose: Pose): Promise<TakeResult> {
  const files = fs();
  if (!files) return { status: 'unavailable' };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const picker = require('expo-image-picker') as typeof import('expo-image-picker');
  const permission = await picker.requestCameraPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  const shot = await picker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (shot.canceled || !shot.assets[0]) return { status: 'cancelled' };

  const dir = new files.Directory(files.Paths.document, FOLDER);
  dir.create({ idempotent: true, intermediates: true });
  const id = uuid();
  const target = new files.File(dir, `${id}.jpg`);
  await new files.File(shot.assets[0].uri).copy(target);
  return { status: 'ok', photo: { id, pose, uri: target.uri, takenAt: clock.now().toISOString() } };
}

export function deletePhotoFile(uri: string) {
  const files = fs();
  if (!files) return;
  try {
    const f = new files.File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone.
  }
}

/** Account deletion / "delete my data": removes every progress photo. */
export function deleteAllPhotos() {
  const files = fs();
  if (!files) return;
  try {
    const dir = new files.Directory(files.Paths.document, FOLDER);
    if (dir.exists) dir.delete();
  } catch {
    // Nothing to delete.
  }
}
