'use client';

import { Bot, FlaskConical, Globe, Rocket, TestTube, Zap } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState, useEffect, useRef } from 'react';

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
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Optional: stop observing after it's visible once
        }
      },
      { threshold: 0.2 } // Trigger when 20% of the section is visible
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (sectionRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="bg-[#F3F4F6] dark:bg-background py-16 px-4 overflow-hidden"
    >
      <div
        className={`max-w-4xl mx-auto text-center space-y-2 transition-all duration-1000 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <h2 className="text-3xl font-bold mb-4 text-black dark:text-foreground">
          <span className="text-[#5EEAD4] dark:text-primary">Akkuea</span> Roadmap
        </h2>
        <p className="text-gray-700 dark:text-muted text-lg">
          From development in 2025 to the official MVP launch in 2026.
        </p>
      </div>
      <div
        className={`mt-10  xl:max-w-6xl mx-auto transition-all duration-1000 delay-300 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <Chrono
          theme={{
            primary: '#5EEAD4',
            secondary: '#F3F4F6',
          }}
          mode="VERTICAL_ALTERNATING"
          disableToolbar={true}
          slideItemDuration={3000}
          slideshow
          slideShowType="slide_from_sides"
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
