'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Building2, Github, Twitter, MessageCircle, Mail, ArrowUpRight } from 'lucide-react';

const footerLinks = {
  product: [
    { name: 'Marketplace', href: '/marketplace' },
    { name: 'Tokenize', href: '/tokenize' },
    { name: 'Lending', href: '/lending' },
    { name: 'Dashboard', href: '/dashboard' },
  ],
  resources: [
    { name: 'Documentation', href: '#' },
    { name: 'API Reference', href: '#' },
    { name: 'Whitepaper', href: '#' },
    { name: 'Blog', href: '#' },
  ],
  company: [
    { name: 'About', href: '#' },
    { name: 'Careers', href: '#' },
    { name: 'Press', href: '#' },
    { name: 'Contact', href: '#' },
  ],
  legal: [
    { name: 'Privacy', href: '#' },
    { name: 'Terms', href: '#' },
    { name: 'Cookies', href: '#' },
  ],
};

const socialLinks = [
  { name: 'Twitter', icon: Twitter, href: '#' },
  { name: 'GitHub', icon: Github, href: '#' },
  { name: 'Discord', icon: MessageCircle, href: '#' },
  { name: 'Email', icon: Mail, href: '#' },
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
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 },
  },
};

export function Footer() {
  return (
    <footer className="bg-black border-t border-[#262626]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8"
        >
          {/* Brand */}
          <motion.div variants={itemVariants} className="col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-4 group">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                <Building2 className="w-4 h-4 text-black" />
              </div>
              <span className="text-sm font-semibold text-white tracking-tight group-hover:text-neutral-300 transition-colors">
                AKKUEA
              </span>
            </Link>
            <p className="text-xs text-neutral-500 mb-6 max-w-xs leading-relaxed">
              Democratizing real estate investment through blockchain technology.
              Fractional ownership for everyone.
            </p>
            <div className="flex items-center gap-2">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  className="p-2 rounded-md bg-[#0a0a0a] border border-[#262626] text-neutral-500 hover:text-white hover:border-[#404040] transition-all cursor-pointer"
                  aria-label={social.name}
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </motion.div>

          {/* Links */}
          <motion.div variants={itemVariants}>
            <h3 className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider mb-4">
              Product
            </h3>
            <ul className="space-y-2.5">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="group flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {link.name}
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div variants={itemVariants}>
            <h3 className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider mb-4">
              Resources
            </h3>
            <ul className="space-y-2.5">
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="group flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {link.name}
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div variants={itemVariants}>
            <h3 className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider mb-4">
              Company
            </h3>
            <ul className="space-y-2.5">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="group flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {link.name}
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div variants={itemVariants}>
            <h3 className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider mb-4">
              Legal
            </h3>
            <ul className="space-y-2.5">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="group flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {link.name}
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>

        {/* Bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-12 pt-8 border-t border-[#1a1a1a] flex flex-col sm:flex-row justify-between items-center gap-4"
        >
          <p className="text-[10px] text-neutral-600 font-mono">
            &copy; {new Date().getFullYear()} AKKUEA. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <p className="text-[10px] text-neutral-600 font-mono">
              Built on{' '}
              <span className="text-white">Stellar</span>
            </p>
            <span className="text-neutral-700">|</span>
            <p className="text-[10px] text-neutral-600 font-mono">
              v1.0.0
            </p>
          </div>
        </motion.div>

        {/* ASCII Art */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-8 flex justify-center"
        >
          <pre className="text-[6px] sm:text-[8px] font-mono text-neutral-800 select-none leading-tight text-center">
{`╔═══════════════════════════════════════════════════════════╗
║  █████╗ ██╗  ██╗██╗  ██╗██╗   ██╗███████╗ █████╗          ║
║ ██╔══██╗██║ ██╔╝██║ ██╔╝██║   ██║██╔════╝██╔══██╗         ║
║ ███████║█████╔╝ █████╔╝ ██║   ██║█████╗  ███████║         ║
║ ██╔══██║██╔═██╗ ██╔═██╗ ██║   ██║██╔══╝  ██╔══██║         ║
║ ██║  ██║██║  ██╗██║  ██╗╚██████╔╝███████╗██║  ██║         ║
║ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝         ║
╚═══════════════════════════════════════════════════════════╝`}
          </pre>
        </motion.div>
      </div>
    </footer>
  );
}
