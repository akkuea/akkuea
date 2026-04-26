"use client";

import React from "react";
import type {
  FieldValues,
  Path,
  RegisterOptions,
  FieldErrors,
} from "react-hook-form";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui";

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

export interface FormInputProps<TFieldValues extends FieldValues> extends Omit<
  React.ComponentProps<typeof Input>,
  "name" | "defaultValue"
> {
  name: Path<TFieldValues>;
  rules?: RegisterOptions<TFieldValues, Path<TFieldValues>>;
}

export function FormInput<TFieldValues extends FieldValues>({
  name,
  rules,
  ...props
}: FormInputProps<TFieldValues>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<TFieldValues>();

  const error = getErrorMessage(errors, name);
  const { ref, ...field } = register(name, rules);

  return <Input {...props} {...field} ref={ref} error={error} />;
}
