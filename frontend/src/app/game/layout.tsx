// 游戏页面不能静态预渲染（依赖 Web3Modal + Phaser）
export const dynamic = 'force-dynamic';

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
