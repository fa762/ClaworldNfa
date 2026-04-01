export const dynamic = 'force-dynamic';

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-full min-h-0">{children}</div>;
}
