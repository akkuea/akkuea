'use client';

import { motion } from 'framer-motion';
import { Wallet, Search, ShoppingCart, TrendingUp } from 'lucide-react';

const steps = [
  {
    icon: Wallet,
    step: '01',
    title: 'Connect Wallet',
    description: 'Link your Stellar wallet and complete KYC verification to unlock the platform.',
    command: '> connect --wallet stellar',
  },
  {
    icon: Search,
    step: '02',
    title: 'Browse Properties',
    description: 'Explore tokenized properties across Latin America and Africa with full transparency.',
    command: '> search --region LATAM,AFRICA',
  },
  {
    icon: ShoppingCart,
    step: '03',
    title: 'Invest',
    description: 'Purchase fractional ownership tokens with stablecoins. Receive NFT certificates.',
    command: '> buy --shares 100 --asset USDC',
  },
  {
    icon: TrendingUp,
    step: '04',
    title: 'Earn Returns',
    description: 'Collect rental income, benefit from appreciation, or use as DeFi collateral.',
    command: '> yield --claim all',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export function HowItWorks() {
  return (
    <section className="py-24 bg-black relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 grid-pattern opacity-20" />

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
              Getting Started
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
            How It Works
          </h2>
          <p className="text-sm text-neutral-500 max-w-md">
            Start investing in tokenized real estate in four simple steps
          </p>
        </motion.div>

        {/* Steps */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative"
        >
          {/* Connection line */}
          <div className="absolute left-[23px] top-0 bottom-0 w-px bg-gradient-to-b from-[#262626] via-[#404040] to-[#262626] hidden md:block" />

          <div className="space-y-6">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                variants={itemVariants}
                className="group relative flex gap-6"
              >
                {/* Step indicator */}
                <div className="relative z-10 flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-[#0a0a0a] border border-[#262626] flex items-center justify-center group-hover:border-[#ff3e00] transition-colors">
                    <step.icon className="w-5 h-5 text-neutral-500 group-hover:text-[#ff3e00] transition-colors" />
                  </div>
                  {/* Pulse on hover */}
                  <div className="absolute inset-0 rounded-lg bg-[#ff3e00]/20 opacity-0 group-hover:opacity-100 group-hover:animate-ping pointer-events-none" />
                </div>

                {/* Content */}
                <div className="flex-1 pb-8 border-b border-[#1a1a1a] group-last:border-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-mono text-[#ff3e00]">[{step.step}]</span>
                    <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                  </div>
                  <p className="text-sm text-neutral-500 mb-3 max-w-md">
                    {step.description}
                  </p>
                  {/* Terminal command */}
                  <div className="inline-flex items-center px-3 py-1.5 bg-[#0a0a0a] border border-[#262626] rounded-md">
                    <code className="text-xs font-mono text-neutral-400">
                      {step.command}
                      <span className="animate-blink ml-0.5">_</span>
                    </code>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Bottom CTA hint */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="mt-16 flex items-center justify-center"
        >
          <div className="flex items-center gap-4 px-6 py-3 bg-[#0a0a0a] border border-[#262626] rounded-lg">
            <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse-subtle" />
            <span className="text-xs font-mono text-neutral-500">
              Ready to start? Connect your wallet above.
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
