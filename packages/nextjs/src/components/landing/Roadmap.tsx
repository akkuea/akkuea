'use client';

import { Bot, FlaskConical, Globe, Rocket, TestTube, Zap } from 'lucide-react';
import dynamic from 'next/dynamic';

// The Chrono component relies on browser-specific APIs and does not support server-side rendering (SSR).
// Therefore, we dynamically import it with SSR disabled to prevent rendering issues.
const Chrono = dynamic(() => import('react-chrono').then((mod) => mod.Chrono), { ssr: false });

import TimeLineCard from './TimeLineCard';

const roadmapTimeLineData = [
  {
    icon: Rocket,
    timelineTitle: 'Q1 2025 – Foundation 🚀',
    description:
      'Platform development begins. Brand design and first Figma prototypes. Initial Stellar testnet setup.',
  },
  {
    icon: Zap,
    timelineTitle: 'Q2 2025 – Core Development ⚡',
    description:
      'Development of base features: publishing, validation. Stellar rewards logic implementation. Internal testing phase.',
  },
  {
    icon: Globe,
    timelineTitle: 'Q3 2025 – Community & Ecosystem 🌍',
    description:
      'Community building and onboarding first educators. Incentive programs for content creators. First educational partnerships.',
  },
  {
    icon: Bot,
    timelineTitle: 'Q1 2026 – AI & Refinement 🤖',
    description:
      'Initial AI integration for content indexing. UX/UI improvements. Preparation for closed beta.',
  },
  {
    icon: FlaskConical,
    timelineTitle: 'Q2 2026 – Beta & Testing 🔬',
    description:
      'Closed Beta launch with selected users. Rewards adjustments based on feedback. Security, scalability, and performance testing.',
  },
  {
    icon: TestTube,
    timelineTitle: 'Q3 2026 – MVP Launch 🎉',
    description:
      'Official MVP release on Stellar mainnet. Public access to the platform. Active rewards for educators and validators. First steps towards DAO governance.',
  },
];

export default function Roadmap() {
  return (
    <section className="bg-[#F3F4F6] py-16 px-4">
      <div className="max-w-4xl mx-auto text-center space-y-2">
        <h2 className="text-3xl font-bold mb-4">
          <span className="text-primary">Akkuea</span> Roadmap
        </h2>
        <p className="text-gray-700 text-lg">
          From development in 2025 to the official MVP launch in 2026.
        </p>
      </div>
      <div className="mt-10 xl:max-w-6xl mx-auto">
        <Chrono
          theme={{
            primary: '#5EEAD4',
            secondary: '#F3F4F6',
          }}
          mode="VERTICAL_ALTERNATING"
          disableToolbar={true}
        >
          {roadmapTimeLineData.map((item, index) => (
            <TimeLineCard
              key={index}
              icon={item.icon}
              timelineTitle={item.timelineTitle}
              description={item.description}
            />
          ))}
        </Chrono>
      </div>
    </section>
  );
}
