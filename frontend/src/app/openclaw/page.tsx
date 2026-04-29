import { redirect } from 'next/navigation';

export default function OpenClawPage() {
  redirect('/terminal?action=memory');
}
