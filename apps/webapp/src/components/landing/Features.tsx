"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
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
} from "lucide-react";

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
        <p className="text-xs text-neutral-500 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#ff3e00] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
}

export function Features() {
  const t = useTranslations("Landing.Features");

  const features = [
    {
      icon: Blocks,
      title: t("items.fractional.title"),
      description: t("items.fractional.desc"),
      tag: "001",
    },
    {
      icon: Shield,
      title: t("items.security.title"),
      description: t("items.security.desc"),
      tag: "002",
    },
    {
      icon: Coins,
      title: t("items.defi.title"),
      description: t("items.defi.desc"),
      tag: "003",
    },
    {
      icon: Globe2,
      title: t("items.emerging.title"),
      description: t("items.emerging.desc"),
      tag: "004",
    },
    {
      icon: LineChart,
      title: t("items.oracles.title"),
      description: t("items.oracles.desc"),
      tag: "005",
    },
    {
      icon: Lock,
      title: t("items.zk.title"),
      description: t("items.zk.desc"),
      tag: "006",
    },
    {
      icon: Zap,
      title: t("items.settlement.title"),
      description: t("items.settlement.desc"),
      tag: "007",
    },
    {
      icon: Users,
      title: t("items.kyc.title"),
      description: t("items.kyc.desc"),
      tag: "008",
    },
  ];

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
              {t("whyChoose")}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
            {t("builtFor")}
            <br />
            <span className="text-neutral-500">{t("ofFinance")}</span>
          </h2>
          <p className="text-sm text-neutral-500 max-w-lg">
            {t("description")}
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
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
          <span>{t("secure")}</span>
          <span>×</span>
          <span>{t("transparent")}</span>
          <span>+</span>
          <span>{t("efficient")}</span>
          <span>×</span>
        </motion.div>
      </div>
    </section>
  );
}
