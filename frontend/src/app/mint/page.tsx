import { redirect } from 'next/navigation';

export default function MintPage() {
  redirect('/?action=mint');
}
