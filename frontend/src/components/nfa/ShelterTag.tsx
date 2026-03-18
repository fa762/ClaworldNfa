import { getShelterName } from '@/lib/shelter';

export function ShelterTag({ shelter }: { shelter: number }) {
  return (
    <span className="term-dim">[{getShelterName(shelter)}]</span>
  );
}
