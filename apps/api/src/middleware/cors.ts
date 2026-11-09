import { cors } from '@elysiajs/cors';
import { corsAllowedOriginsSchema, resolveCorsAllowedOrigins } from '@akkuea/shared';
import { logger } from '../services/logger';

/**
 * Read the browser origins allowed to call the API cross-origin.
 *
 * `CORS_ALLOWED_ORIGINS` is validated at startup by `validateApiEnv`; it is
 * re-validated here so a malformed entry can never widen what the plugin
 * matches. With no value, development falls back to the local frontends and
 * production allows no cross-origin requests (and says so at startup).
 */
export function readCorsAllowedOrigins(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const parsed = corsAllowedOriginsSchema.safeParse(env.CORS_ALLOWED_ORIGINS);
  if (!parsed.success) {
    throw new Error(
      `Invalid CORS_ALLOWED_ORIGINS: ${
        parsed.error.issues[0]?.message ?? 'expected a comma-separated list of origins'
      }`,
    );
  }

  const origins = resolveCorsAllowedOrigins(parsed.data, env.NODE_ENV);
  if (origins.length === 0 && env.NODE_ENV === 'production') {
    logger.warn(
      'CORS_ALLOWED_ORIGINS is not set: browsers will be blocked from calling the API cross-origin',
      { variable: 'CORS_ALLOWED_ORIGINS' },
    );
  }
  return origins;
}

/**
 * CORS plugin that answers only the given exact origins, with credentials.
 * Any other origin, including one that is not set at all, receives no
 * `Access-Control-Allow-Origin` header.
 */
export function createCorsPlugin(allowedOrigins: readonly string[]) {
  return cors({ origin: [...allowedOrigins], credentials: true });
}
