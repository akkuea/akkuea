import CommunitySection from '@/components/landing/CommunitySection';
import Benefits from '@/components/landing/Benefits';
import Roadmap from '@/components/landing/Roadmap';

export default function LandingPage() {
  return (
    <div>
      <Benefits />
      <Roadmap />
      <CommunitySection />
    </div>
  );
}
