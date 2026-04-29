import { redirect } from 'next/navigation';

export default function CompanionPage() {
  redirect('/terminal?action=status');
}
