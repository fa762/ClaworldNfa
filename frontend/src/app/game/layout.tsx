// 游戏页面：跳过 CRT 终端包装，全屏渲染
export const dynamic = 'force-dynamic';

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen bg-black overflow-hidden">
      {children}
    </div>
  );
}
