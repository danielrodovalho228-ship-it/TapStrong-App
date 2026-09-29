import { useTranslation } from 'react-i18next';

import { Button, Header, Notice, Screen } from '@/components/ui';
import { backOrHome } from '@/lib/nav';

/** A minor opened the Family purchase link: no purchase, just back (Phase 21). */
export function FamilyAdultRequired() {
  const { t } = useTranslation();
  return (
    <Screen header={<Header onBack={backOrHome} title={t('billing.plans.family.name')} />}>
      <Notice tone="warning">{t('billing.familyAdultRequired')}</Notice>
      <Button variant="secondary" label={t('common.back')} onPress={backOrHome} />
    </Screen>
  );
}
