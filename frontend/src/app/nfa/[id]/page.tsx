import { NFADetail } from './NFADetail';

export const metadata = {
  title: 'NFA 详情 - Claw World',
  description: '查看龙虾 NFA 详细信息',
};

export default async function NFADetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NFADetail tokenId={id} />;
}
