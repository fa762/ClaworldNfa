import { getShelterName } from '@/lib/shelter';

export function ShelterTag({ shelter }: { shelter: number }) {
  return (
    <span className="inline-block text-xs px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
      {getShelterName(shelter)}
    </span>
  );
}
