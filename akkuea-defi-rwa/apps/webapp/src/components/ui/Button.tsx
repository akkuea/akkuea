"use client";

import { forwardRef, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "accent";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<
  HTMLMotionProps<"button">,
  "size" | "children"
> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  isSecure?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-white text-black font-medium hover:bg-neutral-200 active:bg-neutral-300",
  secondary:
    "bg-[#1a1a1a] text-white border border-[#262626] hover:border-[#404040] hover:bg-[#262626]",
  outline:
    "bg-transparent border border-[#404040] text-white hover:bg-[#1a1a1a] hover:border-[#525252]",
  ghost: "bg-transparent text-neutral-400 hover:text-white hover:bg-[#1a1a1a]",
  danger:
    "bg-transparent text-red-400 border border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50",
  accent:
    "bg-[#ff3e00] text-white font-medium hover:bg-[#ff5722] active:bg-[#e63900]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2",
};

const hoverScale = {
  scale: 1.01,
  transition: { duration: 0.15 },
};

const tapScale = {
  scale: 0.99,
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      isSecure = false,
      leftIcon,
      rightIcon,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <motion.button
        ref={ref}
        whileHover={!disabled && !isLoading ? hoverScale : undefined}
        whileTap={!disabled && !isLoading ? tapScale : undefined}
        className={cn(
          "relative inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3e00] focus-visible:ring-offset-2 focus-visible:ring-offset-black",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
          "cursor-pointer select-none",
          variants[variant],
          sizes[size],
          className,
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {/* Subtle gradient overlay for depth */}
        {variant === "primary" && (
          <span className="absolute inset-0 rounded-lg bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
        )}

        <span className="relative inline-flex items-center justify-center gap-2">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {!isLoading && leftIcon}
          {!isLoading && isSecure && <Lock className="w-4 h-4" />}
          {children}
          {!isLoading && rightIcon}
        </span>
      </motion.button>
    );
  },
);

Button.displayName = "Button";
