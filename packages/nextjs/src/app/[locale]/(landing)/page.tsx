import CommunitySection from '@/components/landing/CommunitySection';
import Benefits from '@/components/landing/Benefits';
import HeroSection from '@/components/landing/HeroSection';
import AboutSection from '@/components/landing/AboutSection';
import Roadmap from '@/components/landing/Roadmap';
export default function LandingPage() {
  return (
    <div>
      <HeroSection />
      <AboutSection />
      <Benefits />
      <Roadmap />
      <CommunitySection />
    </div>
  );
}
