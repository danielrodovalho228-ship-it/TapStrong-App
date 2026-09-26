import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { normalizeReferral, useAccountStore } from '@/features/account/store';

/**
 * Referral link: tapstrong://r/CODE (and https://tapstrong.app/r/CODE once
 * the domain is set up). The code is kept until the account is saved.
 */
export default function ReferralLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const update = useAccountStore((s) => s.update);
  const redeemed = useAccountStore((s) => s.referralRedeemed);
  const normalized = normalizeReferral(code);

  useEffect(() => {
    if (normalized && !redeemed) update({ pendingReferral: normalized });
  }, [normalized, redeemed, update]);

  return <Redirect href="/" />;
}
