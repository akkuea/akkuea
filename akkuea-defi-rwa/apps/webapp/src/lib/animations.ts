import type { Variants } from 'framer-motion';

// Easing functions
export const easeOutQuart = [0.25, 0.46, 0.45, 0.94];
export const easeInOutQuart = [0.76, 0, 0.24, 1];

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: easeOutQuart },
  },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOutQuart },
  },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOutQuart },
  },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: easeOutQuart },
  },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: easeOutQuart },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: easeOutQuart },
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easeOutQuart },
  },
};

export const hoverScale = {
  scale: 1.02,
  transition: { duration: 0.2, ease: easeOutQuart },
};

export const tapScale = {
  scale: 0.98,
};

export const hoverLift = {
  y: -2,
  transition: { duration: 0.2, ease: easeOutQuart },
};

export const glowPulse: Variants = {
  initial: { boxShadow: '0 0 0 rgba(255, 62, 0, 0)' },
  animate: {
    boxShadow: [
      '0 0 0 rgba(255, 62, 0, 0)',
      '0 0 20px rgba(255, 62, 0, 0.3)',
      '0 0 0 rgba(255, 62, 0, 0)',
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const pageTransition: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.3, ease: easeOutQuart },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

export const blurIn: Variants = {
  hidden: { opacity: 0, filter: 'blur(10px)' },
  visible: {
    opacity: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: easeOutQuart },
  },
};

export const revealText: Variants = {
  hidden: { opacity: 0, y: '100%' },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeInOutQuart },
  },
};

export const borderGlow: Variants = {
  initial: { borderColor: 'rgba(38, 38, 38, 1)' },
  hover: {
    borderColor: 'rgba(64, 64, 64, 1)',
    transition: { duration: 0.2 },
  },
};

export const accentGlow: Variants = {
  initial: { boxShadow: '0 0 0 rgba(255, 62, 0, 0)' },
  hover: {
    boxShadow: '0 0 30px rgba(255, 62, 0, 0.2)',
    transition: { duration: 0.3 },
  },
};
