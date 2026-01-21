"use client";

import React from "react";
import type { FieldErrors, FieldValues, Path } from "react-hook-form";
import { useFormContext } from "react-hook-form";
import { cn } from "@/lib/utils";

function getErrorMessage<TFieldValues extends FieldValues>(
  errors: FieldErrors<TFieldValues>,
  name: Path<TFieldValues>,
) {
  const parts = String(name).split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = errors;
  for (const part of parts) {
    current = current?.[part];
  }
  const msg = current?.message;
  return typeof msg === "string" ? msg : undefined;
}

export interface FormSelectProps<TFieldValues extends FieldValues>
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name"> {
  name: Path<TFieldValues>;
  label?: string;
  hint?: string;
}

export function FormSelect<TFieldValues extends FieldValues>({
  name,
  label,
  hint,
  className,
  id,
  children,
  ...props
}: FormSelectProps<TFieldValues>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<TFieldValues>();

  const selectId = id || label?.toLowerCase().replace(/\s/g, "-");
  const error = getErrorMessage(errors, name);
  const { ref, ...field } = register(name);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-medium text-neutral-400 mb-2"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          "w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#262626] rounded-lg",
          "text-sm text-white font-mono",
          "focus:outline-none focus:border-[#404040] focus:ring-1 focus:ring-[#404040]",
          "transition-all duration-200",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          "cursor-pointer",
          error &&
            "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20",
          className,
        )}
        {...field}
        {...props}
        ref={ref}
      >
        {children}
      </select>
      {hint && !error && (
        <p className="mt-1.5 text-[10px] text-neutral-600 font-mono">{hint}</p>
      )}
      {error && (
        <p className="mt-1.5 text-[10px] text-red-400 font-mono">{error}</p>
      )}
    </div>
  );
}

