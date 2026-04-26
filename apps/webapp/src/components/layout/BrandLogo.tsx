"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  href?: string;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  showLabel?: boolean;
  animateIcon?: boolean;
};

export function BrandLogo({
  href = "/",
  className,
  iconClassName,
  textClassName,
  showLabel = true,
  animateIcon = false,
}: BrandLogoProps) {
  const IconWrapper = animateIcon ? motion.div : "div";
  const iconWrapperProps = animateIcon
    ? {
        whileHover: { scale: 1.05 },
        whileTap: { scale: 0.95 },
      }
    : {};

  return (
    <Link
      href={href}
      className={cn("flex items-center gap-3 group", className)}
    >
      <IconWrapper
        {...iconWrapperProps}
        className={cn(
          "relative w-8 h-8 rounded-lg bg-white/95 overflow-hidden flex items-center justify-center shadow-sm",
          iconClassName,
        )}
      >
        <Image
          src="/logo.png"
          alt="Akkuea logo"
          fill
          sizes="32px"
          className="object-contain p-1"
          priority
        />
      </IconWrapper>
      {showLabel ? (
        <span
          className={cn(
            "text-sm font-semibold text-white tracking-tight transition-colors group-hover:text-neutral-300",
            textClassName,
          )}
        >
          AKKUEA
        </span>
      ) : null}
    </Link>
  );
}
