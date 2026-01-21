"use client";

import React, { useMemo, useState } from "react";
import type { DefaultValues } from "react-hook-form";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";
import type { ZodTypeAny } from "zod";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";

export type FormRenderProps<TSchema extends ZodTypeAny> = UseFormReturn<
  z.infer<TSchema>
> & {
  formError: string | null;
  formSuccess: string | null;
  setFormError: React.Dispatch<React.SetStateAction<string | null>>;
  setFormSuccess: React.Dispatch<React.SetStateAction<string | null>>;
};

export interface FormProps<TSchema extends ZodTypeAny> {
  schema: TSchema;
  defaultValues?: DefaultValues<z.infer<TSchema>>;
  onSubmit: (values: z.infer<TSchema>) => void | Promise<void>;
  children:
    | React.ReactNode
    | ((methods: FormRenderProps<TSchema>) => React.ReactNode);
  className?: string;
  id?: string;
  successMessage?: string;
  showFeedback?: boolean;
}

export function Form<TSchema extends ZodTypeAny>({
  schema,
  defaultValues,
  onSubmit,
  children,
  className,
  id,
  successMessage,
  showFeedback = true,
}: FormProps<TSchema>) {
  const methods = useForm<z.infer<TSchema>>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onBlur",
    criteriaMode: "firstError",
    shouldFocusError: true,
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const handleValidSubmit = async (values: z.infer<TSchema>) => {
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

  const renderProps: FormRenderProps<TSchema> = useMemo(
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

