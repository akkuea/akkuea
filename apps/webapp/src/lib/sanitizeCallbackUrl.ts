/**
 * Safe fallback used when a callback URL is missing or unsafe.
 */
export const DEFAULT_CALLBACK_URL = "/dashboard";

/**
 * Resolves and validates a post-login callback URL.
 *
 * The value is resolved against the current origin (or a provided base)
 * and is accepted only when it stays on the same origin. This rejects
 * protocol-relative URLs like `//evil.example`, backslash variants like
 * `/\evil.example`, absolute off-origin URLs, and dangerous schemes like
 * `javascript:`. Everything else falls back to `/dashboard`.
 *
 * The `base` argument keeps the helper usable in non-browser contexts
 * (e.g. tests or server code) where `window` is not defined.
 */
export function sanitizeCallbackUrl(
  value: string | null | undefined,
  base?: string,
): string {
  if (!value) return DEFAULT_CALLBACK_URL;

  const origin =
    base ??
    (typeof window !== "undefined" ? window.location.origin : undefined);

  if (!origin) return DEFAULT_CALLBACK_URL;

  try {
    const resolved = new URL(value, origin);

    // Only accept same-origin resolutions. This rejects absolute URLs to
    // other hosts and protocol-relative URLs like `//evil.example`.
    if (resolved.origin !== new URL(origin).origin) {
      return DEFAULT_CALLBACK_URL;
    }

    // Only accept http(s) schemes. This rejects `javascript:`, `data:`,
    // etc. even when they resolve to the current origin.
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return DEFAULT_CALLBACK_URL;
    }

    // Reject backslash variants that some browsers normalize to `://`.
    if (value.includes("\\")) {
      return DEFAULT_CALLBACK_URL;
    }

    // Preserve the relative path (+ query + hash) so deep links survive.
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return DEFAULT_CALLBACK_URL;
  }
}
