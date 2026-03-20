'use client';

import { useI18n } from '@/lib/i18n';

export function StatusBadge({ active }: { active: boolean }) {
  const { t } = useI18n();
  return (
    <span className={active ? 'status-alive' : 'status-dormant'}>
      {active ? t('status.alive') : t('status.dormant')}
    </span>
  );
}
