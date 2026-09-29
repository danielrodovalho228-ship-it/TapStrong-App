import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Notice } from '@/components/ui';
import { handOwnerPass } from '@/features/family/OwnerOnly';

/**
 * The account is on the Family plan and a minor's profile is active (QA
 * R9-04): no plan picker and no buy button — switching from here would
 * downgrade the whole family. Only "Manage", which the owner controls.
 */
export function FamilyPlanOn() {
  const { t } = useTranslation();
  return (
    <>
      <Notice tone="neutral">{t('billing.familyOn')}</Notice>
      <Button
        label={t('billing.manage')}
        onPress={() => {
          // The PIN was just entered for this screen: Billing doesn't ask again.
          handOwnerPass();
          router.push('/billing');
        }}
      />
    </>
  );
}
