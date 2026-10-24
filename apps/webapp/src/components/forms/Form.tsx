"use client";

import React, { useMemo, useState } from "react";
import type { DefaultValues, FieldValues } from "react-hook-form";
import {
  FormProvider,
  useForm,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";

export type FormRenderProps<TValues extends FieldValues> =
  UseFormReturn<TValues> & {
    formError: string | null;
    formSuccess: string | null;
    setFormError: React.Dispatch<React.SetStateAction<string | null>>;
    setFormSuccess: React.Dispatch<React.SetStateAction<string | null>>;
  };

/**
 * Generic over the parsed *value* type rather than the schema type.
 *
 * With `@hookform/resolvers` v5 the resolver is typed from the schema's own
 * input/output pair; a `TSchema extends z.ZodType` parameter leaves that pair
 * unresolved (`output<TSchema>` never narrows to `FieldValues`), which is what
 * produced the `unknown is not assignable to FieldValues` errors. Binding the
 * schema as `z.ZodType<TValues, TValues>` pins both sides to the same concrete
 * record and the resolver, `useForm<TValues>` and the render props all agree.
 */
export interface FormProps<TValues extends FieldValues> {
  // Input is `FieldValues` rather than `TValues` because a schema with defaults
  // or transforms accepts a looser shape than it returns (e.g. an optional field
  // with `.default()`); pinning both sides rejects those schemas.
  schema: z.ZodType<TValues, FieldValues>;
  defaultValues?: DefaultValues<TValues>;
  onSubmit: (values: TValues) => void | Promise<void>;
  children:
    React.ReactNode | ((methods: FormRenderProps<TValues>) => React.ReactNode);
  className?: string;
  id?: string;
  successMessage?: string;
  showFeedback?: boolean;
}

export function Form<TValues extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  children,
  className,
  id,
  successMessage,
  showFeedback = true,
}: FormProps<TValues>) {
  const methods = useForm<TValues>({
    // The resolver is typed from the schema's own input pair, which we widened
    // to FieldValues above; the parsed output is still exactly TValues.
    resolver: zodResolver(schema) as Resolver<TValues>,
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onBlur",
    criteriaMode: "firstError",
    shouldFocusError: true,
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const handleValidSubmit = async (values: TValues) => {
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

  const renderProps: FormRenderProps<TValues> = useMemo(
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
