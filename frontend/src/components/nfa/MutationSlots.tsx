const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

interface MutationSlotsProps {
  mutation1: string;
  mutation2: string;
}

export function MutationSlots({ mutation1, mutation2 }: MutationSlotsProps) {
  const slots = [
    { label: '变异槽 1', active: mutation1 !== ZERO_BYTES32 },
    { label: '变异槽 2', active: mutation2 !== ZERO_BYTES32 },
  ];

  return (
    <div className="flex gap-3">
      {slots.map((slot) => (
        <div
          key={slot.label}
          className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${
            slot.active
              ? 'border-abyss-orange/50 bg-abyss-orange/10 text-abyss-orange glow-orange'
              : 'border-white/10 bg-card-dark text-gray-600'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${slot.active ? 'bg-abyss-orange' : 'bg-gray-700'}`} />
          {slot.label}: {slot.active ? '已解锁' : '未解锁'}
        </div>
      ))}
    </div>
  );
}
