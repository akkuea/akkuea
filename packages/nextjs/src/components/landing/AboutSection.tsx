'use client';
import React from 'react';
import { Blocks, Brain, Globe, Users } from 'lucide-react';
import FeatureCard from './FeatureCard';

const AboutSection = () => {
  const features = [
    {
      title: 'Decentralized & Fair',
      description:
        'Powered by Stellar blockchain to ensure transparency, security, and fair rewards for educators.',
      icon: Blocks,
    },
    {
      title: 'AI-Powered Knowledge',
      description:
        'Intelligent indexing and personalized recommendations make learning efficient and accessible.',
      icon: Brain,
    },
    {
      title: 'Global Access',
      description: 'Breaking barriers: open resources for everyone, everywhere.',
      icon: Globe,
    },
    {
      title: 'Community-Driven',
      description:
        'Learners, creators, and validators work together to build a collective future of education.',
      icon: Users,
    },
  ];

  return (
    <section className="py-20 px-6 md:px-16 lg:px-32 dark:bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Desktop: Two columns layout */}
        <div className="hidden xl:grid xl:grid-cols-2 xl:gap-12 xl:items-center">
          {/* Left copy block */}
          <div className="flex flex-col gap-6">
            <h2 className="text-4xl font-bold text-about-text dark:text-foreground leading-tight">
              We Are <span className="text-transparent bg-clip-text bg-primary">Akkuea</span> — The
              Future of Decentralized Education.
            </h2>

            <p className="text-lg font-normal text-about-textWord dark:text-muted leading-relaxed">
              Akkuea is a decentralized educational platform built on Stellar, designed to organize
              global knowledge with the power of AI and community collaboration. Our mission is to
              empower educators, reward contributions fairly, and give learners access to trusted,
              verified, and open resources.{' '}
            </p>

            <div className="pt-1">
              <button className="px-8 py-3 text-sm bg-[#5EEAD4] dark:bg-primary text-white dark:text-primary-foreground font-medium rounded-lg hover:bg-[#4DD4C1] dark:hover:bg-primary/90 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
                Learn More
              </button>
            </div>
          </div>

          {/* Right feature cards in 2x2 grid */}
          <div className="grid grid-cols-2 gap-6 justify-items-center">
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                title={feature.title}
                description={feature.description}
                icon={feature.icon}
              />
            ))}
          </div>
        </div>

        {/* Tablet: Copy on top, cards below in 2x2 */}
        <div className="hidden md:block xl:hidden">
          <div className="flex flex-col gap-12">
            {/* Copy block */}
            <div className="flex flex-col gap-6">
              <h2 className="text-4xl font-bold text-about-text dark:text-foreground leading-tight">
                We Are <span className="text-transparent bg-clip-text bg-primary">Akkuea</span> —
                The Future of Decentralized Education.
              </h2>

              <p className="text-lg font-normal text-about-textWord dark:text-muted leading-relaxed">
                Akkuea is a decentralized educational platform built on Stellar, designed to
                organize global knowledge with the power of AI and community collaboration. Our
                mission is to empower educators, reward contributions fairly, and give learners
                access to trusted, verified, and open resources.
              </p>

              <div className="pt-1">
                <button className="px-8 py-3 text-sm bg-[#5EEAD4] dark:bg-primary text-white dark:text-primary-foreground font-medium rounded-lg hover:bg-[#4DD4C1] dark:hover:bg-primary/90 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
                  Learn More
                </button>
              </div>
            </div>

            {/* Cards in 2x2 grid */}
            <div className="grid grid-cols-2 gap-6 justify-items-center">
              {features.map((feature, index) => (
                <FeatureCard
                  key={index}
                  title={feature.title}
                  description={feature.description}
                  icon={feature.icon}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: Vertical stack */}
        <div className="block md:hidden">
          <div className="flex flex-col gap-8">
            {/* Copy block */}
            <div className="flex flex-col gap-6">
              <h2 className="text-3xl font-bold text-about-text dark:text-foreground leading-tight">
                We Are <span className="text-transparent bg-clip-text bg-primary">Akkuea</span> —
                The Future of Decentralized Education.
              </h2>

              <p className="text-base font-normal text-about-textWord dark:text-muted leading-relaxed">
                Akkuea is a decentralized educational platform built on Stellar, designed to
                organize global knowledge with the power of AI and community collaboration. Our
                mission is to empower educators, reward contributions fairly, and give learners
                access to trusted, verified, and open resources.
              </p>

              <div className="pt-1">
                <button className="px-8 py-3 text-sm bg-[#5EEAD4] dark:bg-primary text-white dark:text-primary-foreground font-medium rounded-lg hover:bg-[#4DD4C1] dark:hover:bg-primary/90 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
                  Learn More
                </button>
              </div>
            </div>

            {/* Cards in single column */}
            <div className="grid grid-cols-1 gap-6 justify-items-center">
              {features.map((feature, index) => (
                <FeatureCard
                  key={index}
                  title={feature.title}
                  description={feature.description}
                  icon={feature.icon}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
