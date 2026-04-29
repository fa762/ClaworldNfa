import { redirect } from 'next/navigation';

export default function NFADetailPage() {
  redirect('/terminal?action=status');
}
