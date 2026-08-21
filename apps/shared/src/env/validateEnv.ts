import { z } from "zod";
import {
  apiEnvSchema,
  webappEnvSchema,
  type ApiEnv,
  type WebappEnv,
} from "./schemas";

export class EnvValidationError extends Error {
  public readonly issues: string[];
  public readonly scope: string;

  constructor(scope: string, issues: string[]) {
    const formattedIssues = issues.map((issue) => `  - ${issue}`).join("\n");
    const message = [
      `Environment validation failed for ${scope}:`,
      formattedIssues,
      "",
      "Please refer to docs/ENV_SETUP.md for instructions on obtaining real local development values.",
    ].join("\n");

    super(message);
    this.name = "EnvValidationError";
    this.scope = scope;
    this.issues = issues;
  }
}

export function validateEnv<Output, Def extends z.ZodTypeDef, Input>(
  schema: z.ZodType<Output, Def, Input>,
  env: Record<string, string | undefined> = process.env,
  scope: string = "Application",
): Output {
  if (env.SKIP_ENV_VALIDATION === "true" || env.SKIP_ENV_VALIDATION === "1") {
    return env as unknown as Output;
  }

  const result = schema.safeParse(env);

  if (!result.success) {
    const issues: string[] = [];

    for (const error of result.error.errors) {
      const path = error.path.join(".") || "environment";
      issues.push(`${path}: ${error.message}`);
    }

    throw new EnvValidationError(scope, issues);
  }

  return result.data;
}

export function validateApiEnv(
  env: Record<string, string | undefined> = process.env,
): ApiEnv {
  return validateEnv(apiEnvSchema, env, "API (apps/api)");
}

export function validateWebappEnv(
  env: Record<string, string | undefined> = process.env,
): WebappEnv {
  return validateEnv(webappEnvSchema, env, "Webapp (apps/webapp)");
}
