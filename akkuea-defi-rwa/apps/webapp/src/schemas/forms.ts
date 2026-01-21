import { z, type RefinementCtx } from "zod";

const nonEmpty = (label: string) => z.string().min(1, `${label} is required`);

const positiveNumberString = (label: string) =>
  nonEmpty(label).refine(
    (v: string) => Number.isFinite(Number(v)) && Number(v) > 0,
    `${label} must be greater than 0`,
  );

const nonNegativeIntString = (label: string) =>
  nonEmpty(label).refine(
    (v: string) =>
      Number.isFinite(Number(v)) &&
      Number.isInteger(Number(v)) &&
      Number(v) >= 0,
    `${label} must be a whole number 0 or more`,
  );

const positiveIntString = (label: string) =>
  nonEmpty(label).refine(
    (v: string) =>
      Number.isFinite(Number(v)) &&
      Number.isInteger(Number(v)) &&
      Number(v) > 0,
    `${label} must be a whole number greater than 0`,
  );

const tokenizeBaseSchema = z.object({
  // Step 1: Property Details
  name: nonEmpty("Property name"),
  description: nonEmpty("Description").min(
    10,
    "Description must be at least 10 characters",
  ),
  address: nonEmpty("Street address"),
  city: nonEmpty("City"),
  country: nonEmpty("Country"),
  propertyType: z.enum(["residential", "commercial", "industrial", "mixed-use"]),
  totalArea: positiveNumberString("Total area"),
  bedrooms: nonNegativeIntString("Bedrooms"),
  bathrooms: nonNegativeIntString("Bathrooms"),
  yearBuilt: nonEmpty("Year built"),

  // Step 2: Documents (not fully implemented in UI yet)
  titleDeed: z.unknown().nullable().optional(),
  propertyImages: z.array(z.unknown()).optional(),
  legalDocuments: z.array(z.unknown()).optional(),
  appraisalReport: z.unknown().nullable().optional(),

  // Step 3: Tokenization
  totalValue: positiveNumberString("Total property value"),
  totalTokens: positiveIntString("Total tokens"),
  minInvestment: positiveIntString("Minimum investment"),
  expectedYield: nonEmpty("Expected yield").refine(
    (v: string) =>
      Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100,
    "Expected yield must be between 0 and 100",
  ),
  fundingDeadline: nonEmpty("Funding deadline").refine((v: string) => {
    const date = new Date(v);
    if (Number.isNaN(date.getTime())) return false;
    const today = new Date();
    date.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return date >= today;
  }, "Funding deadline cannot be in the past"),
});

type TokenizeBaseValues = z.infer<typeof tokenizeBaseSchema>;

export const tokenizeSchema = tokenizeBaseSchema.superRefine(
  (vals: TokenizeBaseValues, ctx: RefinementCtx) => {
    const year = Number(vals.yearBuilt);
    const nowYear = new Date().getFullYear();
    if (!Number.isFinite(year) || !Number.isInteger(year)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Year built must be a whole number",
        path: ["yearBuilt"],
      });
    } else if (year < 1800 || year > nowYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Year built must be between 1800 and ${nowYear}`,
        path: ["yearBuilt"],
      });
    }

    const totalTokens = Number(vals.totalTokens);
    const minInvestment = Number(vals.minInvestment);
    if (
      Number.isFinite(totalTokens) &&
      Number.isFinite(minInvestment) &&
      minInvestment > totalTokens
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimum investment cannot exceed total tokens",
        path: ["minInvestment"],
      });
    }
  },
);

export type TokenizeFormValues = z.infer<typeof tokenizeSchema>;

export function createLendingActionSchema(args: {
  maxAmount: number;
  asset: string;
}) {
  const max = Number.isFinite(args.maxAmount) ? args.maxAmount : 0;
  return z.object({
    amount: positiveNumberString("Amount")
      .refine(
        (v: string) => Number(v) <= max,
        `Amount cannot exceed available ${args.asset}`,
      ),
    zkPrivacy: z.boolean().default(false),
  });
}

export type LendingActionFormValues = {
  amount: string;
  zkPrivacy: boolean;
};

