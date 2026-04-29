import { redirect } from 'next/navigation';

export default function NFACollectionPage() {
  redirect('/terminal?action=status');
}
