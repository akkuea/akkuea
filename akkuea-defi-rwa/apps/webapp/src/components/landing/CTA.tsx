"use client";

import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Shield, Lock, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

const features = [
  { icon: Shield, label: "Bank-grade security" },
  { icon: Lock, label: "Regulatory compliant" },
  { icon: Zap, label: "Instant settlements" },
];

export function CTA() {
  return (
    <section className="py-24 bg-[#0a0a0a] relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 grid-pattern opacity-10" />

      {/* Accent glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#ff3e00]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative"
        >
          {/* Main card */}
          <div className="relative p-8 sm:p-12 bg-black border border-[#262626] rounded-2xl overflow-hidden">
            {/* Corner decorations */}
            <div className="absolute top-0 left-0 w-16 h-16 border-l border-t border-[#ff3e00]/30" />
            <div className="absolute top-0 right-0 w-16 h-16 border-r border-t border-[#ff3e00]/30" />
            <div className="absolute bottom-0 left-0 w-16 h-16 border-l border-b border-[#ff3e00]/30" />
            <div className="absolute bottom-0 right-0 w-16 h-16 border-r border-b border-[#ff3e00]/30" />

            {/* Content */}
            <div className="relative text-center">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-[#262626] rounded-full mb-8"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                  Platform Live
                </span>
              </motion.div>

              {/* Headline */}
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
                Ready to Build Your
                <br />
                <span className="text-[#ff3e00]">Real Estate Portfolio?</span>
              </h2>

              {/* Description */}
              <p className="text-neutral-400 max-w-lg mx-auto mb-8 text-sm sm:text-base">
                Join thousands of investors already earning yields from
                tokenized properties. Start with as little as $100 and diversify
                globally.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
                <Link href="/marketplace">
                  <Button
                    size="lg"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Start Investing Now
                  </Button>
                </Link>
                <Link href="/tokenize">
                  <Button
                    variant="outline"
                    size="lg"
                    rightIcon={<ArrowUpRight className="w-4 h-4" />}
                  >
                    List Your Property
                  </Button>
                </Link>
              </div>

              {/* Trust features */}
              <div className="flex flex-wrap items-center justify-center gap-6">
                {features.map((feature) => (
                  <div
                    key={feature.label}
                    className="flex items-center gap-2 text-xs text-neutral-500"
                  >
                    <feature.icon className="w-3.5 h-3.5 text-neutral-600" />
                    <span>{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom decoration */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-[#ff3e00]/50 to-transparent" />
          </div>

          {/* ASCII decoration below */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-8 text-center"
          >
            <pre className="inline-block text-[8px] font-mono text-neutral-800 select-none leading-tight">
              {`    ╔══════════════════════════════════════════════════════════╗
    ║  ▄▀▀▄ █ █ █ █ █  █ █▀▀ ▄▀▀▄   █▀▀▄ █▀▀ █▀▀ ▀█▀   █▀▀▄ █  █ ▄▀▀▄ ║
    ║  █▄▄█ █▀▄ █▀▄ █  █ █▀▀ █▄▄█   █  █ █▀▀ █▀▀  █    █▄▄▀ █  █ █▄▄█ ║
    ║  █  █ █ █ █ █ ▀▄▄▀ █▄▄ █  █   █▄▄▀ █▄▄ █   ▄█▄   █  █ ▀▄▄▀ █  █ ║
    ╚══════════════════════════════════════════════════════════╝`}
            </pre>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
