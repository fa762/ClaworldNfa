import { getShelterName } from '@/lib/shelter';
import { MapPin } from 'lucide-react';

export function ShelterTag({ shelter }: { shelter: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white/[0.04] text-gray-400 border border-white/[0.06]">
      <MapPin size={10} className="text-gray-500" />
      {getShelterName(shelter)}
    </span>
  );
}
