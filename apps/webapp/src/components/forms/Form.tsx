"use client";

import React, { useMemo, useState } from "react";
import type { DefaultValues, FieldValues } from "react-hook-form";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";

export type FormRenderProps<
  TInput extends FieldValues,
  TOutput extends FieldValues,
> = UseFormReturn<TInput, unknown, TOutput> & {
  formError: string | null;
  formSuccess: string | null;
  setFormError: React.Dispatch<React.SetStateAction<string | null>>;
  setFormSuccess: React.Dispatch<React.SetStateAction<string | null>>;
};

export interface FormProps<
  TInput extends FieldValues,
  TOutput extends FieldValues,
> {
  schema: z.ZodType<TOutput, TInput>;
  defaultValues?: DefaultValues<TInput>;
  onSubmit: (values: TOutput) => void | Promise<void>;
  children:
    | React.ReactNode
    | ((methods: FormRenderProps<TInput, TOutput>) => React.ReactNode);
  className?: string;
  id?: string;
  successMessage?: string;
  showFeedback?: boolean;
}

export function Form<TInput extends FieldValues, TOutput extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  children,
  className,
  id,
  successMessage,
  showFeedback = true,
}: FormProps<TInput, TOutput>) {
  const methods = useForm<TInput, unknown, TOutput>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onBlur",
    criteriaMode: "firstError",
    shouldFocusError: true,
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const handleValidSubmit = async (values: TOutput) => {
    setFormError(null);
    setFormSuccess(null);
    try {
      await onSubmit(values);
      if (successMessage) setFormSuccess(successMessage);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Something went wrong. Please try again.";
      setFormError(message);
    }
  };

  const renderProps: FormRenderProps<TInput, TOutput> = useMemo(
    () => ({
      ...methods,
      formError,
      formSuccess,
      setFormError,
      setFormSuccess,
    }),
    [methods, formError, formSuccess],
  );

  return (
    <FormProvider {...methods}>
      <form
        id={id}
        className={cn("space-y-4", className)}
        onSubmit={methods.handleSubmit(handleValidSubmit)}
      >
        {showFeedback && formError && (
          <p className="text-[10px] text-red-400 font-mono">{formError}</p>
        )}
        {showFeedback && formSuccess && (
          <p className="text-[10px] text-[#00ff88] font-mono">{formSuccess}</p>
        )}
        {typeof children === "function" ? children(renderProps) : children}
      </form>
    </FormProvider>
  );
}
