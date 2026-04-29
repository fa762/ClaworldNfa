import { redirect } from 'next/navigation';

export default function ArenaPage() {
  redirect('/terminal?action=arena');
}
