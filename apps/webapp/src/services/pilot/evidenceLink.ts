/**
 * Client-side validation and parsing of pilot evidence links.
 *
 * Evidence links are stored on-chain and supplied by the ally. Because on-chain
 * storage accepts any string, the web application must treat every link as
 * untrusted input.
 *
 * Only absolute URLs with the `https:` scheme are accepted. Unsafe schemes
 * (`http:`, `javascript:`, `data:`, `file:`, etc.), relative URLs, strings with
 * whitespace, and invalid URLs are rejected so they are never rendered as active
 * links or fetched by the client.
 */

export interface ParsedEvidenceLink {
  /** The standard WHATWG URL object for the parsed link. */
  url: URL;
  /** Normalized absolute HTTPS URL string. */
  href: string;
}

/**
 * Validates and parses an evidence link string.
 *
 * Returns a `ParsedEvidenceLink` object when the input is a valid, absolute
 * `https:` URL without whitespace, or `null` otherwise.
 */
export function parseEvidenceLink(raw: unknown): ParsedEvidenceLink | null {
  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Reject any string containing whitespace (e.g. spaces, tabs, newlines).
  if (/\s/.test(raw)) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    // Only https: protocol is accepted.
    if (url.protocol !== "https:") {
      return null;
    }

    // Must have a non-empty hostname.
    if (!url.hostname) {
      return null;
    }

    return {
      url,
      href: url.href,
    };
  } catch {
    return null;
  }
}

/**
 * Convenience predicate returning true if the input is an absolute https: URL.
 */
export function isValidEvidenceLink(raw: unknown): boolean {
  return parseEvidenceLink(raw) !== null;
}
