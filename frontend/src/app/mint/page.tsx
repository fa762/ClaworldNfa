import { redirect } from 'next/navigation';

export default function MintPage() {
  redirect('/terminal?action=mint');
}
