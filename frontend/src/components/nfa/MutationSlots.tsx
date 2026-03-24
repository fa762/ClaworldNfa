'use client';

import { useI18n } from '@/lib/i18n';

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

interface MutationSlotsProps {
  mutation1: string;
  mutation2: string;
}

export function MutationSlots({ mutation1, mutation2 }: MutationSlotsProps) {
  const { t } = useI18n();
  const slots = [
    { labelKey: 'mutation.slot1', active: mutation1 !== ZERO_BYTES32 },
    { labelKey: 'mutation.slot2', active: mutation2 !== ZERO_BYTES32 },
  ];

  return (
    <div className="flex gap-4 text-xs">
      {slots.map((slot) => (
        <span key={slot.labelKey} className={slot.active ? 'text-crt-green glow' : 'term-darkest'}>
          [{slot.active ? '■' : '□'}] {t(slot.labelKey)}: {slot.active ? t('mutation.active') : t('mutation.locked')}
        </span>
      ))}
    </div>
  );
}
