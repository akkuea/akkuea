# C1-016: Add Form Validation with React Hook Form and Zod

## Detailed Implementation Guide

## Issue Metadata

| Attribute       | Value                                            |
| --------------- | ------------------------------------------------ |
| Issue ID        | C1-016                                           |
| Title           | Add form validation with React Hook Form and Zod |
| Area            | WEBAPP                                           |
| Difficulty      | Medium                                           |
| Labels          | frontend, forms, validation, medium              |
| Dependencies    | None                                             |
| Estimated Lines | 150-200                                          |

## Overview

React Hook Form provides performant form state management, while Zod offers type-safe schema validation. Together they create a robust form validation system with excellent TypeScript integration.

## Prerequisites

- Understanding of React Hook Form
- Familiarity with Zod schemas
- Knowledge of form accessibility patterns

## Implementation Steps

### Step 1: Install Dependencies

```bash
cd apps/webapp
bun add react-hook-form @hookform/resolvers zod
```

### Step 2: Create Form Validation Schemas

Create `apps/webapp/src/schemas/forms.ts`:

```typescript
import { z } from "zod";

/**
 * Property creation form schema
 */
export const createPropertySchema = z.object({
  name: z
    .string()
    .min(1, "Property name is required")
    .max(255, "Name must be less than 255 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(5000, "Description must be less than 5000 characters"),
  propertyType: z.enum(
    ["residential", "commercial", "industrial", "land", "mixed"],
    { errorMap: () => ({ message: "Please select a property type" }) },
  ),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"),
  postalCode: z.string().optional(),
  totalValue: z
    .string()
    .min(1, "Total value is required")
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount"),
  totalShares: z
    .number({ invalid_type_error: "Enter a valid number" })
    .int("Must be a whole number")
    .positive("Must be greater than 0")
    .max(1000000, "Maximum 1,000,000 shares"),
  pricePerShare: z
    .string()
    .min(1, "Price per share is required")
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount"),
});

export type CreatePropertyFormData = z.infer<typeof createPropertySchema>;

/**
 * Deposit form schema
 */
export const depositSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .regex(/^\d+(\.\d+)?$/, "Enter a valid amount")
    .refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
});

export type DepositFormData = z.infer<typeof depositSchema>;

/**
 * Borrow form schema
 */
export const borrowSchema = z.object({
  amount: z
    .string()
    .min(1, "Borrow amount is required")
    .regex(/^\d+(\.\d+)?$/, "Enter a valid amount")
    .refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
  collateralAmount: z
    .string()
    .min(1, "Collateral amount is required")
    .regex(/^\d+(\.\d+)?$/, "Enter a valid amount")
    .refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
});

export type BorrowFormData = z.infer<typeof borrowSchema>;

/**
 * Buy shares form schema
 */
export const buySharesSchema = z.object({
  shares: z
    .number({ invalid_type_error: "Enter a valid number" })
    .int("Must be a whole number")
    .positive("Must be at least 1 share"),
});

export type BuySharesFormData = z.infer<typeof buySharesSchema>;

/**
 * Profile update schema
 */
export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),
});

export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;
```

### Step 3: Create Base Form Component

Create `apps/webapp/src/components/forms/Form.tsx`:

```typescript
'use client';

import {
  useForm,
  FormProvider,
  UseFormReturn,
  FieldValues,
  DefaultValues,
  SubmitHandler,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ZodSchema } from 'zod';
import { cn } from '@/lib/utils';

interface FormProps<T extends FieldValues> {
  schema: ZodSchema<T>;
  defaultValues?: DefaultValues<T>;
  onSubmit: SubmitHandler<T>;
  children: React.ReactNode | ((methods: UseFormReturn<T>) => React.ReactNode);
  className?: string;
  id?: string;
}

export function Form<T extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  children,
  className,
  id,
}: FormProps<T>) {
  const methods = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onBlur',
  });

  return (
    <FormProvider {...methods}>
      <form
        id={id}
        className={cn('space-y-4', className)}
        onSubmit={methods.handleSubmit(onSubmit)}
        noValidate
      >
        {typeof children === 'function' ? children(methods) : children}
      </form>
    </FormProvider>
  );
}

/**
 * Hook to access form context
 */
export { useFormContext, useWatch, useFieldArray } from 'react-hook-form';
```

### Step 4: Create FormInput Component

Create `apps/webapp/src/components/forms/FormInput.tsx`:

```typescript
'use client';

import { useFormContext } from 'react-hook-form';
import { Input, InputProps } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface FormInputProps extends Omit<InputProps, 'name'> {
  name: string;
  label?: string;
  description?: string;
}

export function FormInput({
  name,
  label,
  description,
  className,
  ...props
}: FormInputProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  const error = errors[name];
  const errorMessage = error?.message as string | undefined;

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium text-gray-200"
        >
          {label}
          {props.required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}

      {description && (
        <p className="text-xs text-gray-400">{description}</p>
      )}

      <Input
        id={name}
        {...register(name, {
          valueAsNumber: props.type === 'number',
        })}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        className={cn(error && 'border-red-500 focus:ring-red-500')}
        {...props}
      />

      {errorMessage && (
        <p
          id={`${name}-error`}
          className="text-sm text-red-400"
          role="alert"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
```

### Step 5: Create FormSelect Component

Create `apps/webapp/src/components/forms/FormSelect.tsx`:

