import { HeroSection } from '@/components/home/HeroSection';
import { WorldStateDashboard } from '@/components/home/WorldStateDashboard';
import { CLWTokenInfo } from '@/components/home/CLWTokenInfo';

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
      <HeroSection />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <WorldStateDashboard />
        <CLWTokenInfo />
      </div>
    </div>
  );
}
