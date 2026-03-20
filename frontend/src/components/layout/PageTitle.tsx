'use client';

import { useI18n } from '@/lib/i18n';

export function PageTitle({ textKey }: { textKey: string }) {
  const { t } = useI18n();
  return (
    <div className="px-4 pt-3 pb-1 shrink-0">
      <span className="term-dim text-xs">&gt; </span>
      <span className="term-bright text-xs">{t(textKey)}</span>
    </div>
  );
}

export function NFAPageTitle() {
  const { t } = useI18n();
  return (
    <div className="mb-4">
      <span className="term-dim text-sm">&gt; </span>
      <span className="term-bright text-sm">{t('nfa.database')}</span>
      <span className="term-dim text-xs ml-2">{t('nfa.subtitle')}</span>
    </div>
  );
}
