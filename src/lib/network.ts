/**
 * supabase-js returns network failures as error objects instead of throwing
 * (QA R3-02), so a `catch` alone never sees "offline". This tells a network
 * failure apart from a real server answer:
 *  - auth: AuthRetryableFetchError with status 0;
 *  - database: status 0 and a fetch TypeError message.
 */
type MaybeError = { name?: string; message?: string; status?: number; code?: string } | null;

const FETCH_FAILURE =
  /failed to fetch|network request failed|networkerror|fetch failed|load failed/i;

export function isNetworkError(error: unknown, responseStatus?: number): boolean {
  if (!error) return false;
  const e = error as MaybeError;
  if (e?.name === 'AuthRetryableFetchError') return true;
  if (e?.status === 0 || responseStatus === 0) return true;
  return FETCH_FAILURE.test(e?.message ?? '');
}
