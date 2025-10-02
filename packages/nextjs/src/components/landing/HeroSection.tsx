'use client';
import Image from 'next/image';
import React from 'react';
import { motion } from 'framer-motion';

const HeroSection = () => {
  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <div className="container mx-auto px-4 py-5 pt-14 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="text-center max-w-4xl mx-auto">
            {/* Main Heading */}
            <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6">
              Welcome to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500">
                Akkuea
              </span>
            </h1>

            {/* Tagline */}
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground/90 mb-8">
              Learn Freely, Teach Freely, Earn Fairly.
            </h2>

            {/* Description */}
            <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
              Join us in building a decentralized hub of knowledge — where educators are rewarded,
              learners are empowered, and education becomes a collective journey.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <button className="px-8 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/80 hover:shadow-primary/20 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
                Explore Akkuea
              </button>
              <button className="px-8 py-3 bg-secondary text-primary-foreground font-semibold rounded-lg border-2 border-border hover:bg-secondary/80 hover:border-primary/50 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
                Join the Community
              </button>
            </div>

            {/* Illustrations */}
            <div className="flex flex-col lg:flex-row items-center gap-5 justify-center">
              <div className="relative h-60">
                <Image
                  src={'/herosection2.png'}
                  alt="Educational platform illustration"
                  width={500}
                  height={500}
                  className="w-full h-full object-contain"
                  sizes="(max-width: 1024px) 90vw, 40vw"
                />
              </div>

              <div className="relative h-60">
                <Image
                  src={'/herosection1.png'}
                  alt="Learning community illustration"
                  width={500}
                  height={500}
                  className="w-full h-full object-contain"
                  sizes="(max-width: 1024px) 90vw, 40vw"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default HeroSection;
