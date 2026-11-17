/**
 * Helper to validate and parse evidence links.
 *
 * Evidence links are submitted by the ally, stored on-chain, and later
 * rendered as clickable links or fetched directly in the browser to verify hashes.
 * To guard against cross-site scripting (javascript:), data URLs, unencrypted http:,
 * relative paths, or malformed URLs, only absolute https: URLs are permitted.
 */

export interface ValidEvidenceUrl {
  isValid: true;
  url: URL;
  href: string;
}

export interface InvalidEvidenceUrl {
  isValid: false;
  reason: string;
}

export type EvidenceUrlResult = ValidEvidenceUrl | InvalidEvidenceUrl;

/**
 * Parses and verifies that a candidate evidence link is an absolute HTTPS URL.
 *
 * Rejects:
 * - Empty, non-string, or whitespace-only inputs
 * - Strings containing spaces or whitespace characters
 * - Non-https protocols (http:, javascript:, data:, ftp:, etc.)
 * - Relative URLs or malformed URLs without valid origins
 */
export function parseEvidenceHttpsUrl(
  value: string | undefined | null,
): EvidenceUrlResult {
  if (!value || typeof value !== "string") {
    return { isValid: false, reason: "Evidence link is required." };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { isValid: false, reason: "Evidence link cannot be empty." };
  }

  // Reject URLs containing whitespace characters (e.g. spaces inside URL)
  if (/\s/.test(trimmed)) {
    return {
      isValid: false,
      reason: "Evidence link must not contain whitespace.",
    };
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "https:") {
      return {
        isValid: false,
        reason: `Evidence link must use the https: protocol (got "${url.protocol}").`,
      };
    }

    if (!url.hostname) {
      return {
        isValid: false,
        reason: "Evidence link must have a valid hostname.",
      };
    }

    return {
      isValid: true,
      url,
      href: url.href,
    };
  } catch {
    return {
      isValid: false,
      reason: "Evidence link is not a valid absolute URL.",
    };
  }
}

/**
 * Returns true if the candidate evidence link is an absolute HTTPS URL.
 */
export function isValidEvidenceHttpsUrl(
  value: string | undefined | null,
): boolean {
  return parseEvidenceHttpsUrl(value).isValid;
}
