'use client';
import Image from 'next/image';
import React from 'react';

const HeroSection = () => {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="container mx-auto px-4 py-5 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl  font-bold text-gray-900 mb-6">
            Welcome to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500">
              Akkuea
            </span>
          </h1>

          {/* Tagline */}
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-800 mb-8">
            Learn Freely, Teach Freely, Earn Fairly.
          </h2>

          {/* Description */}
          <p className="text-lg md:text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
            Join us in building a decentralized hub of knowledge — where educators are rewarded,
            learners are empowered, and education becomes a collective journey.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 ">
            <button className="px-8 py-2 bg-[#5EEAD4] text-white font-semibold rounded hover:from-cyan-500 hover:to-teal-600 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
              Explore Akkuea
            </button>
            <button className="px-8 py-2 bg-white text-[#5EEAD4] font-semibold rounded border-2 border-cyan-200 hover:bg-cyan-50 hover:border-cyan-300 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
              Join the Community
            </button>
          </div>

          {/* Illustrations */}
          <div className="flex flex-col lg:flex-row items-center gap-5 justify-center">
            <div className="relative   h-60">
              <Image
                src={'/herosection2.png'}
                alt="Image"
                width={500}
                height={500}
                className="w-full h-full object-contain"
                sizes="(max-width: 1024px) 90vw, 40vw"
              />
            </div>

            <div className="relative  h-60">
              <Image
                src={'/herosection1.png'}
                alt="Image"
                width={500}
                height={500}
                className="w-full h-full object-contain"
                sizes="(max-width: 1024px) 90vw, 40vw"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
