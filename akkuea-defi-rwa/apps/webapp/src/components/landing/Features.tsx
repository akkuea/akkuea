'use client';

import { motion } from 'framer-motion';
import {
  Blocks,
  Shield,
  Coins,
  Globe2,
  LineChart,
  Lock,
  Zap,
  Users,
  ArrowUpRight,
} from 'lucide-react';

const features = [
  {
    icon: Blocks,
    title: 'Fractional Ownership',
    description: 'Own premium real estate with investments starting at $100. NFT-based shares ensure transparent ownership.',
    tag: '001',
  },
  {
    icon: Shield,
    title: 'Institutional Security',
    description: 'Multi-sig wallets, hardware security modules, and comprehensive insurance protect your investments.',
    tag: '002',
  },
  {
    icon: Coins,
    title: 'DeFi Lending',
    description: 'Use tokenized real estate as collateral or earn yields by providing liquidity to lending pools.',
    tag: '003',
  },
  {
    icon: Globe2,
    title: 'Emerging Markets',
    description: 'Access high-growth real estate markets in Latin America and Africa.',
    tag: '004',
  },
  {
    icon: LineChart,
    title: 'Chainlink Oracles',
    description: 'Real-time property valuations powered by Chainlink oracles ensure accurate pricing.',
    tag: '005',
  },
  {
    icon: Lock,
    title: 'ZK Privacy',
    description: 'Zero-knowledge proofs verify eligibility without revealing sensitive details.',
    tag: '006',
  },
  {
    icon: Zap,
    title: 'Instant Settlement',
    description: 'Stellar blockchain enables near-instant transactions with fees under $0.01.',
    tag: '007',
  },
  {
    icon: Users,
    title: 'KYC Compliant',
    description: 'Fully compliant with regulatory requirements. Verified investors only.',
    tag: '008',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

function FeatureCard({
  icon: Icon,
  title,
  description,
  tag,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tag: string;
}) {
  return (
    <motion.div
      variants={itemVariants}
      className="group relative p-6 bg-[#0a0a0a] border border-[#262626] rounded-lg hover:border-[#404040] transition-all duration-300 cursor-pointer"
    >
      {/* Tag */}
      <div className="absolute top-4 right-4 text-[10px] font-mono text-neutral-600">
        [{tag}]
      </div>

      {/* Hover gradient */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      {/* Icon */}
      <div className="relative mb-4">
        <div className="w-10 h-10 rounded-md bg-[#1a1a1a] border border-[#262626] flex items-center justify-center group-hover:border-[#404040] transition-colors">
          <Icon className="w-5 h-5 text-neutral-400 group-hover:text-white transition-colors" />
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          {title}
          <ArrowUpRight className="w-3.5 h-3.5 text-neutral-600 opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-0.5 -translate-y-0 group-hover:-translate-y-0.5 transition-all" />
        </h3>
        <p className="text-xs text-neutral-500 leading-relaxed">{description}</p>
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#ff3e00] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
}

export function Features() {
  return (
    <section className="py-24 bg-black relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 dot-pattern opacity-30" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px w-8 bg-[#ff3e00]" />
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
              Why Choose Akkuea
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
            Built for the Future
            <br />
            <span className="text-neutral-500">of Finance</span>
          </h2>
          <p className="text-sm text-neutral-500 max-w-lg">
            Combining blockchain technology with real-world assets to create a transparent,
            efficient, and accessible investment platform.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </motion.div>

        {/* Bottom decoration */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-16 flex items-center justify-center gap-4 text-xs font-mono text-neutral-600"
        >
          <span>+</span>
          <span>SECURE</span>
          <span>×</span>
          <span>TRANSPARENT</span>
          <span>+</span>
          <span>EFFICIENT</span>
          <span>×</span>
        </motion.div>
      </div>
    </section>
  );
}
