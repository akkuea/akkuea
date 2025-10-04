import Benefits from '@/components/landing/Benefits';
import CommunitySection from '@/components/landing/CommunitySection';
import HeroSection from '@/components/landing/HeroSection';
import AboutSection from '@/components/landing/AboutSection';
import Roadmap from '@/components/landing/Roadmap';
export default function LandingPage() {
  return (
    <div>
      <HeroSection/>
      <AboutSection />
      <Benefits />
      <Roadmap />
      <CommunitySection />
    </div>
  );
}
