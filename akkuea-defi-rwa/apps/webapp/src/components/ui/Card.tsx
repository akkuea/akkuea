'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { fadeInUp, hoverScale } from '@/lib/animations';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  variant?: 'default' | 'elevated' | 'bordered' | 'accent' | 'gradient' | 'glow';
  hoverable?: boolean;
  noPadding?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', hoverable = false, noPadding = false, className, children, ...props }, ref) => {
    const variantStyles = {
      default: 'bg-[#0a0a0a] border border-[#262626]',
      elevated: 'bg-[#0a0a0a] border border-[#262626] shadow-xl shadow-black/20',
      bordered: 'bg-black border border-[#262626] hover:border-[#404040]',
      accent: 'bg-[#0a0a0a] border border-[#262626] hover:border-[#ff3e00]/30',
      gradient: 'bg-gradient-to-br from-[#0a0a0a] via-[#0a0a0a] to-[#1a1a1a] border border-[#262626]',
      glow: 'bg-[#0a0a0a] border border-[#ff3e00]/30 shadow-lg shadow-[#ff3e00]/10',
    };

    return (
      <motion.div
        ref={ref}
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        whileHover={hoverable ? hoverScale : undefined}
        className={cn(
          'rounded-lg',
          variantStyles[variant],
          !noPadding && 'p-6',
          hoverable && 'cursor-pointer transition-all duration-300',
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = 'Card';

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('mb-4', className)} {...props}>
      {children}
    </div>
  )
);

CardHeader.displayName = 'CardHeader';

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, children, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-sm font-semibold text-white', className)} {...props}>
      {children}
    </h3>
  )
);

CardTitle.displayName = 'CardTitle';

interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, children, ...props }, ref) => (
    <p ref={ref} className={cn('text-xs text-neutral-500 mt-1', className)} {...props}>
      {children}
    </p>
  )
);

CardDescription.displayName = 'CardDescription';

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('', className)} {...props}>
      {children}
    </div>
  )
);

CardContent.displayName = 'CardContent';

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('mt-4 pt-4 border-t border-[#1a1a1a]', className)} {...props}>
      {children}
    </div>
  )
);

CardFooter.displayName = 'CardFooter';
