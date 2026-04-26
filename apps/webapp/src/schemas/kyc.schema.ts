import { z } from "zod";

export const kycSchema = z.object({
  fullName: z.string().min(3, "Full name must be at least 3 characters"),

  email: z.string().email("Invalid email address"),

  date_of_birth: z.string().min(1, "Date of birth is required"),

  nationality: z.string().min(2, "Nationality is required"),

  phone_number: z.string().min(7, "Phone number is required"),

  residential_address: z.string().min(5, "Residential address is required"),

  nationalId: z
    .array(z.instanceof(File))
    .refine(
      (files) => files.every((file) => file.size <= 10 * 1024 * 1024),
      "Each file must be less than 10MB",
    ),

  selfie: z
    .array(z.instanceof(File))
    .refine(
      (files) => files.every((file) => file.size <= 10 * 1024 * 1024),
      "Each file must be less than 10MB",
    ),
});

export type KycFormData = z.infer<typeof kycSchema>;
