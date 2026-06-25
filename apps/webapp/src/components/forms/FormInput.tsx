"use client";

import React from "react";
import type {
  FieldError,
  FieldErrors,
  FieldValues,
  Path,
  RegisterOptions,
} from "react-hook-form";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui";

interface NestedErrorMap {
  [key: string]: FieldError | NestedErrorMap | undefined;
}

type NestedErrorNode = FieldError | NestedErrorMap;

function getErrorMessage<TFieldValues extends FieldValues>(
  errors: FieldErrors<TFieldValues>,
  name: Path<TFieldValues>,
) {
  const parts = String(name).split(".");
  let current: NestedErrorNode | undefined = errors as NestedErrorNode;
  for (const part of parts) {
    if (!current || "message" in current) {
      return undefined;
    }

    current = (current as NestedErrorMap)[part];
  }
  const msg = current && "message" in current ? current.message : undefined;
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
