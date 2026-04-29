import { redirect } from 'next/navigation';

export default function AutoPage() {
  redirect('/terminal?action=auto');
}
