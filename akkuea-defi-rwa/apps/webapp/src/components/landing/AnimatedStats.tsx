"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { TrendingUp, Building, Users, DollarSign } from "lucide-react";

interface StatProps {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  suffix: string;
  prefix?: string;
  label: string;
  decimals?: number;
  duration?: number;
}

function AnimatedCounter({
  value,
  suffix,
  prefix = "",
  decimals = 0,
  duration = 2,
}: {
  value: number;
  suffix: string;
  prefix?: string;
  decimals?: number;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!isInView) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(value * easeOutQuart);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isInView, value, duration]);

  return (
    <span ref={ref} className="font-mono tabular-nums">
      {prefix}
      {count.toFixed(decimals)}
      {suffix}
    </span>
  );
}

const stats: StatProps[] = [
  {
    icon: TrendingUp,
    value: 172,
    suffix: "%",
    label: "Platform Growth YoY",
    decimals: 0,
    duration: 2,
  },
  {
    icon: DollarSign,
    value: 3,
    suffix: "B",
    prefix: "$",
    label: "Target AUM by 2027",
    decimals: 0,
    duration: 1.5,
  },
  {
    icon: Building,
    value: 847,
    suffix: "+",
    label: "Properties Tokenized",
    decimals: 0,
    duration: 2.5,
  },
  {
    icon: Users,
    value: 12.5,
    suffix: "K",
    label: "Active Investors",
    decimals: 1,
    duration: 2,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
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

export function AnimatedStats() {
  return (
    <section className="py-20 bg-[#0a0a0a] border-y border-[#262626]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
              [METRICS]
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
            Driving the RWA Revolution
          </h2>
          <p className="text-sm text-neutral-500 max-w-md mx-auto">
            Real results from real estate tokenization in emerging markets
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              variants={itemVariants}
              className="group relative p-6 bg-black border border-[#262626] rounded-lg hover:border-[#404040] transition-all duration-300 cursor-default"
            >
              {/* Index */}
              <div className="absolute top-4 right-4 text-[10px] font-mono text-neutral-700">
                0{index + 1}
              </div>

              {/* Icon */}
              <div className="w-8 h-8 rounded-md bg-[#1a1a1a] border border-[#262626] flex items-center justify-center mb-4 group-hover:border-[#404040] transition-colors">
                <stat.icon className="w-4 h-4 text-neutral-500 group-hover:text-[#ff3e00] transition-colors" />
              </div>

              {/* Value */}
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1 tracking-tight">
                <AnimatedCounter
                  value={stat.value}
                  suffix={stat.suffix}
                  prefix={stat.prefix}
                  decimals={stat.decimals}
                  duration={stat.duration}
                />
              </div>

              {/* Label */}
              <div className="text-[11px] text-neutral-500 uppercase tracking-wider">
                {stat.label}
              </div>

              {/* Hover line */}
              <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-[#ff3e00] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.div>
          ))}
        </motion.div>

        {/* ASCII decoration */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-12 text-center"
        >
          <pre className="inline-block text-[10px] font-mono text-neutral-700 select-none">
            {`┌────────────────────────────────────────────┐
│  ████████╗ ██████╗ ██╗  ██╗███████╗███╗   ██╗██╗███████╗███████╗██████╗  │
│  ╚══██╔══╝██╔═══██╗██║ ██╔╝██╔════╝████╗  ██║██║╚══███╔╝██╔════╝██╔══██╗ │
│     ██║   ██║   ██║█████╔╝ █████╗  ██╔██╗ ██║██║  ███╔╝ █████╗  ██║  ██║ │
│     ██║   ██║   ██║██╔═██╗ ██╔══╝  ██║╚██╗██║██║ ███╔╝  ██╔══╝  ██║  ██║ │
│     ██║   ╚██████╔╝██║  ██╗███████╗██║ ╚████║██║███████╗███████╗██████╔╝ │
│     ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝╚══════╝╚══════╝╚═════╝  │
└────────────────────────────────────────────┘`}
          </pre>
        </motion.div>
      </div>
    </section>
  );
}