```typescript
'use client';

import { useFormContext } from 'react-hook-form';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
}

interface FormSelectProps {
  name: string;
  label?: string;
  options: Option[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export function FormSelect({
  name,
  label,
  options,
  placeholder = 'Select an option',
  required,
  className,
  disabled,
}: FormSelectProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  const error = errors[name];
  const errorMessage = error?.message as string | undefined;

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium text-gray-200"
        >
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}

      <select
        id={name}
        {...register(name)}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        className={cn(
          'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg',
          'text-white placeholder-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-accent-green/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-red-500 focus:ring-red-500'
        )}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {errorMessage && (
        <p
          id={`${name}-error`}
          className="text-sm text-red-400"
          role="alert"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
```

### Step 6: Create FormTextarea Component

Create `apps/webapp/src/components/forms/FormTextarea.tsx`:

```typescript
'use client';

import { useFormContext } from 'react-hook-form';
import { cn } from '@/lib/utils';

interface FormTextareaProps {
  name: string;
  label?: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  maxLength?: number;
  className?: string;
  disabled?: boolean;
}

export function FormTextarea({
  name,
  label,
  description,
  placeholder,
  required,
  rows = 4,
  maxLength,
  className,
  disabled,
}: FormTextareaProps) {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext();

  const error = errors[name];
  const errorMessage = error?.message as string | undefined;
  const value = watch(name) || '';
  const charCount = value.length;

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium text-gray-200"
        >
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}

      {description && (
        <p className="text-xs text-gray-400">{description}</p>
      )}

      <textarea
        id={name}
        {...register(name)}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        className={cn(
          'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg',
          'text-white placeholder-gray-500 resize-none',
          'focus:outline-none focus:ring-2 focus:ring-accent-green/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-red-500 focus:ring-red-500'
        )}
      />

      <div className="flex justify-between text-xs">
        {errorMessage ? (
          <p id={`${name}-error`} className="text-red-400" role="alert">
            {errorMessage}
          </p>
        ) : (
          <span />
        )}
        {maxLength && (
          <span className="text-gray-400">
            {charCount}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
```

### Step 7: Create Form Submit Button

Create `apps/webapp/src/components/forms/FormSubmit.tsx`:

```typescript
'use client';

import { useFormContext } from 'react-hook-form';
import { Button, ButtonProps } from '@/components/ui/Button';

interface FormSubmitProps extends Omit<ButtonProps, 'type'> {
  loadingText?: string;
}

export function FormSubmit({
  children,
  loadingText = 'Submitting...',
  disabled,
  ...props
}: FormSubmitProps) {
  const {
    formState: { isSubmitting, isValid },
  } = useFormContext();

  return (
    <Button
      type="submit"
      disabled={disabled || isSubmitting || !isValid}
      loading={isSubmitting}
      {...props}
    >
      {isSubmitting ? loadingText : children}
    </Button>
  );
}
```

### Step 8: Create Forms Index

Create `apps/webapp/src/components/forms/index.ts`:

```typescript
export { Form, useFormContext, useWatch, useFieldArray } from "./Form";
export { FormInput } from "./FormInput";
export { FormSelect } from "./FormSelect";
export { FormTextarea } from "./FormTextarea";
export { FormSubmit } from "./FormSubmit";
```

## Usage Example

```typescript
'use client';

import { Form, FormInput, FormSelect, FormTextarea, FormSubmit } from '@/components/forms';
import { createPropertySchema, CreatePropertyFormData } from '@/schemas/forms';
import { propertyApi } from '@/services';
import { toast } from 'sonner';

const propertyTypes = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'land', label: 'Land' },
  { value: 'mixed', label: 'Mixed Use' },
];

export function CreatePropertyForm() {
  const handleSubmit = async (data: CreatePropertyFormData) => {
    try {
      await propertyApi.create({
        name: data.name,
        description: data.description,
        propertyType: data.propertyType,
        location: {
          address: data.address,
          city: data.city,
          country: data.country,
          postalCode: data.postalCode,
        },
        totalValue: data.totalValue,
        totalShares: data.totalShares,
        pricePerShare: data.pricePerShare,
        images: [],
      });
      toast.success('Property created successfully');
    } catch (error) {
      toast.error('Failed to create property');
    }
  };

  return (
    <Form
      schema={createPropertySchema}
      onSubmit={handleSubmit}
      defaultValues={{
        propertyType: 'residential',
        totalShares: 100,
      }}
    >
      <FormInput name="name" label="Property Name" required />
      <FormTextarea
        name="description"
        label="Description"
        rows={4}
        maxLength={5000}
        required
      />
      <FormSelect
        name="propertyType"
        label="Property Type"
        options={propertyTypes}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <FormInput name="address" label="Address" required />
        <FormInput name="city" label="City" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormInput name="country" label="Country" required />
        <FormInput name="postalCode" label="Postal Code" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FormInput name="totalValue" label="Total Value ($)" required />
        <FormInput name="totalShares" label="Total Shares" type="number" required />
        <FormInput name="pricePerShare" label="Price/Share ($)" required />
      </div>
      <FormSubmit>Create Property</FormSubmit>
    </Form>
  );
}
```

## Related Resources

| Resource           | Link                                         |
| ------------------ | -------------------------------------------- |
| React Hook Form    | https://react-hook-form.com                  |
| Zod                | https://zod.dev                              |
| Hookform Resolvers | https://github.com/react-hook-form/resolvers |

## Verification Checklist

| Item                       | Status |
| -------------------------- | ------ |
| Dependencies installed     |        |
| Form component created     |        |
| FormInput working          |        |
| FormSelect working         |        |
| FormTextarea working       |        |
| Validation schemas created |        |
| Error display working      |        |
| Submit states working      |        |
