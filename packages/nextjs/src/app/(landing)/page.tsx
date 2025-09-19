import CommunitySection from '@/components/landing/CommunitySection';
import Benefits from '@/components/landing/Benefits';
import Roadmap from '@/components/landing/Roadmap';
import ResourceRating from "@/components/rating/Rating";

export default function LandingPage() {
  return (
    <div>
      <Benefits />
      <ResourceRating />
      <Roadmap />
      <CommunitySection />
    </div>
  );
}
