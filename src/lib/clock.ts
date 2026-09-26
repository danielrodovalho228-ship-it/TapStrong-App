/** Single source of "now", so tests can pin the date without fake timers. */
export const clock = {
  now: (): Date => new Date(),
};
