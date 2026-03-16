import { Lock, Unlock, Dna } from 'lucide-react';

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
    <div className="flex gap-3">
      {slots.map((slot) => (
        <div
          key={slot.label}
          className={`flex-1 flex items-center gap-2.5 text-xs px-4 py-3 rounded-xl border transition-all ${
            slot.active
              ? 'border-abyss-orange/30 bg-abyss-orange/[0.06] text-abyss-orange animate-glow-pulse'
              : 'border-white/[0.06] bg-white/[0.02] text-gray-600'
          }`}
        >
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            slot.active ? 'bg-abyss-orange/15' : 'bg-white/[0.04]'
          }`}>
            {slot.active ? <Dna size={14} /> : <Lock size={12} />}
          </div>
          <div>
            <div className="font-medium">{slot.label}</div>
            <div className={`text-[10px] ${slot.active ? 'text-abyss-orange/70' : 'text-gray-700'}`}>
              {slot.active ? '已激活' : '未解锁'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
