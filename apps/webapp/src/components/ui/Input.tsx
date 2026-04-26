"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, hint, leftIcon, rightIcon, className, id, ...props },
    ref,
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-neutral-400 mb-2"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#262626] rounded-lg",
              "text-sm text-white placeholder-neutral-600 font-mono",
              "focus:outline-none focus:border-[#404040] focus:ring-1 focus:ring-[#404040]",
              "transition-all duration-200",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "cursor-text",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error &&
                "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20",
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500">
              {rightIcon}
            </div>
          )}
        </div>
        {hint && !error && (
          <p className="mt-1.5 text-[10px] text-neutral-600 font-mono">
            {hint}
          </p>
        )}
        {error && (
          <p className="mt-1.5 text-[10px] text-red-400 font-mono">{error}</p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-neutral-400 mb-2"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#262626] rounded-lg",
            "text-sm text-white placeholder-neutral-600 font-mono",
            "focus:outline-none focus:border-[#404040] focus:ring-1 focus:ring-[#404040]",
            "transition-all duration-200 resize-none",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "cursor-text",
            error &&
              "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20",
            className,
          )}
          {...props}
        />
        {hint && !error && (
          <p className="mt-1.5 text-[10px] text-neutral-600 font-mono">
            {hint}
          </p>
        )}
        {error && (
          <p className="mt-1.5 text-[10px] text-red-400 font-mono">{error}</p>
        )}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
