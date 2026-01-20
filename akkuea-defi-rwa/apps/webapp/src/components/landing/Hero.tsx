'use client';

import { motion, useMotionValue, useTransform } from 'framer-motion';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';

const ASCII_ART = `
    ╔═══════════════════════════════╗
    ║   ▄▀▀▄ ▄▀▀▄ █  █ █ █ █▀▀ ▄▀▀▄  ║
    ║   █▄▄█ █  █ █▀▀█ █ █ █▀▀ █▄▄█  ║
    ║   █  █ ▀▄▄▀ █  █ ▀▄█ █▄▄ █  █  ║
    ╚═══════════════════════════════╝
`;

const GRID_CHARS = ['·', '+', '×', '○', '□'];

function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-20">
      <div className="grid-pattern absolute inset-0" />
      {/* Floating grid elements */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute top-1/4 right-1/4 text-[200px] font-mono text-neutral-800 select-none"
      >
        +
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 5, repeat: Infinity, delay: 1 }}
        className="absolute bottom-1/3 left-1/5 text-[150px] font-mono text-neutral-800 select-none"
      >
        ×
      </motion.div>
    </div>
  );
}

function TypewriterText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [displayText, setDisplayText] = useState('');
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      let index = 0;
      const interval = setInterval(() => {
        if (index <= text.length) {
          setDisplayText(text.slice(0, index));
          index++;
        } else {
          clearInterval(interval);
          setTimeout(() => setShowCursor(false), 1000);
        }
      }, 50);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text, delay]);

  return (
    <span className="font-mono">
      {displayText}
      {showCursor && <span className="animate-blink">_</span>}
    </span>
  );
}

function MarqueeText() {
  const items = [
    'REAL ESTATE',
    'TOKENIZATION',
    'DEFI',
    'STELLAR',
    'BLOCKCHAIN',
    'FRACTIONAL',
    'OWNERSHIP',
    'EMERGING MARKETS',
  ];

  return (
    <div className="marquee border-y border-[#262626] py-3 bg-[#0a0a0a]">
      <div className="marquee-content">
        {items.map((item, i) => (
          <span key={i} className="mx-8 text-sm font-mono text-neutral-500 tracking-wider">
            {item}
            <span className="ml-8 text-[#ff3e00]">●</span>
          </span>
        ))}
      </div>
      <div className="marquee-content" aria-hidden>
        {items.map((item, i) => (
          <span key={i} className="mx-8 text-sm font-mono text-neutral-500 tracking-wider">
            {item}
            <span className="ml-8 text-[#ff3e00]">●</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  return (
    <section className="relative min-h-screen flex flex-col" onMouseMove={handleMouseMove}>
      <GridBackground />

      {/* Main Content */}
      <div className="relative flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-32">
        <div className="max-w-5xl mx-auto w-full">
          {/* Status Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 flex items-center justify-center sm:justify-start"
          >
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-[#0a0a0a] border border-[#262626] rounded-full">
              <span className="status-dot status-dot-pulse" />
              <span className="text-xs font-mono text-neutral-400 tracking-wider uppercase">
                Live on Stellar Mainnet
              </span>
            </div>
          </motion.div>

          {/* Main Headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-6"
          >
            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white leading-[0.9] tracking-tight">
              <span className="block">Real Estate.</span>
              <span className="block mt-2">
                <span className="text-neutral-500">Tokenized.</span>
              </span>
              <span className="block mt-2 text-[#ff3e00]">
                Democratized.
              </span>
            </h1>
          </motion.div>

          {/* ASCII Art Decoration */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="hidden md:block absolute top-32 right-8 lg:right-16"
          >
            <pre className="text-[10px] leading-tight font-mono text-neutral-700 select-none">
{`┌─────────────────────┐
│  ██████╗ ██╗    ██╗ │
│  ██╔══██╗██║    ██║ │
│  ██████╔╝██║ █╗ ██║ │
│  ██╔══██╗██║███╗██║ │
│  ██║  ██║╚███╔███╔╝ │
│  ╚═╝  ╚═╝ ╚══╝╚══╝  │
│     REAL WORLD      │
│      ASSETS         │
└─────────────────────┘`}
            </pre>
          </motion.div>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-lg text-neutral-400 max-w-xl mb-10 leading-relaxed"
          >
            Invest in premium real estate across Latin America and Africa.
            <br className="hidden sm:block" />
            <span className="text-neutral-500">Starting from </span>
            <span className="text-white font-mono">$100</span>
            <span className="text-neutral-500">. Powered by </span>
            <span className="text-white">Stellar</span>.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-start gap-4 mb-16"
          >
            <Link href="/marketplace">
              <Button
                size="lg"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Explore Properties
              </Button>
            </Link>
            <Link href="/tokenize">
              <Button
                variant="outline"
                size="lg"
                rightIcon={<ArrowUpRight className="w-4 h-4" />}
              >
                Tokenize Your Property
              </Button>
            </Link>
          </motion.div>

          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap items-center gap-8 sm:gap-12 border-t border-[#262626] pt-8"
          >
            {[
              { value: '$3B', label: 'Target AUM' },
              { value: '847+', label: 'Properties' },
              { value: '12.5K', label: 'Investors' },
            ].map((stat) => (
              <div key={stat.label} className="group cursor-default">
                <div className="text-2xl sm:text-3xl font-bold text-white font-mono tracking-tight group-hover:text-[#ff3e00] transition-colors">
                  {stat.value}
                </div>
                <div className="text-xs text-neutral-500 uppercase tracking-wider mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Marquee */}
      <MarqueeText />

      {/* Corner Decorations */}
      <div className="absolute bottom-8 left-8 text-xs font-mono text-neutral-600 hidden lg:block">
        <div>[001]</div>
        <div className="mt-1">AKKUEA_V1.0</div>
      </div>
      <div className="absolute bottom-8 right-8 text-xs font-mono text-neutral-600 hidden lg:block text-right">
        <div>SCROLL</div>
        <motion.div
          animate={{ y: [0, 4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="mt-1"
        >
          ↓
        </motion.div>
      </div>
    </section>
  );
}
