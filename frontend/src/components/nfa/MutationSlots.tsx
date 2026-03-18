const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

interface MutationSlotsProps {
  mutation1: string;
  mutation2: string;
}

export function MutationSlots({ mutation1, mutation2 }: MutationSlotsProps) {
  const slots = [
    { label: '变异槽 I', active: mutation1 !== ZERO_BYTES32 },
    { label: '变异槽 II', active: mutation2 !== ZERO_BYTES32 },
  ];

  return (
    <div className="flex gap-4 text-xs">
      {slots.map((slot) => (
        <span key={slot.label} className={slot.active ? 'text-crt-green glow' : 'term-darkest'}>
          [{slot.active ? '■' : '□'}] {slot.label}: {slot.active ? '已激活' : '未解锁'}
        </span>
      ))}
    </div>
  );
}
